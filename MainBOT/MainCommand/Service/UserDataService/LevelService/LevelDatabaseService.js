const { get, run, all, withUserLock } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');
const { 
    getLevelFromExp, 
    getExpForLevel, 
    LEVEL_MILESTONES,
    MAX_LEVEL 
} = require('../../../Configuration/levelConfig');
const { invalidateCache } = require('../BalanceService/BalanceService');

/**
 * Get user's current EXP and level info from userLevelProgress table
 * @param {string} userId 
 * @returns {Promise<{level: number, exp: number, currentExp: number, expToNext: number, progress: number}>}
 */
async function getUserLevel(userId) {
    // Get level/exp from userLevelProgress and rebirth from userCoins
    const [levelRow, rebirthRow] = await Promise.all([
        get(`SELECT level, exp FROM userLevelProgress WHERE userId = ?`, [userId]),
        get(`SELECT rebirth FROM userCoins WHERE userId = ?`, [userId])
    ]);
    
    const level = levelRow?.level || 1;
    const exp = levelRow?.exp || 0;
    const rebirth = rebirthRow?.rebirth || 0;
    
    const levelInfo = getLevelFromExp(exp);
    return {
        ...levelInfo,
        rebirth
    };
}

/**
 * Add EXP to a user and handle level ups
 * @param {string} userId 
 * @param {number} amount - EXP to add
 * @param {string} source - Source of EXP (for logging)
 * @returns {Promise<{success: boolean, levelUps: number[], newLevel: number, totalExp: number}>}
 */
async function addExp(userId, amount, source = 'unknown') {
    if (amount <= 0) {
        return { success: true, levelUps: [], newLevel: 1, totalExp: 0 };
    }
    
    return await withUserLock(userId, 'addExp', async () => {
        // Get current state from userLevelProgress
        const current = await get(
            `SELECT level, exp FROM userLevelProgress WHERE userId = ?`,
            [userId]
        );
        
        if (!current) {
            // Create user entry if doesn't exist
            await run(
                `INSERT OR IGNORE INTO userLevelProgress (userId, level, exp, totalExpEarned, lastUpdated, lastExpSource) 
                 VALUES (?, 1, ?, ?, ?, ?)`,
                [userId, amount, amount, Date.now(), source]
            );
            const newLevelInfo = getLevelFromExp(amount);
            
            // Invalidate balance cache so UI shows updated level/exp
            invalidateCache(userId);
            
            return {
                success: true,
                levelUps: newLevelInfo.level > 1 ? [newLevelInfo.level] : [],
                newLevel: newLevelInfo.level,
                totalExp: amount
            };
        }
        
        const oldExp = current.exp || 0;
        const oldLevelInfo = getLevelFromExp(oldExp);
        const newExp = oldExp + amount;
        const newLevelInfo = getLevelFromExp(newExp);
        
        // Cap at MAX_LEVEL
        const cappedLevel = Math.min(newLevelInfo.level, MAX_LEVEL);
        
        // Update userLevelProgress table
        await run(
            `UPDATE userLevelProgress SET exp = ?, level = ?, totalExpEarned = totalExpEarned + ?, lastUpdated = ?, lastExpSource = ? WHERE userId = ?`,
            [newExp, cappedLevel, amount, Date.now(), source, userId]
        );
        
        // Invalidate balance cache so UI shows updated level/exp
        invalidateCache(userId);
        
        // Track level ups
        const levelUps = [];
        for (let lvl = oldLevelInfo.level + 1; lvl <= cappedLevel; lvl++) {
            levelUps.push(lvl);
        }
        
        debugLog('LEVEL', `User ${userId} gained ${amount} EXP from ${source}. Level: ${oldLevelInfo.level} -> ${cappedLevel}`);
        
        return {
            success: true,
            levelUps,
            newLevel: cappedLevel,
            totalExp: newExp,
            oldLevel: oldLevelInfo.level
        };
    });
}

/**
 * Set user's level directly (for admin/testing)
 * @param {string} userId 
 * @param {number} level 
 */
async function setLevel(userId, level) {
    const { getTotalExpForLevel } = require('../../../Configuration/levelConfig');
    const exp = getTotalExpForLevel(level);
    
    // Check if user exists in userLevelProgress
    const existing = await get(`SELECT userId FROM userLevelProgress WHERE userId = ?`, [userId]);
    
    if (existing) {
        await run(
            `UPDATE userLevelProgress SET level = ?, exp = ?, lastUpdated = ? WHERE userId = ?`,
            [level, exp, Date.now(), userId]
        );
    } else {
        await run(
            `INSERT INTO userLevelProgress (userId, level, exp, totalExpEarned, lastUpdated) VALUES (?, ?, ?, ?, ?)`,
            [userId, level, exp, exp, Date.now()]
        );
    }
    
    // Invalidate balance cache so UI shows updated level/exp
    invalidateCache(userId);
    
    return { success: true, level, exp };
}

/**
 * Get unclaimed milestone rewards for a user
 * @param {string} userId 
 * @returns {Promise<Object[]>} Array of unclaimed milestones
 */
async function getUnclaimedMilestones(userId) {
    const userLevel = await getUserLevel(userId);
    
    // Get claimed milestone levels from database (row-based schema)
    const claimedRows = await all(
        `SELECT milestoneLevel FROM userLevelMilestones WHERE userId = ?`,
        [userId]
    );
    
    const claimedLevels = claimedRows.map(r => r.milestoneLevel);
    
    // Find unclaimed milestones that user has reached
    return LEVEL_MILESTONES.filter(m => 
        userLevel.level >= m.level && !claimedLevels.includes(m.level)
    );
}

/**
 * Claim a milestone reward
 * @param {string} userId 
 * @param {number} milestoneLevel 
 * @returns {Promise<{success: boolean, rewards?: Object, error?: string}>}
 */
async function claimMilestone(userId, milestoneLevel) {
    return await withUserLock(userId, 'claimMilestone', async () => {
        const userLevel = await getUserLevel(userId);
        
        // Check if user has reached this level
        if (userLevel.level < milestoneLevel) {
            return { success: false, error: 'LEVEL_NOT_REACHED' };
        }
        
        // Find the milestone
        const milestone = LEVEL_MILESTONES.find(m => m.level === milestoneLevel);
        if (!milestone) {
            return { success: false, error: 'INVALID_MILESTONE' };
        }
        
        // Check if already claimed (row-based schema)
        const claimedRows = await all(
            `SELECT milestoneLevel FROM userLevelMilestones WHERE userId = ?`,
            [userId]
        );
        
        const claimedLevels = claimedRows.map(r => r.milestoneLevel);
        
        if (claimedLevels.includes(milestoneLevel)) {
            return { success: false, error: 'ALREADY_CLAIMED' };
        }
        
        // Grant rewards
        const rewards = milestone.rewards;
        if (rewards.coins || rewards.gems) {
            await run(
                `UPDATE userCoins SET 
                    coins = coins + ?,
                    gems = gems + ?
                 WHERE userId = ?`,
                [rewards.coins || 0, rewards.gems || 0, userId]
            );
        }
        
        if (rewards.tickets) {
            await run(
                `UPDATE userCoins SET rollsLeft = rollsLeft + ? WHERE userId = ?`,
                [rewards.tickets, userId]
            );
        }
        
        // Mark as claimed (insert new row)
        await run(
            `INSERT OR IGNORE INTO userLevelMilestones (userId, milestoneLevel) VALUES (?, ?)`,
            [userId, milestoneLevel]
        );
        
        debugLog('LEVEL', `User ${userId} claimed milestone ${milestoneLevel}: ${JSON.stringify(rewards)}`);
        
        return { 
            success: true, 
            rewards,
            milestone 
        };
    });
}

/**
 * Claim all available milestones
 * @param {string} userId 
 * @returns {Promise<{success: boolean, claimed: Object[], totalRewards: Object}>}
 */
async function claimAllMilestones(userId) {
    const unclaimed = await getUnclaimedMilestones(userId);
    
    if (unclaimed.length === 0) {
        return { success: true, claimed: [], totalRewards: { coins: 0, gems: 0, tickets: 0 } };
    }
    
    const claimed = [];
    const totalRewards = { coins: 0, gems: 0, tickets: 0 };
    
    for (const milestone of unclaimed) {
        const result = await claimMilestone(userId, milestone.level);
        if (result.success) {
            claimed.push(milestone);
            totalRewards.coins += milestone.rewards.coins || 0;
            totalRewards.gems += milestone.rewards.gems || 0;
            totalRewards.tickets += milestone.rewards.tickets || 0;
        }
    }
    
    return { success: true, claimed, totalRewards };
}

/**
 * Get level leaderboard
 * @param {number} limit 
 * @returns {Promise<Object[]>}
 */
async function getLevelLeaderboard(limit = 10) {
    // Join userLevelProgress with userCoins to get rebirth info
    return await all(
        `SELECT ulp.userId, ulp.level, ulp.exp, COALESCE(uc.rebirth, 0) as rebirth 
         FROM userLevelProgress ulp
         LEFT JOIN userCoins uc ON ulp.userId = uc.userId
         WHERE ulp.level > 0
         ORDER BY COALESCE(uc.rebirth, 0) DESC, ulp.level DESC, ulp.exp DESC 
         LIMIT ?`,
        [limit]
    );
}

/**
 * Reset user's level and exp (for rebirth)
 * @param {string} userId 
 */
async function resetLevelForRebirth(userId) {
    await run(
        `UPDATE userLevelProgress SET level = 1, exp = 0, lastUpdated = ? WHERE userId = ?`,
        [Date.now(), userId]
    );
    
    // Invalidate balance cache so UI shows updated level/exp
    invalidateCache(userId);
}

module.exports = {
    getUserLevel,
    addExp,
    setLevel,
    getUnclaimedMilestones,
    claimMilestone,
    claimAllMilestones,
    getLevelLeaderboard,
    resetLevelForRebirth
};
