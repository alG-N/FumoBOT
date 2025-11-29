const { run, get, all, transaction } = require('../../Core/database');
const { SHINY_CONFIG, SELL_REWARDS } = require('../../Configuration/rarity');
const { incrementWeeklyShiny } = require('../../Ultility/weekly');
const { debugLog } = require('../../Core/logger');

async function selectAndAddFumo(userId, rarity, fumos, luck = 0) {
    debugLog('INVENTORY', `Selecting fumo for user ${userId}, rarity: ${rarity}`);
    
    const matchingFumos = fumos.filter(f => f.name.includes(rarity));
    if (matchingFumos.length === 0) {
        debugLog('INVENTORY', `No fumos found for rarity: ${rarity}`);
        return null;
    }

    const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
    
    const shinyChance = SHINY_CONFIG.BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.LUCK_BONUS);
    const alGChance = SHINY_CONFIG.ALG_BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.ALG_LUCK_BONUS);

    const isAlterGolden = Math.random() < alGChance;
    const isShiny = !isAlterGolden && Math.random() < shinyChance;

    let fumoName = fumo.name;
    if (isAlterGolden) {
        fumoName += '[🌟alG]';
        await incrementWeeklyShiny(userId);
        debugLog('INVENTORY', `alterGolden variant rolled for ${fumoName}`);
    } else if (isShiny) {
        fumoName += '[✨SHINY]';
        await incrementWeeklyShiny(userId);
        debugLog('INVENTORY', `Shiny variant rolled for ${fumoName}`);
    }

    await run(`INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`, [userId, fumoName]);

    debugLog('INVENTORY', `Added ${fumoName} to user ${userId}'s inventory`);
    return { ...fumo, rarity, name: fumoName };
}

async function selectAndAddMultipleFumos(userId, rarities, fumos, luck = 0) {
    debugLog('INVENTORY', `Batch selecting ${rarities.length} fumos for user ${userId}`);
    
    const fumosToAdd = [];
    const fumoResults = [];
    
    for (const rarity of rarities) {
        const matchingFumos = fumos.filter(f => f.name.includes(rarity));
        if (matchingFumos.length === 0) continue;

        const fumo = matchingFumos[Math.floor(Math.random() * matchingFumos.length)];
        
        const shinyChance = SHINY_CONFIG.BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.LUCK_BONUS);
        const alGChance = SHINY_CONFIG.ALG_BASE_CHANCE + (Math.min(1, luck || 0) * SHINY_CONFIG.ALG_LUCK_BONUS);

        const isAlterGolden = Math.random() < alGChance;
        const isShiny = !isAlterGolden && Math.random() < shinyChance;

        let fumoName = fumo.name;
        if (isAlterGolden) {
            fumoName += '[🌟alG]';
            await incrementWeeklyShiny(userId);
        } else if (isShiny) {
            fumoName += '[✨SHINY]';
            await incrementWeeklyShiny(userId);
        }

        fumosToAdd.push([userId, fumoName]);
        fumoResults.push({ ...fumo, rarity, name: fumoName });
    }

    if (fumosToAdd.length === 0) return [];

    const placeholders = fumosToAdd.map(() => '(?, ?)').join(', ');
    const flatParams = fumosToAdd.flat();
    
    await run(
        `INSERT INTO userInventory (userId, fumoName) VALUES ${placeholders}`,
        flatParams
    );

    debugLog('INVENTORY', `Batch inserted ${fumosToAdd.length} fumos for user ${userId}`);
    return fumoResults;
}

async function deductCoins(userId, amount) {
    debugLog('INVENTORY', `Deducting ${amount} coins from user ${userId}`);
    await run(`UPDATE userCoins SET coins = coins - ? WHERE userId = ?`, [amount, userId]);
}

async function addCoins(userId, amount) {
    debugLog('INVENTORY', `Adding ${amount} coins to user ${userId}`);
    await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [amount, userId]);
}

async function addGems(userId, amount) {
    debugLog('INVENTORY', `Adding ${amount} gems to user ${userId}`);
    await run(`UPDATE userCoins SET gems = gems + ? WHERE userId = ?`, [amount, userId]);
}

async function getUserBalance(userId) {
    const result = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );
    return result || { coins: 0, gems: 0 };
}

async function getUserInventory(userId) {
    return await all(
        `SELECT id, fumoName, quantity, rarity, dateObtained FROM userInventory WHERE userId = ? ORDER BY id DESC`,
        [userId]
    );
}

async function getFumoByName(userId, fumoName) {
    return await get(
        `SELECT id, fumoName, quantity, rarity FROM userInventory WHERE userId = ? AND fumoName = ?`,
        [userId, fumoName]
    );
}

async function removeFumo(userId, fumoName, quantity = 1) {
    const fumo = await getFumoByName(userId, fumoName);
    if (!fumo) return false;

    if (fumo.quantity > quantity) {
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
            [quantity, userId, fumoName]
        );
    } else {
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );
    }

    debugLog('INVENTORY', `Removed ${quantity}x ${fumoName} from user ${userId}`);
    return true;
}

async function sellMultipleFumos(userId, fumoList) {
    let totalCoins = 0;
    const operations = [];

    for (const { fumoName, quantity } of fumoList) {
        const fumo = await getFumoByName(userId, fumoName);
        if (!fumo || fumo.quantity < quantity) continue;

        let rarity = null;
        for (const r of Object.keys(SELL_REWARDS)) {
            const regex = new RegExp(`\\b${r}\\b`, 'i');
            if (regex.test(fumoName)) {
                rarity = r;
                break;
            }
        }

        if (!rarity || !SELL_REWARDS[rarity]) continue;

        let value = SELL_REWARDS[rarity];
        if (fumoName.includes('[🌟alG]')) {
            value *= SHINY_CONFIG.ALG_MULTIPLIER;
        } else if (fumoName.includes('[✨SHINY]')) {
            value *= SHINY_CONFIG.SHINY_MULTIPLIER;
        }

        totalCoins += value * quantity;

        if (fumo.quantity > quantity) {
            operations.push({
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
                params: [quantity, userId, fumoName]
            });
        } else {
            operations.push({
                sql: `DELETE FROM userInventory WHERE userId = ? AND fumoName = ?`,
                params: [userId, fumoName]
            });
        }
    }

    if (operations.length === 0) {
        return { success: false, totalCoinsEarned: 0 };
    }

    operations.push({
        sql: `UPDATE userCoins SET coins = coins + ? WHERE userId = ?`,
        params: [totalCoins, userId]
    });

    try {
        await transaction(operations);
        debugLog('INVENTORY', `User ${userId} sold ${fumoList.length} fumos for ${totalCoins} coins`);
        return { success: true, totalCoinsEarned: totalCoins };
    } catch (error) {
        console.error('Batch sell failed:', error);
        return { success: false, totalCoinsEarned: 0 };
    }
}

async function sellFumo(userId, fumoName, quantity = 1) {
    return await sellMultipleFumos(userId, [{ fumoName, quantity }]);
}

async function getTotalFumoCount(userId) {
    const result = await get(
        `SELECT SUM(quantity) as total FROM userInventory WHERE userId = ?`,
        [userId]
    );
    return result?.total || 0;
}

async function getFumosByRarity(userId, rarity) {
    return await all(
        `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? AND fumoName LIKE ?`,
        [userId, `%${rarity}%`]
    );
}

async function hasFumo(userId, fumoName) {
    const fumo = await getFumoByName(userId, fumoName);
    return fumo !== null;
}

async function addItem(userId, itemName, quantity = 1, itemType = 'item') {
    debugLog('INVENTORY', `Adding ${quantity}x ${itemName} to user ${userId}`);
    
    await run(
        `INSERT INTO userInventory (userId, itemName, quantity, type) 
         VALUES (?, ?, ?, ?)
         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
        [userId, itemName, quantity, itemType, quantity]
    );
}

async function removeItem(userId, itemName, quantity = 1) {
    const item = await get(
        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName]
    );

    if (!item || item.quantity < quantity) return false;

    if (item.quantity > quantity) {
        await run(
            `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
            [quantity, userId, itemName]
        );
    } else {
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, itemName]
        );
    }

    debugLog('INVENTORY', `Removed ${quantity}x ${itemName} from user ${userId}`);
    return true;
}

async function getItemQuantity(userId, itemName) {
    const item = await get(
        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName]
    );
    return item?.quantity || 0;
}

async function transferFumo(fromUserId, toUserId, fumoName, quantity = 1) {
    const fumo = await getFumoByName(fromUserId, fumoName);
    
    if (!fumo || fumo.quantity < quantity) {
        return { success: false, error: 'INSUFFICIENT_QUANTITY' };
    }

    await removeFumo(fromUserId, fumoName, quantity);

    await run(
        `INSERT INTO userInventory (userId, fumoName, quantity) 
         VALUES (?, ?, ?)
         ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
        [toUserId, fumoName, quantity, quantity]
    );

    debugLog('INVENTORY', `Transferred ${quantity}x ${fumoName} from ${fromUserId} to ${toUserId}`);
    
    return { success: true };
}

module.exports = {
    selectAndAddFumo,
    selectAndAddMultipleFumos,
    removeFumo,
    sellFumo,
    sellMultipleFumos,
    transferFumo,
    
    // Currency operations
    deductCoins,
    addCoins,
    addGems,
    getUserBalance,
    
    // Inventory queries
    getUserInventory,
    getFumoByName,
    getFumosByRarity,
    getTotalFumoCount,
    hasFumo,
    
    // Item operations
    addItem,
    removeItem,
    getItemQuantity
};