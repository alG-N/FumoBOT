const { get, run, all, withUserLock, transaction } = require('../../../Core/database');
const { debugLog, logToDiscord, LogLevel } = require('../../../Core/logger');
const {
    REBIRTH_LEVEL_REQUIREMENT,
    canRebirth,
    getRebirthMultiplier,
    RESET_CONFIG,
    sortFumosByRarity
} = require('../../../Configuration/rebirthConfig');

/**
 * Get user's rebirth status
 * @param {string} userId 
 * @returns {Promise<{rebirth: number, level: number, canRebirth: boolean, multiplier: number}>}
 */
async function getRebirthStatus(userId) {
    const row = await get(
        `SELECT rebirth, level, exp FROM userCoins WHERE userId = ?`,
        [userId]
    );
    
    if (!row) {
        return {
            rebirth: 0,
            level: 1,
            canRebirth: false,
            multiplier: 1
        };
    }
    
    const rebirth = row.rebirth || 0;
    const level = row.level || 1;
    
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
            
            // 1. Update rebirth count and reset level/exp/currency
            operations.push({
                sql: `UPDATE userCoins SET 
                    rebirth = ?,
                    level = 1,
                    exp = 0,
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
                params: [newRebirth, userId]
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
    return await all(
        `SELECT userId, rebirth, level 
         FROM userCoins 
         WHERE rebirth > 0
         ORDER BY rebirth DESC, level DESC 
         LIMIT ?`,
        [limit]
    );
}

module.exports = {
    getRebirthStatus,
    getUserFumosForSelection,
    performRebirth,
    applyRebirthMultiplier,
    getRebirthLeaderboard
};
