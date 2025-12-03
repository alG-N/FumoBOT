const { run, transaction } = require('../../Core/database');
const { clearUserCache } = require('./CraftCacheService');
const { CRAFT_CONFIG, CRAFT_TYPES } = require('../../Configuration/craftConfig');
const { incrementDailyCraft } = require('../../Ultility/weekly');

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
        `INSERT INTO userInventory (userId, itemName, quantity) 
         VALUES (?, ?, ?)
         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
        [userId, itemName, amount, amount]
    );
}

async function addToQueue(userId, craftType, itemName, amount) {
    const timerDuration = CRAFT_CONFIG.TIMER_DURATION[craftType.toUpperCase()] || 0;
    const now = Date.now();
    const completesAt = now + timerDuration;

    await run(
        `INSERT INTO craftQueue (userId, craftType, itemName, amount, startedAt, completesAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, craftType, itemName, amount, now, completesAt]
    );

    return { startedAt: now, completesAt, timerDuration };
}

async function logCraftHistory(userId, craftType, itemName, amount) {
    await run(
        `INSERT INTO craftHistory (userId, craftType, itemName, amount, craftedAt)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, craftType, itemName, amount, Date.now()]
    );
}

async function processCraft(userId, itemName, amount, craftType, recipe, totalCoins, totalGems) {
    await deductResources(userId, totalCoins, totalGems);
    await deductMaterials(userId, recipe, amount);

    const timerDuration = CRAFT_CONFIG.TIMER_DURATION[craftType.toUpperCase()] || 0;

    if (timerDuration > 0) {
        const queueData = await addToQueue(userId, craftType, itemName, amount);
        clearUserCache(userId, craftType);
        return {
            queued: true,
            ...queueData
        };
    } else {
        await addCraftedItem(userId, itemName, amount);
        await logCraftHistory(userId, craftType, itemName, amount);
        clearUserCache(userId, craftType);
        incrementDailyCraft(userId);
        return { queued: false };
    }
}

async function claimQueuedCraft(queueId, userId) {
    await run(
        `UPDATE craftQueue SET claimed = 1 WHERE id = ?`,
        [queueId]
    );

    const queue = await run(
        `SELECT * FROM craftQueue WHERE id = ?`,
        [queueId]
    );

    if (queue) {
        await addCraftedItem(userId, queue.itemName, queue.amount);
        await logCraftHistory(userId, queue.craftType, queue.itemName, queue.amount);
        clearUserCache(userId, queue.craftType);
        incrementDailyCraft(userId);
    }
}

module.exports = {
    processCraft,
    claimQueuedCraft,
    deductResources,
    deductMaterials,
    addCraftedItem,
    addToQueue,
    logCraftHistory
};