const { get, run } = require('../../../Core/database');

async function getUserBalance(userId, currency) {
    const row = await get(
        `SELECT ${currency} FROM userCoins WHERE userId = ?`,
        [userId]
    );
    return row ? row[currency] : null;
}

async function updateUserBalance(userId, currency, amount) {
    await run(
        `UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`,
        [amount, userId]
    );
}

async function ensureUserExists(userId) {
    const exists = await get(
        `SELECT userId FROM userCoins WHERE userId = ?`,
        [userId]
    );

    if (!exists) {
        await run(
            `INSERT INTO userCoins (userId, coins, gems, joinDate) VALUES (?, 0, 0, ?)`,
            [userId, new Date().toISOString()]
        );
    }
}

async function getUserBalances(userId) {
    await ensureUserExists(userId);
    
    const row = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );
    
    return row || { coins: 0, gems: 0 };
}

module.exports = {
    getUserBalance,
    updateUserBalance,
    ensureUserExists,
    getUserBalances
};