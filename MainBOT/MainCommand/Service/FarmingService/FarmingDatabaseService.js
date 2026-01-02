const { get, all, run } = require('../../Core/database');
const { debugLog } = require('../../Core/logger');

function getBaseFumoNameWithRarity(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .replace(/\[🔮GLITCHED\]/g, '')
        .replace(/\[🌀VOID\]/g, '')
        .trim();
}

function getBaseFumoNameOnly(fumoName) {
    if (!fumoName) return '';
    
    return fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .replace(/\[🔮GLITCHED\]/g, '')
        .replace(/\[🌀VOID\]/g, '')
        .replace(/\(.*?\)/g, '')
        .trim();
}

function extractTrait(fumoName) {
    if (!fumoName) return 'Base';
    if (fumoName.includes('[🌟alG]')) return 'alG';
    if (fumoName.includes('[✨SHINY]')) return 'SHINY';
    if (fumoName.includes('[🔮GLITCHED]')) return 'GLITCHED';
    if (fumoName.includes('[🌀VOID]')) return 'VOID';
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
    // First, actually remove the fumo from inventory
    const inventoryRow = await get(
        `SELECT id, quantity as invQty FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
    
    if (!inventoryRow || inventoryRow.invQty < quantity) {
        debugLog('FARMING', `[addFumoToFarm] Insufficient inventory: has ${inventoryRow?.invQty || 0}, need ${quantity}`);
        return false;
    }
    
    // Deduct from inventory
    if (inventoryRow.invQty === quantity) {
        await run(`DELETE FROM userInventory WHERE id = ?`, [inventoryRow.id]);
    } else {
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
            [quantity, inventoryRow.id]
        );
    }
    
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
    
    debugLog('FARMING', `Added ${quantity}x ${fumoName} to farm for user ${userId} (removed from inventory)`);
    return true;
}

async function removeFumoFromFarm(userId, fumoName, quantity = 1) {
    const row = await get(
        `SELECT id, quantity FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );

    if (!row) return false;

    const actualRemove = Math.min(quantity, row.quantity);
    
    // Return fumos back to inventory
    const existingInv = await get(
        `SELECT id, quantity as invQty FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
    
    // Get rarity from fumo name for inventory insert
    const rarityMatch = fumoName.match(/\((.*?)\)/);
    const rarity = rarityMatch ? rarityMatch[1] : 'Common';
    
    if (existingInv) {
        await run(
            `UPDATE userInventory SET quantity = quantity + ? WHERE id = ?`,
            [actualRemove, existingInv.id]
        );
    } else {
        await run(
            `INSERT INTO userInventory (userId, fumoName, quantity, rarity) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
            [userId, fumoName, actualRemove, rarity, actualRemove]
        );
    }

    // Remove from farm
    if (actualRemove >= row.quantity) {
        await run(
            `DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );
    } else {
        await run(
            `UPDATE farmingFumos SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
            [actualRemove, userId, fumoName]
        );
    }

    debugLog('FARMING', `Removed ${actualRemove}x ${fumoName} from farm for user ${userId} (returned to inventory)`);
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
            AND fumoName NOT LIKE '%[🔮GLITCHED]%'
            AND fumoName NOT LIKE '%[🌀VOID]%'
            GROUP BY fumoName
            ORDER BY fumoName
        `;
        params = [userId, `%(${rarity})%`];
    } else {
        // Map trait name to tag
        const traitTags = {
            'SHINY': '[✨SHINY]',
            'alG': '[🌟alG]',
            'GLITCHED': '[🔮GLITCHED]',
            'VOID': '[🌀VOID]'
        };
        const traitTag = traitTags[trait] || '[✨SHINY]';
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
    const glitchedVariant = `${baseWithRarity}[🔮GLITCHED]`;
    const voidVariant = `${baseWithRarity}[🌀VOID]`;
    
    debugLog('FARMING', `[getInventoryCountForFumo] Looking for variants of: ${baseWithRarity}`);
    debugLog('FARMING', `  - Base: ${baseVariant}`);
    debugLog('FARMING', `  - Shiny: ${shinyVariant}`);
    debugLog('FARMING', `  - alG: ${alGVariant}`);
    debugLog('FARMING', `  - GLITCHED: ${glitchedVariant}`);
    debugLog('FARMING', `  - VOID: ${voidVariant}`);
    
    const rows = await all(
        `SELECT fumoName, SUM(quantity) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )
         GROUP BY fumoName`,
        [userId, baseVariant, shinyVariant, alGVariant, glitchedVariant, voidVariant]
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

/**
 * Migrate existing farming fumos by deducting them from inventory
 * This prevents duplication where the same fumo exists in both farm and inventory
 * Should be run once on startup
 */
async function migrateExistingFarmingFumos() {
    const allFarming = await all(`SELECT DISTINCT userId, fumoName, quantity FROM farmingFumos`);
    
    if (allFarming.length === 0) {
        debugLog('FARMING', '[Migration] No farming fumos to migrate');
        return { migrated: 0, cleaned: 0 };
    }
    
    let migrated = 0;
    let cleaned = 0;
    
    for (const { userId, fumoName, quantity } of allFarming) {
        // Check if user has this fumo in inventory
        const invRow = await get(
            `SELECT id, quantity as invQty FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );
        
        if (invRow && invRow.invQty > 0) {
            const toDeduct = Math.min(quantity, invRow.invQty);
            
            if (toDeduct >= invRow.invQty) {
                // Remove entire inventory entry
                await run(`DELETE FROM userInventory WHERE id = ?`, [invRow.id]);
            } else {
                // Deduct from inventory
                await run(
                    `UPDATE userInventory SET quantity = quantity - ? WHERE id = ?`,
                    [toDeduct, invRow.id]
                );
            }
            
            debugLog('FARMING', `[Migration] Deducted ${toDeduct}x ${fumoName} from user ${userId} inventory`);
            migrated++;
            
            // If farming more than inventory had, reduce farming quantity
            if (quantity > invRow.invQty) {
                const newQty = quantity - (quantity - invRow.invQty);
                if (newQty <= 0) {
                    await run(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
                    cleaned++;
                } else {
                    await run(
                        `UPDATE farmingFumos SET quantity = ? WHERE userId = ? AND fumoName = ?`,
                        [newQty, userId, fumoName]
                    );
                }
            }
        } else {
            // No inventory entry means this is potentially a duplicate/orphan
            // Remove it from farming since they don't actually own it
            await run(`DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`, [userId, fumoName]);
            debugLog('FARMING', `[Migration] Removed orphan farming entry: ${fumoName} for user ${userId}`);
            cleaned++;
        }
    }
    
    debugLog('FARMING', `[Migration] Complete: ${migrated} migrated, ${cleaned} cleaned`);
    return { migrated, cleaned };
}

/**
 * Check if migration has been run already
 */
async function isFarmingMigrationNeeded() {
    // Check a flag in the database or a simple heuristic
    const result = await get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='farmingMigrationDone'`
    );
    return !result;
}

/**
 * Mark migration as done
 */
async function markFarmingMigrationDone() {
    await run(`CREATE TABLE IF NOT EXISTS farmingMigrationDone (id INTEGER PRIMARY KEY, migratedAt INTEGER)`);
    await run(`INSERT OR REPLACE INTO farmingMigrationDone (id, migratedAt) VALUES (1, ?)`, [Date.now()]);
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
    extractTrait,
    migrateExistingFarmingFumos,
    isFarmingMigrationNeeded,
    markFarmingMigrationDone
};