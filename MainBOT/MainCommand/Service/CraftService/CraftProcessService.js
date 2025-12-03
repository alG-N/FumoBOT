const { run, transaction, get, all } = require('../../Core/database');
const { clearUserCache } = require('./CraftCacheService');
const { getCraftTimer, CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const { incrementDailyCraft } = require('../../Ultility/weekly');

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
    // Deduct resources first
    await deductResources(userId, totalCoins, totalGems);
    await deductMaterials(userId, recipe, amount);

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
    logCraftHistory
};