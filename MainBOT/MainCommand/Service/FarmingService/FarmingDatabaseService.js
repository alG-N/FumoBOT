const { get, all, run } = require('../../Core/database');
const { debugLog } = require('../../Core/logger');

function getBaseFumoNameWithRarity(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .trim();
}

function getBaseFumoNameOnly(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim();
}

function extractTrait(fumoName) {
    if (!fumoName) return 'Base';
    if (fumoName.includes('[🌟alG]')) return 'alG';
    if (fumoName.includes('[✨SHINY]')) return 'SHINY';
    return 'Base';
}

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
    // Check if already farming this fumo
    const existing = await get(
        `SELECT id, quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
    
    if (existing) {
        await run(
            `UPDATE farmingFumos SET quantity = quantity + ? WHERE id = ?`,
            [quantity, existing.id]
        );
    } else {
        await run(
            `INSERT INTO farmingFumos (userId, fumoName, coinsPerMin, gemsPerMin, quantity) VALUES (?, ?, ?, ?, ?)`,
            [userId, fumoName, coinsPerMin, gemsPerMin, quantity]
        );
    }
    
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
    let query;
    let params;
    
    if (trait === 'Base') {
        query = `
            SELECT fumoName, SUM(quantity) as count 
            FROM userInventory 
            WHERE userId = ? 
            AND fumoName LIKE ?
            AND fumoName NOT LIKE '%[✨SHINY]%'
            AND fumoName NOT LIKE '%[🌟alG]%'
            GROUP BY fumoName
            ORDER BY fumoName
        `;
        params = [userId, `%(${rarity})%`];
    } else {
        const traitTag = trait === 'SHINY' ? '[✨SHINY]' : '[🌟alG]';
        query = `
            SELECT fumoName, SUM(quantity) as count 
            FROM userInventory 
            WHERE userId = ? 
            AND fumoName LIKE ?
            AND fumoName LIKE ?
            GROUP BY fumoName
            ORDER BY fumoName
        `;
        params = [userId, `%(${rarity})%`, `%${traitTag}%`];
    }
    
    const rows = await all(query, params);
    
    debugLog('FARMING', `[getUserInventoryByRarityAndTrait] Found ${rows.length} fumos for ${rarity}/${trait}`);
    rows.forEach(row => debugLog('FARMING', `  - ${row.fumoName} x${row.count}`));
    
    return rows;
}

async function getInventoryCountForFumo(userId, fumoName) {
    const baseWithRarity = getBaseFumoNameWithRarity(fumoName);
    
    const baseVariant = baseWithRarity;
    const shinyVariant = `${baseWithRarity}[✨SHINY]`;
    const alGVariant = `${baseWithRarity}[🌟alG]`;
    
    debugLog('FARMING', `[getInventoryCountForFumo] Looking for variants of: ${baseWithRarity}`);
    debugLog('FARMING', `  - Base: ${baseVariant}`);
    debugLog('FARMING', `  - Shiny: ${shinyVariant}`);
    debugLog('FARMING', `  - alG: ${alGVariant}`);
    
    const rows = await all(
        `SELECT fumoName, SUM(quantity) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         GROUP BY fumoName`,
        [userId, baseVariant, shinyVariant, alGVariant]
    );
    
    const totalCount = rows.reduce((sum, row) => {
        const count = parseInt(row.count) || 0;
        debugLog('FARMING', `  Found: ${row.fumoName} x${count}`);
        return sum + count;
    }, 0);
    
    debugLog('FARMING', `[getInventoryCountForFumo] Total for ${baseWithRarity}: ${totalCount}`);
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
    getInventoryCountForFumo,
    getBaseFumoNameWithRarity,
    getBaseFumoNameOnly,
    extractTrait
};