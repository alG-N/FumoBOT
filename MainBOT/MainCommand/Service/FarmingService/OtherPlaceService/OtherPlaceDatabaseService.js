/**
 * Other Place Database Service
 * 
 * Handles database operations for the Other Place farming feature.
 */

const db = require('../../../Core/Database/dbSetting');

/**
 * Initialize the Other Place table if it doesn't exist
 */
async function initializeTable() {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS userOtherPlace (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT NOT NULL,
                fumoName TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                sentAt INTEGER NOT NULL,
                UNIQUE(userId, fumoName)
            )
        `, (err) => err ? reject(err) : resolve());
    });
}

/**
 * Get all fumos a user has in the Other Place
 * @param {string} userId 
 * @returns {Promise<Array>}
 */
async function getOtherPlaceFumos(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT fumoName, quantity, sentAt FROM userOtherPlace WHERE userId = ?`,
            [userId],
            (err, rows) => err ? reject(err) : resolve(rows || [])
        );
    });
}

/**
 * Send a fumo to the Other Place
 * @param {string} userId 
 * @param {string} fumoName 
 * @param {number} quantity 
 * @returns {Promise<void>}
 */
async function sendFumoToOtherPlace(userId, fumoName, quantity = 1) {
    const now = Date.now();
    
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Remove from regular inventory
            db.run(
                `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ? AND quantity >= ?`,
                [quantity, userId, fumoName, quantity],
                function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) return reject(new Error('Not enough fumos in inventory'));
                }
            );
            
            // Clean up zero quantity items
            db.run(
                `DELETE FROM userInventory WHERE userId = ? AND itemName = ? AND quantity <= 0`,
                [userId, fumoName]
            );
            
            // Add to Other Place
            db.run(
                `INSERT INTO userOtherPlace (userId, fumoName, quantity, sentAt)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(userId, fumoName) DO UPDATE SET
                     quantity = userOtherPlace.quantity + ?,
                     sentAt = ?`,
                [userId, fumoName, quantity, now, quantity, now],
                (err) => err ? reject(err) : resolve()
            );
        });
    });
}

/**
 * Retrieve a fumo from the Other Place
 * @param {string} userId 
 * @param {string} fumoName 
 * @param {number} quantity 
 * @returns {Promise<void>}
 */
async function retrieveFumoFromOtherPlace(userId, fumoName, quantity = 1) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Check if fumo exists in Other Place
            db.get(
                `SELECT quantity FROM userOtherPlace WHERE userId = ? AND fumoName = ?`,
                [userId, fumoName],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row || row.quantity < quantity) {
                        return reject(new Error('Not enough fumos in Other Place'));
                    }
                }
            );
            
            // Remove from Other Place
            db.run(
                `UPDATE userOtherPlace SET quantity = quantity - ? WHERE userId = ? AND fumoName = ?`,
                [quantity, userId, fumoName]
            );
            
            // Clean up empty entries
            db.run(
                `DELETE FROM userOtherPlace WHERE userId = ? AND fumoName = ? AND quantity <= 0`,
                [userId, fumoName]
            );
            
            // Add back to inventory
            db.run(
                `INSERT INTO userInventory (userId, itemName, quantity)
                 VALUES (?, ?, ?)
                 ON CONFLICT(userId, itemName) DO UPDATE SET
                     quantity = userInventory.quantity + ?`,
                [userId, fumoName, quantity, quantity],
                (err) => err ? reject(err) : resolve()
            );
        });
    });
}

/**
 * Collect income from Other Place fumos
 * @param {string} userId 
 * @param {number} efficiency - Efficiency multiplier (0.0 - 1.0)
 * @returns {Promise<{coins: number, gems: number}>}
 */
async function collectOtherPlaceIncome(userId, efficiency) {
    const { getStatsByRarity } = require('../../../Ultility/characterStats');
    const { MAX_STORAGE_TIME } = require('./OtherPlaceConfig');
    
    const fumos = await getOtherPlaceFumos(userId);
    const now = Date.now();
    
    let totalCoins = 0;
    let totalGems = 0;
    
    for (const fumo of fumos) {
        const stats = getStatsByRarity(fumo.fumoName);
        const elapsedTime = Math.min(now - fumo.sentAt, MAX_STORAGE_TIME);
        const minutes = elapsedTime / (60 * 1000);
        
        const coins = Math.floor(stats.coinsPerMin * minutes * fumo.quantity * efficiency);
        const gems = Math.floor(stats.gemsPerMin * minutes * fumo.quantity * efficiency);
        
        totalCoins += coins;
        totalGems += gems;
    }
    
    // Reset sentAt timestamps
    await new Promise((resolve, reject) => {
        db.run(
            `UPDATE userOtherPlace SET sentAt = ? WHERE userId = ?`,
            [now, userId],
            (err) => err ? reject(err) : resolve()
        );
    });
    
    // Grant income
    if (totalCoins > 0 || totalGems > 0) {
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE userCoins SET coins = coins + ?, gems = gems + ?, yukariCoins = yukariCoins + ?, yukariGems = yukariGems + ?
                 WHERE userId = ?`,
                [totalCoins, totalGems, totalCoins, totalGems, userId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }
    
    return { coins: totalCoins, gems: totalGems };
}

/**
 * Count how many fumos are in the Other Place
 * @param {string} userId 
 * @returns {Promise<number>}
 */
async function getOtherPlaceFumoCount(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT COALESCE(SUM(quantity), 0) as total FROM userOtherPlace WHERE userId = ?`,
            [userId],
            (err, row) => err ? reject(err) : resolve(row?.total || 0)
        );
    });
}

/**
 * Get pending income preview (doesn't actually collect)
 * @param {string} userId 
 * @param {number} efficiency 
 * @returns {Promise<{coins: number, gems: number, fumoCount: number}>}
 */
async function getPendingIncome(userId, efficiency) {
    const { getStatsByRarity } = require('../../../Ultility/characterStats');
    const { MAX_STORAGE_TIME } = require('./OtherPlaceConfig');
    
    const fumos = await getOtherPlaceFumos(userId);
    const now = Date.now();
    
    let totalCoins = 0;
    let totalGems = 0;
    let fumoCount = 0;
    
    for (const fumo of fumos) {
        const stats = getStatsByRarity(fumo.fumoName);
        const elapsedTime = Math.min(now - fumo.sentAt, MAX_STORAGE_TIME);
        const minutes = elapsedTime / (60 * 1000);
        
        totalCoins += Math.floor(stats.coinsPerMin * minutes * fumo.quantity * efficiency);
        totalGems += Math.floor(stats.gemsPerMin * minutes * fumo.quantity * efficiency);
        fumoCount += fumo.quantity;
    }
    
    return { coins: totalCoins, gems: totalGems, fumoCount };
}

module.exports = {
    initializeTable,
    getOtherPlaceFumos,
    sendFumoToOtherPlace,
    retrieveFumoFromOtherPlace,
    collectOtherPlaceIncome,
    getOtherPlaceFumoCount,
    getPendingIncome
};
