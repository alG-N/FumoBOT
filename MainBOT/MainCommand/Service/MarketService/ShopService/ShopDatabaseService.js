const { get, run, all } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');
const { MAX_REROLLS } = require('../../../Configuration/shopConfig');

async function getUserRerollData(userId) {
    const row = await get(
        `SELECT rerollCount, lastRerollReset, paidRerollCount FROM userShopRerolls WHERE userId = ?`,
        [userId],
        true
    );
    
    if (!row) {
        const now = Date.now();
        await run(
            `INSERT INTO userShopRerolls (userId, rerollCount, lastRerollReset, paidRerollCount) 
             VALUES (?, ?, ?, ?)`,
            [userId, MAX_REROLLS, now, 0]
        );
        return { rerollCount: MAX_REROLLS, lastRerollReset: now, paidRerollCount: 0 };
    }
    
    return {
        rerollCount: row.rerollCount !== null ? row.rerollCount : MAX_REROLLS,
        lastRerollReset: row.lastRerollReset || Date.now(),
        paidRerollCount: row.paidRerollCount || 0
    };
}

async function updateRerollCount(userId, newCount, resetTime) {
    await run(
        `INSERT INTO userShopRerolls (userId, rerollCount, lastRerollReset, paidRerollCount)
         VALUES (?, ?, ?, 0)
         ON CONFLICT(userId) DO UPDATE SET rerollCount = ?, lastRerollReset = ?`,
        [userId, newCount, resetTime, newCount, resetTime]
    );
    debugLog('SHOP', `Updated reroll count for ${userId}: ${newCount} at ${resetTime}`);
}

async function updatePaidRerollCount(userId, paidCount) {
    await run(
        `UPDATE userShopRerolls SET paidRerollCount = ? WHERE userId = ?`,
        [paidCount, userId]
    );
    debugLog('SHOP', `Updated paid reroll count for ${userId}: ${paidCount}`);
}

async function resetPaidRerollCount(userId) {
    await run(
        `UPDATE userShopRerolls SET paidRerollCount = 0 WHERE userId = ?`,
        [userId]
    );
    debugLog('SHOP', `Reset paid reroll count for ${userId}`);
}

async function getUserCurrency(userId) {
    const row = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId],
        true
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
    updatePaidRerollCount,
    resetPaidRerollCount,
    getUserCurrency,
    deductCurrency,
    addItemToInventory
};