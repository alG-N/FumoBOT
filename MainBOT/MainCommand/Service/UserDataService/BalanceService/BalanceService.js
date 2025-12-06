const db = require('../../../Core/database');
const { CACHE_TTL } = require('../../../Configuration/balanceConfig');

const cache = new Map();

function getCacheKey(userId) {
    return `balance_${userId}`;
}

function isCacheValid(entry) {
    return entry && (Date.now() - entry.timestamp < CACHE_TTL);
}

async function getUserData(userId, useCache = true) {
    const cacheKey = getCacheKey(userId);
    
    if (useCache) {
        const cached = cache.get(cacheKey);
        if (isCacheValid(cached)) {
            return cached.data;
        }
    }
    
    const row = await db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
    
    if (!row) {
        return null;
    }
    
    const data = sanitizeUserData(row);
    
    cache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    
    return data;
}

async function getBatchUserData(userIds) {
    const results = {};
    
    for (const userId of userIds) {
        results[userId] = await getUserData(userId, true);
    }
    
    return results;
}

async function getFarmingFumos(userId) {
    return await db.all(
        `SELECT fumoName, coinsPerMin, gemsPerMin, quantity, rarity 
         FROM farmingFumos 
         WHERE userId = ?
         ORDER BY rarity DESC`,
        [userId]
    );
}

async function getActiveBoosts(userId) {
    const now = Date.now();
    return await db.all(
        `SELECT type, multiplier, source, expiresAt 
         FROM activeBoosts 
         WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)
         ORDER BY type, multiplier DESC`,
        [userId, now]
    );
}

async function getUserAchievements(userId, row) {
    const { ACHIEVEMENTS } = require('../../../Configuration/balanceConfig');
    
    return ACHIEVEMENTS
        .filter(achievement => achievement.check(row))
        .map(achievement => achievement.name);
}

async function getUserActivity(userId) {
    const [recentSales, recentRolls, recentCrafts] = await Promise.all([
        db.all(
            `SELECT fumoName, quantity, timestamp 
             FROM userSales 
             WHERE userId = ? 
             ORDER BY timestamp DESC 
             LIMIT 5`,
            [userId]
        ),
        db.get(
            `SELECT COUNT(*) as count, MAX(lastRollTime) as lastRoll 
             FROM userCoins 
             WHERE userId = ?`,
            [userId]
        ),
        db.all(
            `SELECT craftType, itemName, amount, craftedAt 
             FROM craftHistory 
             WHERE userId = ? 
             ORDER BY craftedAt DESC 
             LIMIT 5`,
            [userId]
        )
    ]);
    
    return {
        recentSales: recentSales || [],
        rollStats: recentRolls || { count: 0, lastRoll: null },
        recentCrafts: recentCrafts || []
    };
}

function sanitizeUserData(row) {
    const safe = (v, d = 0) => (typeof v === 'number' && !isNaN(v) ? v : d);
    
    return {
        coins: safe(row.coins),
        gems: safe(row.gems),
        spiritTokens: safe(row.spiritTokens),
        luck: safe(row.luck),
        reimuStatus: row.reimuStatus || 'None',
        rollsLeft: safe(row.rollsLeft),
        reimuPenalty: safe(row.reimuPenalty),
        reimuPityCount: safe(row.reimuPityCount),
        prayedToMarisa: row.prayedToMarisa ? 'Yes' : 'No',
        marisaDonationCount: safe(row.marisaDonationCount),
        joinDate: row.joinDate,
        yukariCoins: safe(row.yukariCoins),
        yukariGems: safe(row.yukariGems),
        yukariMark: safe(row.yukariMark),
        totalRolls: safe(row.totalRolls),
        dailyStreak: safe(row.dailyStreak),
        level: safe(row.level, 1),
        rebirth: safe(row.rebirth),
        exp: safe(row.exp),
        wins: safe(row.wins),
        losses: safe(row.losses),
        boostCharge: safe(row.boostCharge),
        boostActive: safe(row.boostActive),
        lastDailyBonus: row.lastDailyBonus,
        rollsSinceLastMythical: safe(row.rollsSinceLastMythical),
        rollsSinceLastQuestionMark: safe(row.rollsSinceLastQuestionMark)
    };
}

function invalidateCache(userId) {
    const cacheKey = getCacheKey(userId);
    cache.delete(cacheKey);
}

function clearAllCache() {
    cache.clear();
}

function getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const entry of cache.values()) {
        if (isCacheValid(entry)) {
            valid++;
        } else {
            expired++;
        }
    }
    
    return {
        total: cache.size,
        valid,
        expired,
        ttl: CACHE_TTL
    };
}

module.exports = {
    getUserData,
    getBatchUserData,
    getFarmingFumos,
    getActiveBoosts,
    getUserAchievements,
    getUserActivity,
    invalidateCache,
    clearAllCache,
    getCacheStats
};