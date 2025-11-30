const { get, run, all } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

async function getUserRerollData(userId) {
    const row = await get(
        `SELECT rerollCount, lastRerollReset FROM userCoins WHERE userId = ?`,
        [userId]
    );
    
    if (!row) {
        await run(
            `INSERT INTO userCoins (userId, coins, gems, rerollCount, lastRerollReset) 
             VALUES (?, 0, 0, 5, ?)`,
            [userId, Date.now()]
        );
        return { rerollCount: 5, lastRerollReset: Date.now() };
    }
    
    return {
        rerollCount: row.rerollCount || 5,
        lastRerollReset: row.lastRerollReset || Date.now()
    };
}

async function updateRerollCount(userId, newCount, resetTime) {
    await run(
        `UPDATE userCoins SET rerollCount = ?, lastRerollReset = ? WHERE userId = ?`,
        [newCount, resetTime, userId]
    );
    debugLog('SHOP', `Updated reroll count for ${userId}: ${newCount}`);
}

async function getUserCurrency(userId) {
    const row = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );
    return row || { coins: 0, gems: 0 };
}

async function deductCurrency(userId, currency, amount) {
    await run(
        `UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`,
        [amount, userId]
    );
    debugLog('SHOP', `Deducted ${amount} ${currency} from ${userId}`);
}

async function addItemToInventory(userId, itemName, quantity) {
    await run(
        `INSERT INTO userInventory (userId, itemName, quantity) 
         VALUES (?, ?, ?) 
         ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
        [userId, itemName, quantity, quantity]
    );
    debugLog('SHOP', `Added ${quantity}x ${itemName} to ${userId}'s inventory`);
}

module.exports = {
    getUserRerollData,
    updateRerollCount,
    getUserCurrency,
    deductCurrency,
    addItemToInventory
};