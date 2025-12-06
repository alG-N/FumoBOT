const db = require('../../../Core/database');
const { DAILY_CONFIG } = require('../../../Configuration/dailyConfig');
const { logError } = require('../../../Core/logger');

async function getDailyStatus(userId) {
    try {
        const row = await db.get(
            `SELECT lastDailyBonus, dailyStreak, spiritTokens, coins, gems
             FROM userCoins WHERE userId = ?`,
            [userId],
            true
        );
        
        if (!row) {
            return {
                exists: false,
                canClaim: false,
                reason: 'NO_ACCOUNT'
            };
        }
        
        const now = Date.now();
        const timeSinceLastClaim = now - (row.lastDailyBonus || 0);
        
        if (timeSinceLastClaim < DAILY_CONFIG.COOLDOWN) {
            const timeRemaining = DAILY_CONFIG.COOLDOWN - timeSinceLastClaim;
            return {
                exists: true,
                canClaim: false,
                reason: 'ON_COOLDOWN',
                timeRemaining,
                streak: row.dailyStreak || 0
            };
        }
        
        return {
            exists: true,
            canClaim: true,
            streak: row.dailyStreak || 0,
            lastClaim: row.lastDailyBonus,
            timeSinceLastClaim
        };
    } catch (error) {
        throw new Error(`Failed to get daily status: ${error.message}`);
    }
}

function calculateStreak(lastClaim, currentStreak) {
    if (!lastClaim) return 1;
    
    const now = Date.now();
    const timeSince = now - lastClaim;
    const oneDayMs = DAILY_CONFIG.COOLDOWN;
    const twoDaysMs = oneDayMs * 2;
    
    if (timeSince > twoDaysMs) {
        return 1;
    }
    
    if (timeSince >= oneDayMs) {
        return (currentStreak || 0) + 1;
    }
    
    return currentStreak || 1;
}

function rollDailyReward(streak) {
    const roll = Math.random();
    
    for (const tier of DAILY_CONFIG.REWARD_TIERS) {
        if (roll < tier.chance) {
            return {
                coins: tier.baseCoins + (tier.streakBonus * streak),
                gems: tier.baseGems + (tier.streakBonus * streak),
                spiritTokens: tier.spiritTokens,
                description: tier.description,
                color: tier.color,
                rarity: tier.rarity,
                thumbnail: tier.thumbnail || DAILY_CONFIG.DEFAULT_THUMBNAIL
            };
        }
    }
    
    const defaultTier = DAILY_CONFIG.REWARD_TIERS[0];
    return {
        coins: defaultTier.baseCoins + (defaultTier.streakBonus * streak),
        gems: defaultTier.baseGems + (defaultTier.streakBonus * streak),
        spiritTokens: defaultTier.spiritTokens,
        description: defaultTier.description,
        color: defaultTier.color,
        rarity: defaultTier.rarity,
        thumbnail: defaultTier.thumbnail || DAILY_CONFIG.DEFAULT_THUMBNAIL
    };
}

async function claimDaily(userId) {
    try {
        const status = await getDailyStatus(userId);
        
        if (!status.exists) {
            return {
                success: false,
                reason: 'NO_ACCOUNT'
            };
        }
        
        if (!status.canClaim) {
            return {
                success: false,
                reason: status.reason,
                timeRemaining: status.timeRemaining,
                streak: status.streak
            };
        }
        
        const newStreak = calculateStreak(status.lastClaim, status.streak);
        const reward = rollDailyReward(newStreak);
        const now = Date.now();
        
        await db.run(
            `UPDATE userCoins 
             SET coins = coins + ?,
                 gems = gems + ?,
                 spiritTokens = COALESCE(spiritTokens, 0) + ?,
                 lastDailyBonus = ?,
                 dailyStreak = ?
             WHERE userId = ?`,
            [reward.coins, reward.gems, reward.spiritTokens, now, newStreak, userId]
        );
        
        return {
            success: true,
            reward,
            streak: newStreak,
            isNewStreak: newStreak > (status.streak || 0)
        };
    } catch (error) {
        throw new Error(`Failed to claim daily: ${error.message}`);
    }
}

async function getDailyLeaderboard(limit = 10) {
    try {
        const rows = await db.all(
            `SELECT userId, dailyStreak, lastDailyBonus
             FROM userCoins
             WHERE dailyStreak > 0
             ORDER BY dailyStreak DESC, lastDailyBonus DESC
             LIMIT ?`,
            [limit]
        );
        
        return rows.map((row, index) => ({
            rank: index + 1,
            userId: row.userId,
            streak: row.dailyStreak,
            lastClaim: row.lastDailyBonus
        }));
    } catch (error) {
        throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
}

async function resetExpiredStreaks() {
    try {
        const now = Date.now();
        const expiryThreshold = now - (DAILY_CONFIG.COOLDOWN * 2);
        
        const result = await db.run(
            `UPDATE userCoins
             SET dailyStreak = 0
             WHERE lastDailyBonus < ?
             AND dailyStreak > 0`,
            [expiryThreshold]
        );
        
        return result.changes || 0;
    } catch (error) {
        throw new Error(`Failed to reset streaks: ${error.message}`);
    }
}

module.exports = {
    getDailyStatus,
    calculateStreak,
    rollDailyReward,
    claimDaily,
    getDailyLeaderboard,
    resetExpiredStreaks
};