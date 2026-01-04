/**
 * Main Quest Database Service
 * 
 * Handles all database operations for the main quest system.
 * Main quest progress is PRESERVED through rebirths.
 * 
 * NOTE: Table creation is handled by Core/Database/schema.js
 */

const { withUserLock, pool } = require('../../../Core/database.js');
const { MAIN_QUESTS, getQuestById, getNextQuest, calculateQuestExp } = require('../../../Configuration/mainQuestConfig.js');

// Lazy-load LevelDatabaseService to avoid circular dependencies
let LevelDatabaseService = null;
function getLevelService() {
    if (!LevelDatabaseService) {
        LevelDatabaseService = require('../LevelService/LevelDatabaseService.js');
    }
    return LevelDatabaseService;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN QUEST PROGRESS
// ═══════════════════════════════════════════════════════════════════

/**
 * Get user's main quest progress
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getMainQuestProgress(userId) {
    return new Promise((resolve, reject) => {
        pool.get(`
            SELECT * FROM mainQuestProgress WHERE userId = ?
        `, [userId], (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (!row) {
                // Return default progress
                resolve({
                    userId,
                    currentQuestId: 1,
                    completedQuests: [],
                    questTracking: {},
                    lastUpdated: Date.now()
                });
                return;
            }
            
            resolve({
                userId: row.userId,
                currentQuestId: row.currentQuestId,
                completedQuests: JSON.parse(row.completedQuests || '[]'),
                questTracking: JSON.parse(row.questTracking || '{}'),
                lastUpdated: row.lastUpdated
            });
        });
    });
}

/**
 * Initialize or update user's main quest entry
 * @param {string} userId 
 * @returns {Promise<void>}
 */
async function initializeUserProgress(userId) {
    return new Promise((resolve, reject) => {
        pool.run(`
            INSERT OR IGNORE INTO mainQuestProgress (userId, currentQuestId, completedQuests, questTracking)
            VALUES (?, 1, '[]', '{}')
        `, [userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Update tracking for a specific action
 * @param {string} userId 
 * @param {string} trackingType - Type of action (rolls, shinies, etc.)
 * @param {number} amount - Amount to add
 * @returns {Promise<Object|null>} Returns completed quest if any
 */
async function updateTracking(userId, trackingType, amount = 1) {
    return withUserLock(userId, async () => {
        // Ensure user has progress entry
        await initializeUserProgress(userId);
        
        // Get current progress
        const progress = await getMainQuestProgress(userId);
        const currentQuest = getQuestById(progress.currentQuestId);
        
        if (!currentQuest) {
            // All quests completed
            return null;
        }
        
        // Update tracking
        const tracking = progress.questTracking;
        tracking[trackingType] = (tracking[trackingType] || 0) + amount;
        
        // Check if current quest is completed
        let completedQuest = null;
        if (checkQuestCompletion(currentQuest, tracking, progress)) {
            completedQuest = await completeQuest(userId, progress, currentQuest);
        } else {
            // Just update tracking
            await saveTracking(userId, tracking);
        }
        
        return completedQuest;
    });
}

/**
 * Track command usage
 * @param {string} userId 
 * @param {string} commandName 
 * @returns {Promise<Object|null>}
 */
async function trackCommand(userId, commandName) {
    return withUserLock(userId, async () => {
        await initializeUserProgress(userId);
        
        const progress = await getMainQuestProgress(userId);
        const currentQuest = getQuestById(progress.currentQuestId);
        
        if (!currentQuest) return null;
        
        // Check if this command is relevant to current quest
        if (currentQuest.requirement.type === 'command' && 
            currentQuest.requirement.command === commandName) {
            
            const tracking = progress.questTracking;
            const trackKey = `cmd_${commandName}`;
            tracking[trackKey] = (tracking[trackKey] || 0) + 1;
            
            // Check completion
            if (tracking[trackKey] >= currentQuest.requirement.count) {
                return await completeQuest(userId, progress, currentQuest);
            }
            
            await saveTracking(userId, tracking);
        }
        
        return null;
    });
}

/**
 * Check level-based quest completion
 * @param {string} userId 
 * @param {number} currentLevel 
 * @returns {Promise<Object|null>}
 */
async function checkLevelQuest(userId, currentLevel) {
    return withUserLock(userId, async () => {
        const progress = await getMainQuestProgress(userId);
        const currentQuest = getQuestById(progress.currentQuestId);
        
        if (!currentQuest || currentQuest.requirement.type !== 'level') {
            return null;
        }
        
        if (currentLevel >= currentQuest.requirement.count) {
            return await completeQuest(userId, progress, currentQuest);
        }
        
        return null;
    });
}

/**
 * Check rebirth-based quest completion
 * @param {string} userId 
 * @param {number} rebirthCount 
 * @returns {Promise<Object|null>}
 */
async function checkRebirthQuest(userId, rebirthCount) {
    return withUserLock(userId, async () => {
        const progress = await getMainQuestProgress(userId);
        const currentQuest = getQuestById(progress.currentQuestId);
        
        if (!currentQuest || currentQuest.requirement.type !== 'rebirth') {
            return null;
        }
        
        if (rebirthCount >= currentQuest.requirement.count) {
            return await completeQuest(userId, progress, currentQuest);
        }
        
        return null;
    });
}

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if quest requirements are met
 * @param {Object} quest 
 * @param {Object} tracking 
 * @param {Object} progress 
 * @returns {boolean}
 */
function checkQuestCompletion(quest, tracking, progress) {
    const req = quest.requirement;
    
    switch (req.type) {
        case 'command':
            const cmdKey = `cmd_${req.command}`;
            return (tracking[cmdKey] || 0) >= req.count;
            
        case 'tracking':
            return (tracking[req.trackingType] || 0) >= req.count;
            
        case 'level':
            // Level is checked separately via checkLevelQuest
            return false;
            
        case 'rebirth':
            // Rebirth is checked separately via checkRebirthQuest
            return false;
            
        default:
            return false;
    }
}

/**
 * Complete a quest and give rewards
 * @param {string} userId 
 * @param {Object} progress 
 * @param {Object} quest 
 * @returns {Promise<Object>}
 */
async function completeQuest(userId, progress, quest) {
    // Add to completed list
    const completedQuests = progress.completedQuests;
    completedQuests.push({
        questId: quest.id,
        completedAt: Date.now()
    });
    
    // Move to next quest
    const nextQuest = getNextQuest(quest.id);
    const nextQuestId = nextQuest ? nextQuest.id : quest.id; // Stay at last quest if completed
    
    // Reset tracking for new quest (keep cumulative tracking)
    const tracking = progress.questTracking;
    
    // Save progress
    await new Promise((resolve, reject) => {
        pool.run(`
            UPDATE mainQuestProgress
            SET currentQuestId = ?,
                completedQuests = ?,
                questTracking = ?,
                lastUpdated = ?
            WHERE userId = ?
        `, [
            nextQuestId,
            JSON.stringify(completedQuests),
            JSON.stringify(tracking),
            Date.now(),
            userId
        ], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    
    // Give rewards
    const rewards = quest.rewards;
    const totalExp = calculateQuestExp(quest);
    
    // Grant EXP using lazy-loaded service
    if (totalExp > 0) {
        const levelService = getLevelService();
        if (levelService) {
            await levelService.addExp(userId, totalExp, 'main_quest');
        }
    }
    
    // Grant coins/gems (through balance service or direct)
    if (rewards.coins > 0 || rewards.gems > 0) {
        await grantCurrencyRewards(userId, rewards.coins || 0, rewards.gems || 0);
    }
    
    // Grant tickets if any - REMOVED as per user request
    // Tickets no longer given as rewards
    
    return {
        quest,
        rewards: {
            exp: totalExp,
            coins: rewards.coins || 0,
            gems: rewards.gems || 0
        },
        nextQuest,
        allCompleted: !nextQuest
    };
}

/**
 * Save tracking data
 * @param {string} userId 
 * @param {Object} tracking 
 */
async function saveTracking(userId, tracking) {
    return new Promise((resolve, reject) => {
        pool.run(`
            UPDATE mainQuestProgress
            SET questTracking = ?,
                lastUpdated = ?
            WHERE userId = ?
        `, [JSON.stringify(tracking), Date.now(), userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Grant currency rewards
 * @param {string} userId 
 * @param {number} coins 
 * @param {number} gems 
 */
async function grantCurrencyRewards(userId, coins, gems) {
    return new Promise((resolve, reject) => {
        pool.run(`
            UPDATE userCoins
            SET coins = coins + ?,
                gems = gems + ?
            WHERE userId = ?
        `, [coins, gems, userId], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Get completion stats for user
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getCompletionStats(userId) {
    const progress = await getMainQuestProgress(userId);
    const totalQuests = MAIN_QUESTS.length;
    const completedCount = progress.completedQuests.length;
    
    return {
        completed: completedCount,
        total: totalQuests,
        percentage: ((completedCount / totalQuests) * 100).toFixed(1),
        currentQuest: getQuestById(progress.currentQuestId),
        allCompleted: completedCount >= totalQuests
    };
}

/**
 * Get progress toward current quest
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getCurrentQuestProgress(userId) {
    const progress = await getMainQuestProgress(userId);
    const quest = getQuestById(progress.currentQuestId);
    
    if (!quest) {
        return { completed: true, progress: 1, required: 1 };
    }
    
    const tracking = progress.questTracking;
    const req = quest.requirement;
    let current = 0;
    
    switch (req.type) {
        case 'command':
            current = tracking[`cmd_${req.command}`] || 0;
            break;
        case 'tracking':
            current = tracking[req.trackingType] || 0;
            break;
        case 'level':
            // Need to fetch current level
            try {
                const levelService = getLevelService();
                if (levelService) {
                    const levelData = await levelService.getUserLevel(userId);
                    current = levelData.level;
                }
            } catch {
                current = 1;
            }
            break;
        case 'rebirth':
            // Need to fetch rebirth count from tracking or rebirthProgress table
            current = tracking.rebirths || 0;
            break;
    }
    
    return {
        completed: current >= req.count,
        progress: Math.min(current, req.count),
        required: req.count
    };
}

module.exports = {
    getMainQuestProgress,
    initializeUserProgress,
    updateTracking,
    trackCommand,
    checkLevelQuest,
    checkRebirthQuest,
    getCompletionStats,
    getCurrentQuestProgress
};
