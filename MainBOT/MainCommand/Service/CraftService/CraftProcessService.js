const { run, transaction, get, all, withUserLock, atomicDeductCurrency } = require('../../Core/database');
const { clearUserCache } = require('./CraftCacheService');
const { getCraftTimer, CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const { incrementDailyCraft } = require('../../Ultility/weekly');
const {
    checkCraftDiscount,
    checkFreeCrafts,
    consumeCraftProtection
} = require('../PrayService/CharacterHandlers/SanaeHandler/SanaeBlessingService');
const { 
    checkSanaeCraftDiscount, 
    checkSanaeFreeCrafts, 
    consumeSanaeCraftProtection 
} = require('../PrayService/PrayDatabaseService');

async function getUserQueueCount(userId) {
    const result = await get(
        `SELECT COUNT(*) as count FROM craftQueue WHERE userId = ? AND claimed = 0`,
        [userId]
    );
    return result?.count || 0;
}

async function deductResources(userId, totalCoins, totalGems) {
    await run(
        `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
        [totalCoins, totalGems, userId]
    );
}

async function deductMaterials(userId, recipe, amount) {
    const operations = [];

    for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
        operations.push({
            sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            params: [reqQty * amount, userId, reqItem]
        });
    }

    await transaction(operations);
}

async function addCraftedItem(userId, itemName, amount) {
    await run(
        `INSERT INTO userInventory (userId, itemName, quantity, dateObtained) 
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
        [userId, itemName, amount, amount]
    );
}

async function addToQueue(userId, craftType, itemName, amount) {
    const queueCount = await getUserQueueCount(userId);
    
    if (queueCount >= CRAFT_CONFIG.MAX_QUEUE_SLOTS) {
        throw new Error('QUEUE_FULL');
    }

    // FIX: Pass the amount to getCraftTimer so it multiplies correctly
    const timerDuration = getCraftTimer(craftType, itemName, amount);
    const now = Date.now();
    const completesAt = now + timerDuration;

    const result = await run(
        `INSERT INTO craftQueue (userId, craftType, itemName, amount, startedAt, completesAt, claimed)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [userId, craftType, itemName, amount, now, completesAt]
    );

    return { 
        id: result.lastID,
        startedAt: now, 
        completesAt, 
        timerDuration,
        position: queueCount + 1
    };
}

async function logCraftHistory(userId, craftType, itemName, amount) {
    await run(
        `INSERT INTO craftHistory (userId, craftType, itemName, amount, craftedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, craftType, itemName, amount, Date.now()]
    );
}

async function processCraft(userId, itemName, amount, craftType, recipe, totalCoins, totalGems) {
    // FIXED: Use user lock to prevent race conditions on craft operations
    return await withUserLock(userId, 'craft_process', async () => {
        // First, atomically deduct currency to prevent double-spending
        if (totalCoins > 0 || totalGems > 0) {
            const deductResult = await atomicDeductCurrency(userId, totalCoins, totalGems);
            if (!deductResult.success) {
                throw new Error(deductResult.error);
            }
        }
        
        // Then deduct materials in a transaction
        const materialOperations = [];
        for (const [reqItem, reqQty] of Object.entries(recipe.requires)) {
            materialOperations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ? AND quantity >= ?`,
                params: [reqQty * amount, userId, reqItem, reqQty * amount]
            });
        }
        
        if (materialOperations.length > 0) {
            await transaction(materialOperations);
        }

        // FIX: Pass amount to getCraftTimer here too
        const timerDuration = getCraftTimer(craftType, itemName, amount);

        if (timerDuration > 0) {
            // Add to queue with timer
            const queueData = await addToQueue(userId, craftType, itemName, amount);
            clearUserCache(userId, craftType);
            
            return {
                queued: true,
                ...queueData
            };
        } else {
            // Instant craft
            await addCraftedItem(userId, itemName, amount);
            await logCraftHistory(userId, craftType, itemName, amount);
            clearUserCache(userId, craftType);
            incrementDailyCraft(userId);
            
            return { queued: false };
        }
    });
}

async function claimQueuedCraft(queueId, userId) {
    // Get the queue item
    const queueItem = await get(
        `SELECT * FROM craftQueue WHERE id = ? AND userId = ? AND claimed = 0`,
        [queueId, userId]
    );

    if (!queueItem) {
        throw new Error('INVALID_QUEUE_ITEM');
    }

    const now = Date.now();
    if (queueItem.completesAt > now) {
        throw new Error('NOT_READY');
    }

    // Mark as claimed
    await run(
        `UPDATE craftQueue SET claimed = 1 WHERE id = ?`,
        [queueId]
    );

    // Add items to inventory
    await addCraftedItem(userId, queueItem.itemName, queueItem.amount);
    await logCraftHistory(userId, queueItem.craftType, queueItem.itemName, queueItem.amount);
    
    clearUserCache(userId, queueItem.craftType);
    incrementDailyCraft(userId);

    return queueItem;
}

async function getQueueItems(userId) {
    return await all(
        `SELECT * FROM craftQueue 
         WHERE userId = ? AND claimed = 0 
         ORDER BY completesAt ASC`,
        [userId]
    );
}

async function getReadyQueueItems(userId) {
    const now = Date.now();
    return await all(
        `SELECT * FROM craftQueue 
         WHERE userId = ? AND claimed = 0 AND completesAt <= ?
         ORDER BY completesAt ASC`,
        [userId, now]
    );
}

async function cancelQueueItem(queueId, userId) {
    const queueItem = await get(
        `SELECT * FROM craftQueue WHERE id = ? AND userId = ? AND claimed = 0`,
        [queueId, userId]
    );

    if (!queueItem) {
        throw new Error('INVALID_QUEUE_ITEM');
    }

    // Delete from queue (no refund as resources were already deducted)
    await run(
        `DELETE FROM craftQueue WHERE id = ?`,
        [queueId]
    );

    clearUserCache(userId, queueItem.craftType);
    return queueItem;
}

async function claimAllReady(userId) {
    const readyItems = await getReadyQueueItems(userId);
    
    if (readyItems.length === 0) {
        return [];
    }

    const claimed = [];
    
    for (const item of readyItems) {
        try {
            await claimQueuedCraft(item.id, userId);
            claimed.push(item);
        } catch (error) {
            console.error(`Failed to claim item ${item.id}:`, error);
        }
    }

    return claimed;
}

async function calculateCraftCostWithBlessings(userId, baseCoinCost, baseGemCost) {
    const freeCrafts = await checkFreeCrafts(userId);
    if (freeCrafts.active) {
        return {
            coins: 0,
            gems: 0,
            freeCraftActive: true,
            discountActive: false,
            discountPercent: 0
        };
    }
    
    const discount = await checkCraftDiscount(userId);
    if (discount.active) {
        return {
            coins: Math.floor(baseCoinCost * (1 - discount.discount)),
            gems: Math.floor(baseGemCost * (1 - discount.discount)),
            freeCraftActive: false,
            discountActive: true,
            discountPercent: discount.discount * 100
        };
    }
    
    return {
        coins: baseCoinCost,
        gems: baseGemCost,
        freeCraftActive: false,
        discountActive: false,
        discountPercent: 0
    };
}

async function handleCraftFailure(userId) {
    const protection = await consumeCraftProtection(userId);
    
    if (protection.protected) {
        return {
            failed: false,
            protected: true,
            message: `🛡️ Sanae's protection nullified the craft failure! (${protection.remaining} protections remaining)`,
            remaining: protection.remaining
        };
    }
    
    return {
        failed: true,
        protected: false,
        message: null,
        remaining: 0
    };
}

async function getCraftBlessingStatus(userId) {
    const [freeCrafts, discount] = await Promise.all([
        checkFreeCrafts(userId),
        checkCraftDiscount(userId)
    ]);

    const status = [];
    
    if (freeCrafts.active) {
        const remaining = Math.ceil((freeCrafts.expiry - Date.now()) / (24 * 60 * 60 * 1000));
        status.push(`🆓 Free crafts active (${remaining}d left)`);
    }
    
    if (discount.active) {
        const remaining = Math.ceil((discount.expiry - Date.now()) / (60 * 60 * 1000));
        status.push(`🔨 ${discount.discount * 100}% discount (${remaining}h left)`);
    }
    
    return status;
}

/**
 * Calculate craft costs with Sanae bonuses applied
 */
async function calculateCraftCost(userId, baseCoinCost, baseGemCost) {
    // Check for free crafts first
    const freeCrafts = await checkSanaeFreeCrafts(userId);
    if (freeCrafts.active) {
        return {
            coinCost: 0,
            gemCost: 0,
            freeCraft: true,
            discount: 0
        };
    }

    // Check for craft discount
    const discountData = await checkSanaeCraftDiscount(userId);
    let coinCost = baseCoinCost;
    let gemCost = baseGemCost;
    
    if (discountData.active) {
        coinCost = Math.floor(baseCoinCost * (1 - discountData.discount));
        gemCost = Math.floor(baseGemCost * (1 - discountData.discount));
    }

    return {
        coinCost,
        gemCost,
        freeCraft: false,
        discount: discountData.active ? discountData.discount * 100 : 0
    };
}

/**
 * Check if craft failure should be protected by Sanae blessing
 */
async function checkCraftProtection(userId) {
    const protection = await consumeSanaeCraftProtection(userId);
    return protection;
}

/**
 * Process a craft with Sanae bonuses
 */
async function processCraftWithBonuses(userId, recipe, craftAmount = 1) {
    const results = {
        success: false,
        crafted: 0,
        failed: 0,
        protected: 0,
        costSummary: {
            coins: 0,
            gems: 0,
            freeCrafts: 0,
            discountApplied: 0
        },
        items: []
    };

    try {
        for (let i = 0; i < craftAmount; i++) {
            // Calculate cost for this craft
            const costData = await calculateCraftCost(
                userId, 
                recipe.coinCost || 0, 
                recipe.gemCost || 0
            );

            // Deduct costs if not free
            if (!costData.freeCraft) {
                await run(
                    `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
                    [costData.coinCost, costData.gemCost, userId]
                );
                results.costSummary.coins += costData.coinCost;
                results.costSummary.gems += costData.gemCost;
            } else {
                results.costSummary.freeCrafts++;
            }

            if (costData.discount > 0) {
                results.costSummary.discountApplied = costData.discount;
            }

            // Roll for craft success
            const successRate = recipe.successRate || 1.0;
            const roll = Math.random();

            if (roll <= successRate) {
                // Success
                results.crafted++;
                results.items.push({
                    name: recipe.result,
                    quantity: recipe.resultAmount || 1,
                    success: true
                });
            } else {
                // Failed - check for protection
                const protection = await checkCraftProtection(userId);
                
                if (protection.protected) {
                    // Protected from failure
                    results.protected++;
                    results.crafted++;
                    results.items.push({
                        name: recipe.result,
                        quantity: recipe.resultAmount || 1,
                        success: true,
                        wasProtected: true
                    });
                } else {
                    // Actually failed
                    results.failed++;
                    results.items.push({
                        name: recipe.result,
                        quantity: 0,
                        success: false
                    });
                }
            }
        }

        results.success = results.crafted > 0;
        return results;

    } catch (error) {
        console.error('[CraftProcess] Error processing craft:', error);
        throw error;
    }
}

/**
 * Get Sanae craft bonuses summary for a user
 */
async function getSanaeCraftBonuses(userId) {
    const [freeCrafts, discount, protection] = await Promise.all([
        checkSanaeFreeCrafts(userId),
        checkSanaeCraftDiscount(userId),
        get(`SELECT craftProtection FROM sanaeBlessings WHERE userId = ?`, [userId])
    ]);

    const now = Date.now();
    const bonuses = [];

    if (freeCrafts.active) {
        const remaining = Math.ceil((freeCrafts.expiry - now) / (60 * 60 * 1000));
        bonuses.push({
            type: 'freeCrafts',
            description: `🆓 Free Crafts (${remaining}h remaining)`,
            active: true
        });
    }

    if (discount.active) {
        const remaining = Math.ceil((discount.expiry - now) / (60 * 60 * 1000));
        bonuses.push({
            type: 'discount',
            description: `🔨 ${discount.discount * 100}% Craft Discount (${remaining}h remaining)`,
            active: true,
            value: discount.discount
        });
    }

    if (protection?.craftProtection > 0) {
        bonuses.push({
            type: 'protection',
            description: `🛡️ ${protection.craftProtection} Craft Fail Protections`,
            active: true,
            value: protection.craftProtection
        });
    }

    return bonuses;
}

module.exports = {
    processCraft,
    claimQueuedCraft,
    getQueueItems,
    getReadyQueueItems,
    cancelQueueItem,
    claimAllReady,
    getUserQueueCount,
    deductResources,
    deductMaterials,
    addCraftedItem,
    addToQueue,
    logCraftHistory,
    calculateCraftCostWithBlessings,
    handleCraftFailure,
    getCraftBlessingStatus,
    calculateCraftCost,
    checkCraftProtection,
    processCraftWithBonuses,
    getSanaeCraftBonuses
};