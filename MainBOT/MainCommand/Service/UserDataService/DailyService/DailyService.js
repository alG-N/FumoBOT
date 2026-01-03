const db = require('../../../Core/database');
const { DAILY_CONFIG } = require('../../../Configuration/dailyConfig');
const { logError } = require('../../../Core/logger');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

/**
 * Check if today is a weekend (Saturday or Sunday)
 */
function isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6;
}

/**
 * Get the next milestone for a given streak
 */
function getNextMilestone(streak) {
    const milestones = Object.keys(DAILY_CONFIG.MILESTONES)
        .map(Number)
        .sort((a, b) => a - b);
    
    for (const milestone of milestones) {
        if (streak < milestone) {
            return { day: milestone, ...DAILY_CONFIG.MILESTONES[milestone] };
        }
    }
    return null;
}

/**
 * Check if current streak hits a milestone
 */
function checkMilestone(streak) {
    return DAILY_CONFIG.MILESTONES[streak] || null;
}

/**
 * Calculate streak multiplier with diminishing returns
 */
function calculateStreakMultiplier(streak) {
    const { bonusPerDay, maxEffectiveStreak, maxMultiplier } = DAILY_CONFIG.STREAK_SCALING;
    const effectiveStreak = Math.min(streak, maxEffectiveStreak);
    const multiplier = 1 + (bonusPerDay * effectiveStreak);
    return Math.min(multiplier, maxMultiplier);
}

/**
 * Calculate daily rewards based on streak
 */
function calculateRewards(streak) {
    const { coins, gems, spiritTokens } = DAILY_CONFIG.BASE_REWARDS;
    const multiplier = calculateStreakMultiplier(streak);
    
    let finalCoins = Math.floor(coins * multiplier);
    let finalGems = Math.floor(gems * multiplier);
    let finalTokens = spiritTokens + Math.floor(streak / 7); // +1 token per week
    
    // Weekend bonus
    let weekendBonus = false;
    if (DAILY_CONFIG.WEEKEND_BONUS.enabled && isWeekend()) {
        finalCoins = Math.floor(finalCoins * DAILY_CONFIG.WEEKEND_BONUS.multiplier);
        finalGems = Math.floor(finalGems * DAILY_CONFIG.WEEKEND_BONUS.multiplier);
        weekendBonus = true;
    }
    
    // Lucky bonus (10% chance for double)
    let luckyBonus = false;
    if (Math.random() < DAILY_CONFIG.LUCKY_BONUS.chance) {
        finalCoins = Math.floor(finalCoins * DAILY_CONFIG.LUCKY_BONUS.multiplier);
        finalGems = Math.floor(finalGems * DAILY_CONFIG.LUCKY_BONUS.multiplier);
        luckyBonus = true;
    }
    
    return {
        coins: finalCoins,
        gems: finalGems,
        spiritTokens: finalTokens,
        multiplier: multiplier,
        weekendBonus,
        luckyBonus
    };
}

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
        const lastClaim = row.lastDailyBonus || 0;
        const timeSinceLastClaim = now - lastClaim;
        
        // Check cooldown
        if (timeSinceLastClaim < DAILY_CONFIG.COOLDOWN) {
            const timeRemaining = DAILY_CONFIG.COOLDOWN - timeSinceLastClaim;
            return {
                exists: true,
                canClaim: false,
                reason: 'ON_COOLDOWN',
                timeRemaining,
                streak: row.dailyStreak || 0,
                nextMilestone: getNextMilestone(row.dailyStreak || 0)
            };
        }
        
        // Check if streak should reset (missed more than grace period)
        let currentStreak = row.dailyStreak || 0;
        let streakWillReset = false;
        
        if (lastClaim && timeSinceLastClaim > DAILY_CONFIG.STREAK_GRACE_PERIOD) {
            streakWillReset = true;
        }
        
        return {
            exists: true,
            canClaim: true,
            streak: currentStreak,
            streakWillReset,
            lastClaim,
            timeSinceLastClaim,
            nextMilestone: getNextMilestone(currentStreak)
        };
    } catch (error) {
        throw new Error(`Failed to get daily status: ${error.message}`);
    }
}

function calculateStreak(lastClaim, currentStreak) {
    if (!lastClaim) return 1;
    
    const now = Date.now();
    const timeSince = now - lastClaim;
    
    // Reset if more than grace period
    if (timeSince > DAILY_CONFIG.STREAK_GRACE_PERIOD) {
        return 1;
    }
    
    // Continue streak if at least cooldown has passed
    if (timeSince >= DAILY_CONFIG.COOLDOWN) {
        return (currentStreak || 0) + 1;
    }
    
    return currentStreak || 1;
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
                streak: status.streak,
                nextMilestone: status.nextMilestone
            };
        }
        
        const newStreak = calculateStreak(status.lastClaim, status.streak);
        const rewards = calculateRewards(newStreak);
        const milestone = checkMilestone(newStreak);
        const now = Date.now();
        
        // Add milestone bonuses
        let milestoneReward = null;
        if (milestone) {
            rewards.coins += milestone.bonusCoins;
            rewards.gems += milestone.bonusGems;
            milestoneReward = milestone;
        }
        
        // Update user coins
        await db.run(
            `UPDATE userCoins 
             SET coins = coins + ?,
                 gems = gems + ?,
                 spiritTokens = COALESCE(spiritTokens, 0) + ?,
                 lastDailyBonus = ?,
                 dailyStreak = ?
             WHERE userId = ?`,
            [rewards.coins, rewards.gems, rewards.spiritTokens, now, newStreak, userId]
        );
        
        // Add milestone bonus item if applicable
        if (milestone && milestone.bonusItem) {
            await db.run(
                `INSERT INTO userInventory (userId, itemName, quantity, type)
                 VALUES (?, ?, ?, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                [userId, milestone.bonusItem.name, milestone.bonusItem.quantity, milestone.bonusItem.quantity]
            );
        }
        
        // Track quest progress
        try {
            await QuestMiddleware.trackDailyLogin(userId);
        } catch (e) {
            // Don't fail claim if quest tracking fails
        }
        
        return {
            success: true,
            rewards,
            streak: newStreak,
            previousStreak: status.streak,
            streakReset: status.streakWillReset && status.streak > 0,
            milestone: milestoneReward,
            nextMilestone: getNextMilestone(newStreak)
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
        const expiryThreshold = now - DAILY_CONFIG.STREAK_GRACE_PERIOD;
        
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
    calculateRewards,
    calculateStreakMultiplier,
    checkMilestone,
    getNextMilestone,
    claimDaily,
    getDailyLeaderboard,
    resetExpiredStreaks,
    isWeekend
};