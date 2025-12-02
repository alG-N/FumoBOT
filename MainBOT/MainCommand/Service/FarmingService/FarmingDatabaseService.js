const { get, all, run } = require('../../Core/database');
const { debugLog } = require('../../Core/logger');

async function getFarmLimit(userId) {
    const row = await get(
        `SELECT fragmentUses FROM userUpgrades WHERE userId = ?`,
        [userId]
    );
    return row?.fragmentUses || 0;
}

async function getUserFarmingFumos(userId) {
    return await all(
        `SELECT fumoName, coinsPerMin, gemsPerMin, quantity FROM farmingFumos WHERE userId = ?`,
        [userId]
    );
}

async function addFumoToFarm(userId, fumoName, coinsPerMin, gemsPerMin, quantity = 1) {
    await run(
        `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin, quantity)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
        [userId, fumoName, coinsPerMin, gemsPerMin, quantity, quantity]
    );
    
    debugLog('FARMING', `Added ${quantity}x ${fumoName} to farm for user ${userId}`);
}

async function removeFumoFromFarm(userId, fumoName, quantity = 1) {
    const row = await get(
        `SELECT quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );

    if (!row) return false;

    if (quantity >= row.quantity) {
        await run(
            `DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );
    } else {
        await run(
            `UPDATE farmingFumos SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
            [quantity, userId, fumoName]
        );
    }

    debugLog('FARMING', `Removed ${quantity}x ${fumoName} from farm for user ${userId}`);
    return true;
}

async function clearAllFarming(userId) {
    await run(`DELETE FROM farmingFumos WHERE userId = ?`, [userId]);
    debugLog('FARMING', `Cleared all farming for user ${userId}`);
}

async function getUserInventoryFumo(userId, fumoName) {
    return await get(
        `SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
}

async function getUserInventoryByRarity(userId, rarity) {
    return await all(
        `SELECT fumoName, COUNT(*) as count FROM userInventory 
         WHERE userId = ? AND fumoName LIKE ?
         GROUP BY fumoName`,
        [userId, `%${rarity}%`]
    );
}

async function getUserInventoryByRarityAndTrait(userId, rarity, trait) {
    let traitPattern;
    
    if (trait === 'Base') {
        return await all(
            `SELECT fumoName, COUNT(*) as count FROM userInventory 
             WHERE userId = ? 
             AND fumoName LIKE ?
             AND fumoName NOT LIKE '%[✨SHINY]%'
             AND fumoName NOT LIKE '%[🌟alG]%'
             GROUP BY fumoName`,
            [userId, `%(${rarity})%`]
        );
    } else if (trait === 'SHINY') {
        traitPattern = '%[✨SHINY]%';
    } else if (trait === 'alG') {
        traitPattern = '%[🌟alG]%';
    }
    
    return await all(
        `SELECT fumoName, COUNT(*) as count FROM userInventory 
         WHERE userId = ? 
         AND fumoName LIKE ?
         AND fumoName LIKE ?
         GROUP BY fumoName`,
        [userId, `%(${rarity})%`, traitPattern]
    );
}

// Helper function to get base fumo name (without traits)
function getBaseFumoName(fumoName) {
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .trim();
}

// NEW: Get inventory count for a specific fumo INCLUDING all trait variants
async function getInventoryCountForFumo(userId, fumoName) {
    // Get base name without traits
    const baseName = getBaseFumoName(fumoName);
    
    // Count ALL variants of this fumo (base + shiny + alG)
    const rows = await all(
        `SELECT fumoName, COUNT(*) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName LIKE ? OR
             fumoName LIKE ?
         )
         GROUP BY fumoName`,
        [
            userId,
            fumoName,                              // Exact match (e.g., "Arisu(TRANSCENDENT)")
            baseName,                              // Base without traits
            `${baseName}[✨SHINY]%`,               // Shiny variant
            `${baseName}[🌟alG]%`                  // alG variant
        ]
    );
    
    // Sum up all variants
    const totalCount = rows.reduce((sum, row) => sum + (row.count || 0), 0);
    
    debugLog('FARMING', `Inventory count for ${fumoName}: ${totalCount} (including all trait variants)`);
    return totalCount;
}

async function getAllUserInventory(userId) {
    return await all(
        `SELECT fumoName, COUNT(*) as count FROM userInventory 
         WHERE userId = ?
         GROUP BY fumoName`,
        [userId]
    );
}

async function checkFumoInFarm(userId, fumoName) {
    const row = await get(
        `SELECT 1 FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
    return !!row;
}

async function replaceFarm(userId, fumoList) {
    await clearAllFarming(userId);
    
    for (const fumo of fumoList) {
        const quantity = fumo.quantity || 1;
        await addFumoToFarm(userId, fumo.fumoName, fumo.coinsPerMin, fumo.gemsPerMin, quantity);
    }
    
    const totalFumos = fumoList.reduce((sum, f) => sum + (f.quantity || 1), 0);
    debugLog('FARMING', `Replaced farm for user ${userId} with ${totalFumos} fumos (${fumoList.length} unique types)`);
}

async function updateFarmingIncome(userId, coinsAwarded, gemsAwarded) {
    await run(
        `UPDATE userCoins SET coins = COALESCE(coins, 0) + ?, gems = COALESCE(gems, 0) + ? WHERE userId = ?`,
        [coinsAwarded, gemsAwarded, userId]
    );
}

async function updateDailyQuest(userId, coinsAwarded) {
    const date = new Date().toISOString().slice(0, 10);
    await run(`
        INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
        VALUES (?, 'coins_1m', ?, ?, 0)
        ON CONFLICT(userId, questId, date) DO UPDATE SET
        progress = MIN(dailyQuestProgress.progress + ?, 1000000),
        completed = CASE WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1 ELSE 0 END
    `, [userId, date, coinsAwarded, coinsAwarded, coinsAwarded]);
}

module.exports = {
    getFarmLimit,
    getUserFarmingFumos,
    addFumoToFarm,
    removeFumoFromFarm,
    clearAllFarming,
    getUserInventoryFumo,
    getUserInventoryByRarity,
    getAllUserInventory,
    checkFumoInFarm,
    replaceFarm,
    updateFarmingIncome,
    updateDailyQuest,
    getUserInventoryByRarityAndTrait,
    getInventoryCountForFumo
};