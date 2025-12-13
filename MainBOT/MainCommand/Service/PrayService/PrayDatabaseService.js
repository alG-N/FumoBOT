const { get, all, run, transaction } = require('../../Core/database');
const { getWeekIdentifier } = require('../../Ultility/weekly');

const inventoryCache = new Map();
const userDataCache = new Map();
const prayItemCache = new Map();
const INVENTORY_CACHE_TTL = 5000;
const USER_DATA_CACHE_TTL = 3000;
const PRAY_ITEM_CACHE_TTL = 10000;

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

async function updateUserLuck(userId, luckIncrease, luckRarity = null) {
    userDataCache.delete(userId);
    if (luckRarity) {
        await run(
            `UPDATE userCoins SET luck = CASE WHEN luck + ? > 1 THEN 1 ELSE luck + ? END, luckRarity = ? WHERE userId = ?`,
            [luckIncrease, luckIncrease, luckRarity, userId]
        );
    } else {
        await run(
            `UPDATE userCoins SET luck = CASE WHEN luck + ? > 1 THEN 1 ELSE luck + ? END WHERE userId = ?`,
            [luckIncrease, luckIncrease, userId]
        );
    }
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
    
    const rarityConditions = allRarities.map(r => `rarity = '${r}'`).join(' OR ');
    
    const fumos = await all(
        `SELECT id, fumoName, rarity, quantity 
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName LIKE '%(%' 
         AND (${rarityConditions})
         ORDER BY 
           CASE rarity
             WHEN 'ETERNAL' THEN 1
             WHEN 'TRANSCENDENT' THEN 2
             WHEN '???' THEN 3
             WHEN 'ASTRAL' THEN 4
             WHEN 'CELESTIAL' THEN 5
             WHEN 'INFINITE' THEN 6
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

    return fumos;
}

async function getReimuRareFumos(userId, allowedRarities) {
    const rarityConditions = allowedRarities.map(r => `rarity = '${r}'`).join(' OR ');
    
    return await all(
        `SELECT id, fumoName, rarity, quantity 
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName LIKE '%(%' 
         AND (${rarityConditions})
         LIMIT 1000`,
        [userId],
        true
    );
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
    clearInventoryCache,
    clearUserDataCache
};