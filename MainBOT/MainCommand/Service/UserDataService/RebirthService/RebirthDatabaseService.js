const { get, run, all, withUserLock, transaction } = require('../../../Core/database');
const { debugLog, logToDiscord, LogLevel } = require('../../../Core/logger');
const {
    REBIRTH_LEVEL_REQUIREMENT,
    canRebirth,
    getRebirthMultiplier,
    RESET_CONFIG,
    sortFumosByRarity,
    REBIRTH_MILESTONES
} = require('../../../Configuration/rebirthConfig');
const { resetLevelForRebirth } = require('../LevelService/LevelDatabaseService');

/**
 * Get user's rebirth status
 * @param {string} userId 
 * @returns {Promise<{rebirth: number, level: number, canRebirth: boolean, multiplier: number}>}
 */
async function getRebirthStatus(userId) {
    // Get rebirth from userRebirthProgress and level from userLevelProgress
    const [rebirthRow, levelRow] = await Promise.all([
        get(`SELECT rebirthCount FROM userRebirthProgress WHERE userId = ?`, [userId]),
        get(`SELECT level, exp FROM userLevelProgress WHERE userId = ?`, [userId])
    ]);
    
    const rebirth = rebirthRow?.rebirthCount || 0;
    const level = levelRow?.level || 1;
    
    return {
        rebirth,
        level,
        canRebirth: canRebirth(level),
        multiplier: getRebirthMultiplier(rebirth)
    };
}

/**
 * Get user's rarest fumos for selection
 * @param {string} userId 
 * @param {number} limit - Max fumos to return
 * @returns {Promise<Object[]>}
 */
async function getUserFumosForSelection(userId, limit = 25) {
    // Get all unique fumos from inventory
    const inventoryFumos = await all(
        `SELECT fumoName, rarity, quantity FROM userInventory 
         WHERE userId = ? AND quantity > 0
         ORDER BY quantity DESC`,
        [userId]
    );
    
    // Get fumos currently in farm
    const farmingFumos = await all(
        `SELECT fumoName, rarity, quantity FROM farmingFumos
         WHERE userId = ? AND quantity > 0`,
        [userId]
    );
    
    // Combine and deduplicate
    const fumoMap = new Map();
    
    for (const fumo of inventoryFumos) {
        fumoMap.set(fumo.fumoName, {
            fumoName: fumo.fumoName,
            rarity: fumo.rarity,
            quantity: fumo.quantity,
            location: 'inventory'
        });
    }
    
    for (const fumo of farmingFumos) {
        if (fumoMap.has(fumo.fumoName)) {
            fumoMap.get(fumo.fumoName).quantity += fumo.quantity;
            fumoMap.get(fumo.fumoName).location = 'both';
        } else {
            fumoMap.set(fumo.fumoName, {
                fumoName: fumo.fumoName,
                rarity: fumo.rarity,
                quantity: fumo.quantity,
                location: 'farming'
            });
        }
    }
    
    // Convert to array and sort by rarity
    const allFumos = Array.from(fumoMap.values());
    const sorted = sortFumosByRarity(allFumos);
    
    return sorted.slice(0, limit);
}

/**
 * Perform the rebirth reset operation
 * @param {string} userId 
 * @param {string} keepFumoName - Name of the fumo to keep (null = keep nothing)
 * @param {Object} client - Discord client for logging
 * @returns {Promise<{success: boolean, newRebirth?: number, error?: string}>}
 */
async function performRebirth(userId, keepFumoName = null, client = null) {
    return await withUserLock(userId, 'rebirth', async () => {
        // Verify eligibility
        const status = await getRebirthStatus(userId);
        if (!status.canRebirth) {
            return { 
                success: false, 
                error: 'NOT_ELIGIBLE',
                message: `You need to be Level ${REBIRTH_LEVEL_REQUIREMENT} to rebirth. Current: Level ${status.level}`
            };
        }
        
        // Get the fumo to keep (if specified)
        let keptFumo = null;
        if (keepFumoName) {
            const fumo = await get(
                `SELECT fumoName, rarity, quantity FROM userInventory 
                 WHERE userId = ? AND fumoName = ? AND quantity > 0`,
                [userId, keepFumoName]
            );
            
            if (!fumo) {
                // Check farming fumos
                const farmFumo = await get(
                    `SELECT fumoName, rarity, quantity FROM farmingFumos
                     WHERE userId = ? AND fumoName = ? AND quantity > 0`,
                    [userId, keepFumoName]
                );
                
                if (farmFumo) {
                    keptFumo = { fumoName: farmFumo.fumoName, rarity: farmFumo.rarity };
                }
            } else {
                keptFumo = { fumoName: fumo.fumoName, rarity: fumo.rarity };
            }
        }
        
        const newRebirth = status.rebirth + 1;
        const newMultiplier = getRebirthMultiplier(newRebirth);
        
        try {
            // Start the reset process
            const operations = [];
            
            // 1. Update rebirth count in userRebirthProgress and reset currency in userCoins
            operations.push({
                sql: `INSERT INTO userRebirthProgress (userId, rebirthCount, totalRebirths, lastRebirthAt)
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT(userId) DO UPDATE SET 
                        rebirthCount = ?,
                        totalRebirths = totalRebirths + 1,
                        lastRebirthAt = ?`,
                params: [userId, newRebirth, newRebirth, Date.now(), newRebirth, Date.now()]
            });
            
            operations.push({
                sql: `UPDATE userCoins SET 
                    coins = 0,
                    gems = 0,
                    spiritTokens = 0,
                    reimuPityCount = 0,
                    reimuPenalty = 0,
                    reimuStatus = 'None',
                    marisaDonationCount = 0,
                    marisaBorrowCount = 0,
                    yukariCoins = 0,
                    yukariGems = 0,
                    yukariMark = 0,
                    rollsLeft = 0,
                    luck = 0,
                    boostCharge = 0,
                    boostActive = 0
                WHERE userId = ?`,
                params: [userId]
            });
            
            // 1b. Reset level/exp in userLevelProgress table
            operations.push({
                sql: `UPDATE userLevelProgress SET level = 1, exp = 0, lastUpdated = ? WHERE userId = ?`,
                params: [Date.now(), userId]
            });
            
            // 2. Clear inventory (except kept fumo)
            operations.push({
                sql: `DELETE FROM userInventory WHERE userId = ?`,
                params: [userId]
            });
            
            // 3. Add back the kept fumo if specified
            if (keptFumo) {
                operations.push({
                    sql: `INSERT INTO userInventory (userId, fumoName, rarity, quantity, originalFumo)
                          VALUES (?, ?, ?, 1, ?)`,
                    params: [userId, keptFumo.fumoName, keptFumo.rarity, keptFumo.fumoName]
                });
            }
            
            // 4. Clear farming fumos
            operations.push({
                sql: `DELETE FROM farmingFumos WHERE userId = ?`,
                params: [userId]
            });
            
            // 5. Reset buildings
            operations.push({
                sql: `UPDATE userBuildings SET 
                    coinBoostLevel = 0,
                    gemBoostLevel = 0,
                    criticalFarmingLevel = 0,
                    eventBoostLevel = 0
                WHERE userId = ?`,
                params: [userId]
            });
            
            // 6. Clear active boosts
            operations.push({
                sql: `DELETE FROM activeBoosts WHERE userId = ?`,
                params: [userId]
            });
            
            // 7. Clear market listings (refund handled separately if needed)
            operations.push({
                sql: `DELETE FROM globalCoinMarket WHERE sellerId = ?`,
                params: [userId]
            });
            operations.push({
                sql: `DELETE FROM globalGemMarket WHERE sellerId = ?`,
                params: [userId]
            });
            
            // 8. Clear pets and eggs
            operations.push({
                sql: `DELETE FROM petInventory WHERE userId = ?`,
                params: [userId]
            });
            operations.push({
                sql: `DELETE FROM hatchingEggs WHERE userId = ?`,
                params: [userId]
            });
            
            // 9. Clear items
            operations.push({
                sql: `DELETE FROM userItems WHERE userId = ?`,
                params: [userId]
            });
            
            // 10. Clear daily/weekly quest progress (but keep achievements and main quest)
            operations.push({
                sql: `DELETE FROM dailyQuestProgress WHERE userId = ?`,
                params: [userId]
            });
            operations.push({
                sql: `DELETE FROM weeklyQuestProgress WHERE userId = ?`,
                params: [userId]
            });
            
            // 11. Clear pending trades
            operations.push({
                sql: `DELETE FROM pendingTrades WHERE senderId = ? OR receiverId = ?`,
                params: [userId, userId]
            });
            
            // Execute all operations in a transaction
            await transaction(operations);
            
            debugLog('REBIRTH', `User ${userId} performed rebirth ${newRebirth}. Kept: ${keptFumo?.fumoName || 'nothing'}`);
            
            if (client) {
                await logToDiscord(
                    client,
                    `♻️ **REBIRTH COMPLETED**\n` +
                    `User: <@${userId}>\n` +
                    `New Rebirth: ${newRebirth}\n` +
                    `New Multiplier: x${newMultiplier.toFixed(2)}\n` +
                    `Kept Fumo: ${keptFumo?.fumoName || 'None'}`,
                    null,
                    LogLevel.ACTIVITY
                );
            }
            
            return {
                success: true,
                newRebirth,
                newMultiplier,
                keptFumo: keptFumo?.fumoName || null
            };
            
        } catch (error) {
            console.error('[Rebirth] Transaction failed:', error);
            return {
                success: false,
                error: 'TRANSACTION_FAILED',
                message: 'Failed to complete rebirth. Your data has not been changed.'
            };
        }
    });
}

/**
 * Apply rebirth multiplier to earnings
 * @param {number} baseAmount - Base amount before multiplier
 * @param {number} rebirth - User's rebirth count
 * @returns {number} Amount after rebirth multiplier
 */
function applyRebirthMultiplier(baseAmount, rebirth) {
    const multiplier = getRebirthMultiplier(rebirth);
    return Math.floor(baseAmount * multiplier);
}

/**
 * Get rebirth leaderboard
 * @param {number} limit 
 * @returns {Promise<Object[]>}
 */
async function getRebirthLeaderboard(limit = 10) {
    // Join userRebirthProgress with userLevelProgress for level data
    return await all(
        `SELECT urp.userId, urp.rebirthCount as rebirth, COALESCE(ulp.level, 1) as level 
         FROM userRebirthProgress urp
         LEFT JOIN userLevelProgress ulp ON urp.userId = ulp.userId
         WHERE urp.rebirthCount > 0
         ORDER BY urp.rebirthCount DESC, COALESCE(ulp.level, 1) DESC 
         LIMIT ?`,
        [limit]
    );
}

/**
 * Get unclaimed rebirth milestones
 * @param {string} userId 
 * @returns {Promise<Object[]>} Array of unclaimed milestones
 */
async function getUnclaimedRebirthMilestones(userId) {
    const rebirthData = await getRebirthStatus(userId);
    
    // Get claimed milestone levels from database
    const claimedRows = await all(
        `SELECT milestoneRebirth FROM userRebirthMilestones WHERE userId = ?`,
        [userId]
    );
    
    const claimedLevels = claimedRows.map(r => r.milestoneRebirth);
    
    // Find unclaimed milestones that user has reached
    return REBIRTH_MILESTONES.filter(m => 
        rebirthData.rebirth >= m.rebirth && !claimedLevels.includes(m.rebirth)
    );
}

/**
 * Get claimed rebirth milestones
 * @param {string} userId 
 * @returns {Promise<number[]>} Array of claimed rebirth levels
 */
async function getClaimedRebirthMilestones(userId) {
    const claimedRows = await all(
        `SELECT milestoneRebirth FROM userRebirthMilestones WHERE userId = ?`,
        [userId]
    );
    return claimedRows.map(r => r.milestoneRebirth);
}

/**
 * Claim a rebirth milestone reward
 * @param {string} userId 
 * @param {number} milestoneRebirth 
 * @returns {Promise<{success: boolean, rewards?: Object, error?: string}>}
 */
async function claimRebirthMilestone(userId, milestoneRebirth) {
    return await withUserLock(userId, 'claimRebirthMilestone', async () => {
        const rebirthData = await getRebirthStatus(userId);
        
        // Check if user has reached this rebirth level
        if (rebirthData.rebirth < milestoneRebirth) {
            return { success: false, error: 'REBIRTH_NOT_REACHED' };
        }
        
        // Find the milestone
        const milestone = REBIRTH_MILESTONES.find(m => m.rebirth === milestoneRebirth);
        if (!milestone) {
            return { success: false, error: 'INVALID_MILESTONE' };
        }
        
        // Check if already claimed
        const claimedRows = await all(
            `SELECT milestoneRebirth FROM userRebirthMilestones WHERE userId = ?`,
            [userId]
        );
        
        const claimedLevels = claimedRows.map(r => r.milestoneRebirth);
        
        if (claimedLevels.includes(milestoneRebirth)) {
            return { success: false, error: 'ALREADY_CLAIMED' };
        }
        
        // Grant rewards
        const rewards = milestone.rewards;
        if (rewards) {
            // Ensure user has a row in userCoins first
            await run(
                `INSERT OR IGNORE INTO userCoins (userId, coins, gems, joinDate) VALUES (?, 0, 0, ?)`,
                [userId, Date.now()]
            );
            
            if (rewards.coins || rewards.gems) {
                await run(
                    `UPDATE userCoins SET 
                        coins = coins + ?,
                        gems = gems + ?
                     WHERE userId = ?`,
                    [rewards.coins || 0, rewards.gems || 0, userId]
                );
            }
        }
        
        // Mark as claimed
        await run(
            `INSERT OR IGNORE INTO userRebirthMilestones (userId, milestoneRebirth) VALUES (?, ?)`,
            [userId, milestoneRebirth]
        );
        
        debugLog('REBIRTH', `User ${userId} claimed rebirth milestone ${milestoneRebirth}: ${JSON.stringify(rewards || {})}`);
        
        return { 
            success: true, 
            rewards: rewards || { coins: 0, gems: 0 },
            milestone 
        };
    });
}

/**
 * Claim all available rebirth milestones
 * @param {string} userId 
 * @returns {Promise<{success: boolean, claimed: Object[], totalRewards: Object}>}
 */
async function claimAllRebirthMilestones(userId) {
    return await withUserLock(userId, 'claimAllRebirthMilestones', async () => {
        const [rebirthData, claimedRows] = await Promise.all([
            getRebirthStatus(userId),
            all(`SELECT milestoneRebirth FROM userRebirthMilestones WHERE userId = ?`, [userId])
        ]);
        
        const claimedLevels = new Set(claimedRows.map(r => r.milestoneRebirth));
        
        // Find all unclaimed milestones user has reached
        const unclaimed = REBIRTH_MILESTONES.filter(m => 
            rebirthData.rebirth >= m.rebirth && !claimedLevels.has(m.rebirth)
        );
        
        if (unclaimed.length === 0) {
            return { success: true, claimed: [], totalRewards: { coins: 0, gems: 0 } };
        }
        
        // Calculate total rewards
        const totalRewards = { coins: 0, gems: 0 };
        for (const m of unclaimed) {
            if (m.rewards) {
                totalRewards.coins += m.rewards.coins || 0;
                totalRewards.gems += m.rewards.gems || 0;
            }
        }
        
        // Ensure user exists
        await run(
            `INSERT OR IGNORE INTO userCoins (userId, coins, gems, joinDate) VALUES (?, 0, 0, ?)`,
            [userId, Date.now()]
        );
        
        // Grant all rewards at once
        await run(
            `UPDATE userCoins SET 
                coins = coins + ?,
                gems = gems + ?
             WHERE userId = ?`,
            [totalRewards.coins, totalRewards.gems, userId]
        );
        
        // Mark all as claimed
        const placeholders = unclaimed.map(() => '(?, ?)').join(', ');
        const values = unclaimed.flatMap(m => [userId, m.rebirth]);
        await run(
            `INSERT OR IGNORE INTO userRebirthMilestones (userId, milestoneRebirth) VALUES ${placeholders}`,
            values
        );
        
        debugLog('REBIRTH', `User ${userId} claimed ${unclaimed.length} rebirth milestones: ${JSON.stringify(totalRewards)}`);
        
        return {
            success: true,
            claimed: unclaimed,
            totalRewards
        };
    });
}

module.exports = {
    getRebirthStatus,
    getUserFumosForSelection,
    performRebirth,
    applyRebirthMultiplier,
    getRebirthLeaderboard,
    getUnclaimedRebirthMilestones,
    getClaimedRebirthMilestones,
    claimRebirthMilestone,
    claimAllRebirthMilestones
};
