const { get, run } = require('../../../Core/database');

async function getUserInventory(userId, itemName) {
    return await get(
        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
        [userId, itemName]
    );
}

async function updateInventory(userId, itemName, quantity) {
    await run(
        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
        [quantity, userId, itemName]
    );
}

async function getUserData(userId) {
    return await get(
        `SELECT * FROM userCoins WHERE userId = ?`,
        [userId]
    );
}

async function updateUserData(userId, updates) {
    const sets = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), userId];
    
    await run(
        `UPDATE userCoins SET ${sets} WHERE userId = ?`,
        values
    );
}

async function getActiveBoost(userId, type, source) {
    return await get(
        `SELECT * FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
        [userId, type, source]
    );
}

module.exports = {
    getUserInventory,
    updateInventory,
    getUserData,
    updateUserData,
    getActiveBoost
};