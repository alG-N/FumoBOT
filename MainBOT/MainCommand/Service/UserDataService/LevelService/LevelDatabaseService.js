const { get, run, withUserLock } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');
const { 
    getLevelFromExp, 
    getExpForLevel, 
    LEVEL_MILESTONES,
    MAX_LEVEL 
} = require('../../../Configuration/levelConfig');

/**
 * Get user's current EXP and level info
 * @param {string} userId 
 * @returns {Promise<{level: number, exp: number, currentExp: number, expToNext: number, progress: number}>}
 */
async function getUserLevel(userId) {
    const row = await get(
        `SELECT level, exp, rebirth FROM userCoins WHERE userId = ?`,
        [userId]
    );
    
    if (!row) {
        return {
            level: 1,
            exp: 0,
            currentExp: 0,
            expToNext: 100,
            progress: 0,
            rebirth: 0
        };
    }
    
    const levelInfo = getLevelFromExp(row.exp || 0);
    return {
        ...levelInfo,
        rebirth: row.rebirth || 0
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
        // Get current state
        const current = await get(
            `SELECT level, exp, rebirth FROM userCoins WHERE userId = ?`,
            [userId]
        );
        
        if (!current) {
            // Create user entry if doesn't exist
            await run(
                `INSERT OR IGNORE INTO userCoins (userId, coins, gems, exp, level) 
                 VALUES (?, 0, 0, ?, 1)`,
                [userId, amount]
            );
            const newLevelInfo = getLevelFromExp(amount);
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
        
        // Update database
        await run(
            `UPDATE userCoins SET exp = ?, level = ? WHERE userId = ?`,
            [newExp, cappedLevel, userId]
        );
        
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
    
    await run(
        `UPDATE userCoins SET level = ?, exp = ? WHERE userId = ?`,
        [level, exp, userId]
    );
    
    return { success: true, level, exp };
}

/**
 * Get unclaimed milestone rewards for a user
 * @param {string} userId 
 * @returns {Promise<Object[]>} Array of unclaimed milestones
 */
async function getUnclaimedMilestones(userId) {
    const userLevel = await getUserLevel(userId);
    
    // Get claimed milestones from database
    const claimedRows = await get(
        `SELECT claimedMilestones FROM userLevelMilestones WHERE userId = ?`,
        [userId]
    );
    
    let claimedLevels = [];
    if (claimedRows?.claimedMilestones) {
        try {
            claimedLevels = JSON.parse(claimedRows.claimedMilestones);
        } catch (e) {
            claimedLevels = [];
        }
    }
    
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
        
        // Check if already claimed
        const claimedRows = await get(
            `SELECT claimedMilestones FROM userLevelMilestones WHERE userId = ?`,
            [userId]
        );
        
        let claimedLevels = [];
        if (claimedRows?.claimedMilestones) {
            try {
                claimedLevels = JSON.parse(claimedRows.claimedMilestones);
            } catch (e) {
                claimedLevels = [];
            }
        }
        
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
        
        // Mark as claimed
        claimedLevels.push(milestoneLevel);
        await run(
            `INSERT INTO userLevelMilestones (userId, claimedMilestones)
             VALUES (?, ?)
             ON CONFLICT(userId) DO UPDATE SET claimedMilestones = ?`,
            [userId, JSON.stringify(claimedLevels), JSON.stringify(claimedLevels)]
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
    const { all } = require('../../../Core/database');
    
    return await all(
        `SELECT userId, level, exp, rebirth 
         FROM userCoins 
         WHERE level > 0
         ORDER BY rebirth DESC, level DESC, exp DESC 
         LIMIT ?`,
        [limit]
    );
}

module.exports = {
    getUserLevel,
    addExp,
    setLevel,
    getUnclaimedMilestones,
    claimMilestone,
    claimAllMilestones,
    getLevelLeaderboard
};
