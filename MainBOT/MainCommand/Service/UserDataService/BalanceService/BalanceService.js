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
    
    // Get data from both userCoins and userLevelProgress
    const [row, levelRow] = await Promise.all([
        db.get(`SELECT * FROM userCoins WHERE userId = ?`, [userId]),
        db.get(`SELECT level, exp FROM userLevelProgress WHERE userId = ?`, [userId])
    ]);
    
    if (!row) {
        return null;
    }
    
    // Merge level data from userLevelProgress into the row
    const mergedRow = {
        ...row,
        level: levelRow?.level || 1,
        exp: levelRow?.exp || 0
    };
    
    const data = sanitizeUserData(mergedRow);
    
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
        `SELECT fumoName, coinsPerMin, gemsPerMin, COALESCE(quantity, 1) as quantity, rarity 
         FROM farmingFumos 
         WHERE userId = ?
         ORDER BY rarity DESC`,
        [userId]
    );
}

async function getSanaeData(userId) {
    try {
        const data = await db.get(
            `SELECT * FROM sanaeBlessings WHERE userId = ?`,
            [userId]
        );
        
        // Return normalized data with defaults for missing columns
        if (!data) {
            return {
                faithPoints: 0,
                permanentLuckBonus: 0,
                luckForRolls: 0,
                luckForRollsAmount: 0,
                guaranteedRarityRolls: 0,
                craftProtection: 0
            };
        }
        
        return {
            faithPoints: data.faithPoints || 0,
            permanentLuckBonus: data.permanentLuckBonus || 0,
            luckForRolls: data.luckForRolls || 0,
            luckForRollsAmount: data.luckForRollsAmount || 0,
            guaranteedRarityRolls: data.guaranteedRarityRolls || 0,
            craftProtection: data.craftProtection || 0
        };
    } catch (error) {
        console.error('[BalanceService] Error fetching Sanae data:', error);
        return {
            faithPoints: 0,
            permanentLuckBonus: 0,
            luckForRolls: 0,
            luckForRollsAmount: 0,
            guaranteedRarityRolls: 0,
            craftProtection: 0
        };
    }
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

async function getUserBuildings(userId) {
    try {
        const building = await db.get(
            `SELECT coinBoostLevel, gemBoostLevel, criticalFarmingLevel, eventBoostLevel 
             FROM userBuildings 
             WHERE userId = ?`,
            [userId]
        );
        return building || { coinBoostLevel: 0, gemBoostLevel: 0, criticalFarmingLevel: 0, eventBoostLevel: 0 };
    } catch (error) {
        console.error('[BalanceService] Error fetching buildings:', error);
        return { coinBoostLevel: 0, gemBoostLevel: 0, criticalFarmingLevel: 0, eventBoostLevel: 0 };
    }
}

async function getUserPets(userId) {
    try {
        const [pets, hatchingEggs] = await Promise.all([
            db.all(
                `SELECT petId, type, name, petName, level, quality, weight, age, hunger, rarity, ability 
                 FROM petInventory 
                 WHERE userId = ? AND type = 'pet'
                 ORDER BY level DESC`,
                [userId]
            ),
            db.all(
                `SELECT id, eggName, startedAt, hatchAt 
                 FROM hatchingEggs 
                 WHERE userId = ?`,
                [userId]
            )
        ]);
        
        return {
            owned: pets || [],
            hatching: hatchingEggs || []
        };
    } catch (error) {
        console.error('[BalanceService] Error fetching pets:', error);
        return { owned: [], hatching: [] };
    }
}

async function getUserQuestSummary(userId) {
    try {
        const date = new Date().toISOString().slice(0, 10);
        const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
        const week = getWeekIdentifier();
        
        // Only count progress for currently active quests (to handle re-rolled quests correctly)
        const [dailyProgress, weeklyProgress, achievements] = await Promise.all([
            db.all(
                `SELECT dqp.questId, dqp.progress, dqp.completed 
                 FROM dailyQuestProgress dqp
                 INNER JOIN userActiveQuests uaq ON dqp.questId = uaq.uniqueQuestId AND dqp.userId = uaq.userId
                 WHERE dqp.userId = ? AND dqp.date = ? AND uaq.questType = 'daily' AND uaq.period = ?`,
                [userId, date, date]
            ),
            db.all(
                `SELECT wqp.questId, wqp.progress, wqp.completed 
                 FROM weeklyQuestProgress wqp
                 INNER JOIN userActiveQuests uaq ON wqp.questId = uaq.uniqueQuestId AND wqp.userId = uaq.userId
                 WHERE wqp.userId = ? AND wqp.week = ? AND uaq.questType = 'weekly' AND uaq.period = ?`,
                [userId, week, week]
            ),
            db.all(
                `SELECT achievementId, progress, claimed, claimedMilestones 
                 FROM achievementProgress 
                 WHERE userId = ?`,
                [userId]
            )
        ]);
        
        const dailyCompleted = (dailyProgress || []).filter(q => q.completed === 1).length;
        const weeklyCompleted = (weeklyProgress || []).filter(q => q.completed === 1).length;
        
        // Parse claimedMilestones for each achievement
        const parsedAchievements = (achievements || []).map(ach => {
            let claimedMilestones = [];
            try {
                claimedMilestones = ach.claimedMilestones ? JSON.parse(ach.claimedMilestones) : [];
            } catch (e) {
                claimedMilestones = [];
            }
            return {
                ...ach,
                claimedMilestones
            };
        });
        
        return {
            daily: { completed: dailyCompleted, total: 5, progress: dailyProgress || [] },
            weekly: { completed: weeklyCompleted, total: 7, progress: weeklyProgress || [] },
            achievements: parsedAchievements
        };
    } catch (error) {
        console.error('[BalanceService] Error fetching quest summary:', error);
        return {
            daily: { completed: 0, total: 5, progress: [] },
            weekly: { completed: 0, total: 7, progress: [] },
            achievements: []
        };
    }
}

async function getCurrentWeather(userId) {
    try {
        const { getCurrentMultipliers, getActiveSeasonsList } = require('../../FarmingService/SeasonService/SeasonManagerService');
        const { getActiveSeasonTypes } = require('../../FarmingService/SeasonService/SeasonDatabaseService');
        
        const activeSeasons = await getActiveSeasonTypes();
        
        if (!activeSeasons || activeSeasons.length === 0) {
            return null;
        }
        
        const multipliers = await getCurrentMultipliers();
        const description = await getActiveSeasonsList();
        
        // Get all active weather types (excluding WEEKEND for display)
        const allWeathers = activeSeasons.filter(s => s !== 'WEEKEND');
        
        return {
            weatherType: allWeathers.length > 0 ? allWeathers.join(' + ') : 'WEEKEND',
            allWeathers: allWeathers,
            multiplierCoin: parseFloat((multipliers.coinMultiplier || 1).toFixed(2)),
            multiplierGem: parseFloat((multipliers.gemMultiplier || 1).toFixed(2)),
            activeEvents: multipliers.activeEvents || activeSeasons,
            description: description
        };
    } catch (error) {
        console.error('[BalanceService] Error fetching weather:', error);
        return null;
    }
}

async function getUserAchievements(userId, row) {
    // Get badge-based achievements from user's inventory
    const { getUserBadges } = require('../ItemService/ItemQueryService');
    
    try {
        const badges = await getUserBadges(userId);
        
        if (!badges || badges.length === 0) {
            return [];
        }

        // Format badges with tier emoji - now shows "BadgeName - TierName"
        const tierEmojis = {
            'C': '🥉', // Common
            'R': '🥈', // Rare
            'E': '🥇', // Epic
            'L': '💎', // Legendary
            'M': '🌟', // Mythical
            'T': '✨', // Transcendent
            '?': '❓'  // Special/Unknown
        };

        return badges.map(badge => {
            const emoji = tierEmojis[badge.tier] || '🏅';
            // Format as "BadgeName - TierName" (e.g., "RollBadge - Mythical")
            return `${emoji} ${badge.baseName} - ${badge.tierName}`;
        });
    } catch (error) {
        console.error('[BalanceService] Error fetching badge achievements:', error);
        return [];
    }
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
    getSanaeData,
    getActiveBoosts,
    getUserBuildings,
    getUserPets,
    getUserQuestSummary,
    getCurrentWeather,
    getUserAchievements,
    getUserActivity,
    invalidateCache,
    clearAllCache,
    getCacheStats
};