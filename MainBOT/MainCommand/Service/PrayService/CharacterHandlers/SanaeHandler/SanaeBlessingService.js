const { get, run } = require('../../../../Core/database');

const sanaeCache = new Map();
const CACHE_TTL = 3000;

/**
 * Get all Sanae blessing data for a user
 */
async function getSanaeBlessing(userId) {
    const cached = sanaeCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const data = await get(`SELECT * FROM sanaeBlessings WHERE userId = ?`, [userId]);
    
    if (data) {
        sanaeCache.set(userId, { data, timestamp: Date.now() });
    }
    
    return data || null;
}

/**
 * Check if user has active craft discount from Sanae
 * @returns {{ active: boolean, discount: number, expiry: number }}
 */
async function checkCraftDiscount(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing) return { active: false, discount: 0 };
    
    const now = Date.now();
    if (blessing.craftDiscountExpiry > now && blessing.craftDiscount > 0) {
        return {
            active: true,
            discount: blessing.craftDiscount / 100,
            expiry: blessing.craftDiscountExpiry
        };
    }
    return { active: false, discount: 0 };
}

/**
 * Check if user has free crafts active (no coin/gem cost)
 * @returns {{ active: boolean, expiry: number }}
 */
async function checkFreeCrafts(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing) return { active: false };
    
    const now = Date.now();
    if (blessing.freeCraftsExpiry > now) {
        return { active: true, expiry: blessing.freeCraftsExpiry };
    }
    return { active: false };
}

/**
 * Check and consume craft protection (prevents craft failure)
 * @returns {{ protected: boolean, remaining: number }}
 */
async function consumeCraftProtection(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing || blessing.craftProtection <= 0) {
        return { protected: false, remaining: 0 };
    }
    
    sanaeCache.delete(userId);
    await run(
        `UPDATE sanaeBlessings SET craftProtection = craftProtection - 1, lastUpdated = ? WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    return { protected: true, remaining: blessing.craftProtection - 1 };
}

/**
 * Check if user has guaranteed rarity rolls active
 * @returns {{ active: boolean, minRarity: string, remaining: number }}
 */
async function checkGuaranteedRarity(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing || blessing.guaranteedRarityRolls <= 0) {
        return { active: false, minRarity: null, remaining: 0 };
    }
    
    return {
        active: true,
        minRarity: blessing.guaranteedMinRarity,
        remaining: blessing.guaranteedRarityRolls
    };
}

/**
 * Consume one guaranteed rarity roll
 * @returns {{ consumed: boolean, minRarity: string, remaining: number }}
 */
async function consumeGuaranteedRoll(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing || blessing.guaranteedRarityRolls <= 0) {
        return { consumed: false, minRarity: null, remaining: 0 };
    }
    
    sanaeCache.delete(userId);
    await run(
        `UPDATE sanaeBlessings SET guaranteedRarityRolls = guaranteedRarityRolls - 1, lastUpdated = ? WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    return {
        consumed: true,
        minRarity: blessing.guaranteedMinRarity,
        remaining: blessing.guaranteedRarityRolls - 1
    };
}

/**
 * Check if user has luck bonus for rolls
 * @returns {{ active: boolean, luckBonus: number, remaining: number }}
 */
async function checkLuckForRolls(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing || blessing.luckForRolls <= 0) {
        return { active: false, luckBonus: 0, remaining: 0 };
    }
    
    return {
        active: true,
        luckBonus: blessing.luckForRollsAmount,
        remaining: blessing.luckForRolls
    };
}

/**
 * Consume one luck roll bonus
 * @returns {{ consumed: boolean, luckBonus: number, remaining: number }}
 */
async function consumeLuckRoll(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing || blessing.luckForRolls <= 0) {
        return { consumed: false, luckBonus: 0, remaining: 0 };
    }
    
    sanaeCache.delete(userId);
    await run(
        `UPDATE sanaeBlessings SET luckForRolls = luckForRolls - 1, lastUpdated = ? WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    return {
        consumed: true,
        luckBonus: blessing.luckForRollsAmount,
        remaining: blessing.luckForRolls - 1
    };
}

/**
 * Check if user has pray immunity (prevents negative pray events)
 * @returns {{ active: boolean, expiry: number }}
 */
async function checkPrayImmunity(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing) return { active: false };
    
    const now = Date.now();
    if (blessing.prayImmunityExpiry > now) {
        return { active: true, expiry: blessing.prayImmunityExpiry };
    }
    return { active: false };
}

/**
 * Get a summary of all active Sanae blessings for display
 */
async function getActiveBlessingSummary(userId) {
    const blessing = await getSanaeBlessing(userId);
    if (!blessing) return null;
    
    const now = Date.now();
    const active = [];
    
    if (blessing.craftDiscountExpiry > now && blessing.craftDiscount > 0) {
        const remaining = Math.ceil((blessing.craftDiscountExpiry - now) / (60 * 60 * 1000));
        active.push(`🔨 ${blessing.craftDiscount}% craft discount (${remaining}h left)`);
    }
    
    if (blessing.freeCraftsExpiry > now) {
        const remaining = Math.ceil((blessing.freeCraftsExpiry - now) / (24 * 60 * 60 * 1000));
        active.push(`🆓 Free crafts (${remaining}d left)`);
    }
    
    if (blessing.craftProtection > 0) {
        active.push(`🛡️ ${blessing.craftProtection} craft protections`);
    }
    
    if (blessing.guaranteedRarityRolls > 0) {
        active.push(`🎲 ${blessing.guaranteedRarityRolls} guaranteed ${blessing.guaranteedMinRarity}+ rolls`);
    }
    
    if (blessing.luckForRolls > 0) {
        active.push(`🍀 +${(blessing.luckForRollsAmount * 100).toFixed(0)}% luck (${blessing.luckForRolls} rolls)`);
    }
    
    if (blessing.prayImmunityExpiry > now) {
        const remaining = Math.ceil((blessing.prayImmunityExpiry - now) / (24 * 60 * 60 * 1000));
        active.push(`🙏 Pray immunity (${remaining}d left)`);
    }
    
    return {
        faithPoints: blessing.faithPoints || 0,
        activeBlessings: active
    };
}

function clearCache(userId = null) {
    if (userId) {
        sanaeCache.delete(userId);
    } else {
        sanaeCache.clear();
    }
}

module.exports = {
    getSanaeBlessing,
    checkCraftDiscount,
    checkFreeCrafts,
    consumeCraftProtection,
    checkGuaranteedRarity,
    consumeGuaranteedRoll,
    checkLuckForRolls,
    consumeLuckRoll,
    checkPrayImmunity,
    getActiveBlessingSummary,
    clearCache
};
