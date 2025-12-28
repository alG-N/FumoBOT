const { get, all, run, transaction } = require('../../Core/database');
const { getWeekIdentifier } = require('../../Ultility/weekly');

const inventoryCache = new Map();
const userDataCache = new Map();
const prayItemCache = new Map();
const sanaeCache = new Map();
const INVENTORY_CACHE_TTL = 5000;
const USER_DATA_CACHE_TTL = 3000;
const PRAY_ITEM_CACHE_TTL = 10000;
const SANAE_CACHE_TTL = 5000;

async function consumeTicket(userId) {
    inventoryCache.delete(userId);
    prayItemCache.delete(userId);
    await run(
        `UPDATE userInventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?`,
        [userId, 'PrayTicket(R)']
    );
}

async function consumeShards(userId, shardNames) {
    inventoryCache.delete(userId);
    prayItemCache.delete(userId);
    const placeholders = shardNames.map(() => '?').join(',');
    await run(
        `UPDATE userInventory 
         SET quantity = quantity - 1 
         WHERE userId = ? AND itemName IN (${placeholders})`,
        [userId, ...shardNames]
    );
}

async function getUserInventory(userId) {
    const cached = inventoryCache.get(userId);
    if (cached && Date.now() - cached.timestamp < INVENTORY_CACHE_TTL) {
        return cached.data;
    }

    const data = await all(
        `SELECT * FROM userInventory WHERE userId = ?`,
        [userId],
        true
    );

    inventoryCache.set(userId, { data, timestamp: Date.now() });
    return data;
}

async function getPrayRelevantItems(userId) {
    const cached = prayItemCache.get(userId);
    if (cached && Date.now() - cached.timestamp < PRAY_ITEM_CACHE_TTL) {
        return cached.data;
    }

    const basicShards = ['RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)'];
    const enhancedShards = ['DivineOrb(D)', 'CelestialEssence(D)'];
    const allShards = [...basicShards, ...enhancedShards];
    
    const placeholders = allShards.map(() => '?').join(',');
    
    const data = await all(
        `SELECT itemName, quantity FROM userInventory 
         WHERE userId = ? AND itemName IN (${placeholders})`,
        [userId, ...allShards],
        true
    );

    const result = {
        hasBasicShards: basicShards.every(shard => {
            const item = data.find(i => i.itemName === shard);
            return item && item.quantity >= 1;
        }),
        hasEnhancedShards: false
    };

    const divineOrb = data.find(i => i.itemName === 'DivineOrb(D)');
    const celestialEssence = data.find(i => i.itemName === 'CelestialEssence(D)');
    
    result.hasEnhancedShards = result.hasBasicShards &&
                                divineOrb && divineOrb.quantity >= 1 &&
                                celestialEssence && celestialEssence.quantity >= 5;

    prayItemCache.set(userId, { data: result, timestamp: Date.now() });
    return result;
}

async function getUserData(userId) {
    const cached = userDataCache.get(userId);
    if (cached && Date.now() - cached.timestamp < USER_DATA_CACHE_TTL) {
        return cached.data;
    }

    const user = await get(`SELECT * FROM userCoins WHERE userId = ?`, [userId], true);
    
    if (user) {
        userDataCache.set(userId, { data: user, timestamp: Date.now() });
    }
    
    return user;
}

async function updateUserCoins(userId, coins, gems) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
        [coins, gems, userId]
    );
}

async function deductUserCurrency(userId, coins, gems) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
        [coins, gems, userId]
    );
}

async function updateUserLuck(userId, luckAmount) {
    userDataCache.delete(userId);
    
    const MAX_PERMANENT_LUCK = 5.0; // 500% cap
    
    // ADD to existing luck, not replace
    await run(
        `UPDATE userCoins 
         SET luck = MIN(?, COALESCE(luck, 0) + ?) 
         WHERE userId = ?`,
        [MAX_PERMANENT_LUCK, luckAmount, userId]
    );
    
    return true;
}

async function updateUserRolls(userId, rollsToAdd) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins SET rollsLeft = rollsLeft + ? WHERE userId = ?`,
        [rollsToAdd, userId]
    );
}

async function addToInventory(userId, itemName, quantity = 1) {
    inventoryCache.delete(userId);
    prayItemCache.delete(userId);
    
    await run(
        `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
        [userId, itemName, quantity, quantity]
    );
}

async function deleteFumoFromInventory(userId, fumoId, quantity = 1) {
    inventoryCache.delete(userId);
    const existing = await get(
        `SELECT quantity FROM userInventory WHERE id = ?`,
        [fumoId]
    );

    if (!existing) return;

    if (existing.quantity > quantity) {
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
            [quantity, fumoId]
        );
    } else {
        await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
    }
}

async function incrementDailyPray(userId) {
    const today = new Date().toISOString().split('T')[0];
    const weekKey = getWeekIdentifier();
    
    await transaction([
        {
            sql: `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
                  VALUES (?, 'pray_5', 1, 0, ?)
                  ON CONFLICT(userId, questId, date) DO UPDATE SET 
                  progress = MIN(dailyQuestProgress.progress + 1, 5),
                  completed = CASE WHEN dailyQuestProgress.progress + 1 >= 5 THEN 1 ELSE 0 END`,
            params: [userId, today]
        },
        {
            sql: `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                  VALUES (?, 'pray_success_25', 1, 0, ?)
                  ON CONFLICT(userId, questId, week) DO UPDATE SET 
                  progress = MIN(weeklyQuestProgress.progress + 1, 25),
                  completed = CASE WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1 ELSE 0 END`,
            params: [userId, weekKey]
        },
        {
            sql: `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                  VALUES (?, 'total_prays', 1, 0)
                  ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + 1`,
            params: [userId]
        }
    ]);
}

async function updateYukariData(userId, coinsAdded, gemsAdded, newMark) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins 
        SET coins = coins + ?, 
            gems = gems + ?, 
            yukariCoins = yukariCoins + ?, 
            yukariGems = yukariGems + ?, 
            yukariMark = ? 
        WHERE userId = ?`,
        [coinsAdded, gemsAdded, coinsAdded, gemsAdded, newMark, userId]
    );
}

async function updateReimuData(userId, updates) {
    userDataCache.delete(userId);
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        fields.push(`${key} = ?`);
        values.push(value);
    }

    values.push(userId);

    await run(
        `UPDATE userCoins SET ${fields.join(', ')} WHERE userId = ?`,
        values
    );
}

async function updateMarisaData(userId, donationCount, prayedStatus) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins 
         SET marisaDonationCount = ?, 
             prayedToMarisa = ? 
         WHERE userId = ?`,
        [donationCount, prayedStatus, userId]
    );
}

const sakuyaUsageCache = new Map();
const SAKUYA_CACHE_TTL = 5000;

async function getSakuyaUsage(userId) {
    const cached = sakuyaUsageCache.get(userId);
    if (cached && Date.now() - cached.timestamp < SAKUYA_CACHE_TTL) {
        return cached.data;
    }

    const data = await get(`SELECT * FROM sakuyaUsage WHERE userId = ?`, [userId], true);
    
    if (data) {
        sakuyaUsageCache.set(userId, { data, timestamp: Date.now() });
    }
    
    return data;
}

async function updateSakuyaUsage(userId, data) {
    sakuyaUsageCache.delete(userId);
    const existing = await getSakuyaUsage(userId);
    
    if (existing) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        values.push(userId);

        await run(
            `UPDATE sakuyaUsage SET ${fields.join(', ')} WHERE userId = ?`,
            values
        );
    } else {
        await run(
            `INSERT INTO sakuyaUsage (userId, uses, firstUseTime, lastUsed, timeBlessing, blessingExpiry)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, data.uses || 0, data.firstUseTime || Date.now(), data.lastUsed || Date.now(), data.timeBlessing || 0, data.blessingExpiry || null]
        );
    }
}

async function getFarmingFumos(userId) {
    return await all(`SELECT * FROM farmingFumos WHERE userId = ?`, [userId], true);
}

async function getActiveBoosts(userId, currentTime) {
    return await all(
        `SELECT type, multiplier FROM activeBoosts
         WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, currentTime],
        true
    );
}

async function addSpiritTokens(userId, amount) {
    userDataCache.delete(userId);
    await run(
        `UPDATE userCoins SET spiritTokens = COALESCE(spiritTokens, 0) + ? WHERE userId = ?`,
        [amount, userId]
    );
}

async function getYukariFumosByRarityGroups(userId, config) {
    const rarityGroups = config.rarityGroups;
    const allRarities = [
        ...rarityGroups.group1,
        ...rarityGroups.group2,
        ...rarityGroups.group3
    ];
    
    // Build LIKE conditions to extract rarity from fumoName like "Reimu(Common)"
    const rarityConditions = allRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    const fumos = await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${allRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'Common'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         ORDER BY 
           CASE 
             WHEN fumoName LIKE '%(ETERNAL)%' THEN 1
             WHEN fumoName LIKE '%(TRANSCENDENT)%' THEN 2
             WHEN fumoName LIKE '%(???)%' THEN 3
             WHEN fumoName LIKE '%(ASTRAL)%' THEN 4
             WHEN fumoName LIKE '%(CELESTIAL)%' THEN 5
             WHEN fumoName LIKE '%(INFINITE)%' THEN 6
             ELSE 7
           END,
           CASE 
             WHEN fumoName LIKE '%[🌟alG]%' THEN 1
             WHEN fumoName LIKE '%[✨SHINY]%' THEN 2
             ELSE 3
           END`,
        [userId],
        true
    );

    return fumos || [];
}

async function getReimuRareFumos(userId, allowedRarities) {
    const rarityConditions = allowedRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    return await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${allowedRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'RARE'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         LIMIT 1000`,
        [userId],
        true
    );
}

async function getMythicalPlusFumos(userId, minRarities) {
    const rarityConditions = minRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    return await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${minRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'MYTHICAL'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         LIMIT 100`,
        [userId],
        true
    );
}

async function getLegendaryPlusFumos(userId, minRarities) {
    const rarityConditions = minRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    return await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${minRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'LEGENDARY'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         LIMIT 100`,
        [userId],
        true
    );
}

async function getSanaeData(userId) {
    const cached = sanaeCache.get(userId);
    if (cached && Date.now() - cached.timestamp < SANAE_CACHE_TTL) {
        return cached.data;
    }

    let data = await get(`SELECT * FROM sanaeBlessings WHERE userId = ?`, [userId], true);
    
    if (!data) {
        await run(
            `INSERT INTO sanaeBlessings (userId, faithPoints, lastUpdated) VALUES (?, 0, ?)`,
            [userId, Date.now()]
        );
        data = {
            faithPoints: 0,
            rerollsUsed: 0,
            craftDiscount: 0,
            craftDiscountExpiry: 0,
            freeCraftsExpiry: 0,
            prayImmunityExpiry: 0,
            guaranteedRarityRolls: 0,
            guaranteedMinRarity: null,
            luckForRolls: 0,
            luckForRollsAmount: 0,
            craftProtection: 0,
            boostMultiplierExpiry: 0,
            permanentLuckBonus: 0,
            lastUpdated: Date.now()
        };
    }

    sanaeCache.set(userId, { data, timestamp: Date.now() });
    return data;
}

async function updateSanaeData(userId, updates) {
    sanaeCache.delete(userId);
    
    const existing = await get(`SELECT userId FROM sanaeBlessings WHERE userId = ?`, [userId]);
    
    updates.lastUpdated = Date.now();
    
    if (existing) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }

        values.push(userId);

        await run(
            `UPDATE sanaeBlessings SET ${fields.join(', ')} WHERE userId = ?`,
            values
        );
    } else {
        // Ensure all required columns exist
        const defaultData = {
            faithPoints: 0,
            rerollsUsed: 0,
            craftDiscount: 0,
            craftDiscountExpiry: 0,
            freeCraftsExpiry: 0,
            prayImmunityExpiry: 0,
            guaranteedRarityRolls: 0,
            guaranteedMinRarity: null,
            luckForRolls: 0,
            luckForRollsAmount: 0,
            craftProtection: 0,
            boostMultiplierExpiry: 0,
            permanentLuckBonus: 0,
            lastUpdated: Date.now(),
            ...updates
        };
        
        const columns = ['userId', ...Object.keys(defaultData)];
        const placeholders = columns.map(() => '?').join(', ');
        const values = [userId, ...Object.values(defaultData)];

        await run(
            `INSERT INTO sanaeBlessings (${columns.join(', ')}) VALUES (${placeholders})`,
            values
        );
    }
}

/**
 * Apply permanent luck bonus from Sanae blessing
 * This directly updates the user's base luck stat
 */
async function applyPermanentLuck(userId, luckAmount) {
    userDataCache.delete(userId);
    sanaeCache.delete(userId);
    
    const MAX_PERMANENT_LUCK = 5.0; // 500% cap
    
    // Update user's permanent luck in userCoins, capped at MAX
    await run(
        `UPDATE userCoins 
         SET luck = MIN(?, COALESCE(luck, 0) + ?) 
         WHERE userId = ?`,
        [MAX_PERMANENT_LUCK, luckAmount, userId]
    );
    
    // Also track in sanaeBlessings for reference
    await run(
        `UPDATE sanaeBlessings 
         SET permanentLuckBonus = MIN(?, COALESCE(permanentLuckBonus, 0) + ?), lastUpdated = ?
         WHERE userId = ?`,
        [MAX_PERMANENT_LUCK, luckAmount, Date.now(), userId]
    );
    
    return { applied: true, amount: luckAmount };
}

/**
 * Get all active Sanae boosts for gacha integration
 */
async function getActiveSanaeBoosts(userId) {
    const sanaeData = await getSanaeData(userId);
    const now = Date.now();
    
    const boosts = {
        // Luck boosts
        luckForRolls: {
            active: sanaeData.luckForRolls > 0,
            amount: sanaeData.luckForRollsAmount || 0,
            remaining: sanaeData.luckForRolls || 0
        },
        
        // Guaranteed rarity
        guaranteedRarity: {
            active: sanaeData.guaranteedRarityRolls > 0,
            minRarity: sanaeData.guaranteedMinRarity,
            remaining: sanaeData.guaranteedRarityRolls || 0
        },
        
        // Craft bonuses
        craftDiscount: {
            active: sanaeData.craftDiscountExpiry > now && sanaeData.craftDiscount > 0,
            percent: sanaeData.craftDiscount || 0,
            expiry: sanaeData.craftDiscountExpiry
        },
        
        freeCrafts: {
            active: sanaeData.freeCraftsExpiry > now,
            expiry: sanaeData.freeCraftsExpiry
        },
        
        craftProtection: {
            active: sanaeData.craftProtection > 0,
            remaining: sanaeData.craftProtection || 0
        },
        
        // Pray immunity
        prayImmunity: {
            active: sanaeData.prayImmunityExpiry > now,
            expiry: sanaeData.prayImmunityExpiry
        },
        
        // Permanent luck (cumulative)
        permanentLuck: sanaeData.permanentLuckBonus || 0,
        
        // Faith points
        faithPoints: sanaeData.faithPoints || 0
    };
    
    return boosts;
}

/**
 * Consume one guaranteed rarity roll
 * Returns the minimum rarity and remaining count
 */
async function consumeSanaeGuaranteedRoll(userId) {
    sanaeCache.delete(userId);
    const data = await getSanaeData(userId);
    
    if (!data || data.guaranteedRarityRolls <= 0) {
        return { consumed: false, minRarity: null, remaining: 0 };
    }
    
    await run(
        `UPDATE sanaeBlessings 
         SET guaranteedRarityRolls = guaranteedRarityRolls - 1, lastUpdated = ?
         WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    return {
        consumed: true,
        minRarity: data.guaranteedMinRarity,
        remaining: data.guaranteedRarityRolls - 1
    };
}

/**
 * Consume one luck roll bonus
 * Returns the luck amount and remaining count
 */
async function consumeSanaeLuckRoll(userId) {
    sanaeCache.delete(userId);
    const data = await getSanaeData(userId);
    
    if (!data || data.luckForRolls <= 0) {
        return { consumed: false, luckBonus: 0, remaining: 0 };
    }
    
    await run(
        `UPDATE sanaeBlessings 
         SET luckForRolls = luckForRolls - 1, lastUpdated = ?
         WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    return {
        consumed: true,
        luckBonus: data.luckForRollsAmount || 0,
        remaining: data.luckForRolls - 1
    };
}

async function getSanaeFaithPoints(userId) {
    const data = await getSanaeData(userId);
    return data.faithPoints || 0;
}

async function updateSanaeFaithPoints(userId, points) {
    await updateSanaeData(userId, { faithPoints: points });
}

async function addSanaeFaithPoints(userId, points) {
    const current = await getSanaeFaithPoints(userId);
    await updateSanaeFaithPoints(userId, current + points);
}

async function consumeSanaeGuaranteedRoll(userId) {
    sanaeCache.delete(userId);
    const data = await getSanaeData(userId);
    
    if (data.guaranteedRarityRolls > 0) {
        await run(
            `UPDATE sanaeBlessings SET guaranteedRarityRolls = guaranteedRarityRolls - 1, lastUpdated = ? WHERE userId = ?`,
            [Date.now(), userId]
        );
        return {
            active: true,
            minRarity: data.guaranteedMinRarity,
            remaining: data.guaranteedRarityRolls - 1
        };
    }
    return { active: false };
}

async function consumeSanaeLuckRoll(userId) {
    sanaeCache.delete(userId);
    const data = await getSanaeData(userId);
    
    if (data.luckForRolls > 0) {
        await run(
            `UPDATE sanaeBlessings SET luckForRolls = luckForRolls - 1, lastUpdated = ? WHERE userId = ?`,
            [Date.now(), userId]
        );
        return {
            active: true,
            luckBonus: data.luckForRollsAmount,
            remaining: data.luckForRolls - 1
        };
    }
    return { active: false, luckBonus: 0 };
}

async function consumeSanaeCraftProtection(userId) {
    sanaeCache.delete(userId);
    const data = await getSanaeData(userId);
    
    if (data.craftProtection > 0) {
        await run(
            `UPDATE sanaeBlessings SET craftProtection = craftProtection - 1, lastUpdated = ? WHERE userId = ?`,
            [Date.now(), userId]
        );
        return { protected: true, remaining: data.craftProtection - 1 };
    }
    return { protected: false };
}

async function checkSanaeCraftDiscount(userId) {
    const data = await getSanaeData(userId);
    const now = Date.now();
    
    if (data.craftDiscountExpiry > now && data.craftDiscount > 0) {
        return { 
            active: true, 
            discount: data.craftDiscount / 100,
            expiry: data.craftDiscountExpiry
        };
    }
    return { active: false, discount: 0 };
}

async function checkSanaeFreeCrafts(userId) {
    const data = await getSanaeData(userId);
    const now = Date.now();
    
    if (data.freeCraftsExpiry > now) {
        return { active: true, expiry: data.freeCraftsExpiry };
    }
    return { active: false };
}

async function checkSanaePrayImmunity(userId) {
    const data = await getSanaeData(userId);
    const now = Date.now();
    
    if (data.prayImmunityExpiry > now) {
        return { active: true, expiry: data.prayImmunityExpiry };
    }
    return { active: false };
}

function clearSanaeCache(userId = null) {
    if (userId) {
        sanaeCache.delete(userId);
    } else {
        sanaeCache.clear();
    }
}

function clearInventoryCache(userId = null) {
    if (userId) {
        inventoryCache.delete(userId);
        prayItemCache.delete(userId);
    } else {
        inventoryCache.clear();
        prayItemCache.clear();
    }
}

function clearUserDataCache(userId = null) {
    if (userId) {
        userDataCache.delete(userId);
    } else {
        userDataCache.clear();
    }
}

module.exports = {
    consumeTicket,
    consumeShards,
    getUserInventory,
    getPrayRelevantItems,
    getUserData,
    updateUserCoins,
    deductUserCurrency,
    updateUserLuck,
    updateUserRolls,
    addToInventory,
    deleteFumoFromInventory,
    incrementDailyPray,
    updateYukariData,
    updateReimuData,
    updateMarisaData,
    getSakuyaUsage,
    updateSakuyaUsage,
    getFarmingFumos,
    getActiveBoosts,
    addSpiritTokens,
    getYukariFumosByRarityGroups,
    getReimuRareFumos,
    getSanaeData,
    updateSanaeData,
    getSanaeFaithPoints,
    updateSanaeFaithPoints,
    addSanaeFaithPoints,
    consumeSanaeGuaranteedRoll,
    consumeSanaeLuckRoll,
    consumeSanaeCraftProtection,
    checkSanaeCraftDiscount,
    checkSanaeFreeCrafts,
    checkSanaePrayImmunity,
    clearSanaeCache,
    getMythicalPlusFumos,
    getLegendaryPlusFumos,
    clearInventoryCache,
    clearUserDataCache,
    applyPermanentLuck,
    getActiveSanaeBoosts
};