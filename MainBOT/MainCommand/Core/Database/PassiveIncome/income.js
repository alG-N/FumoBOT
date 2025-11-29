const db = require('../dbSetting');

const CONFIG = {
    BASE_COIN_RATE: 150,
    BASE_GEM_RATE: 50,
    COIN_UPDATE_INTERVAL: 5000,
    BOOST_CLEANUP_INTERVAL: 60000,
    DAILY_QUEST_TARGET: 1000000,
    DAILY_QUEST_ID: 'coins_1m'
};

/**
 * Remove all expired boosts from the database
 * @param {number} currentTime - Current timestamp in milliseconds
 * @returns {Promise<void>}
 */
function removeExpiredBoosts(currentTime) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM activeBoosts WHERE expiresAt IS NOT NULL AND expiresAt <= ?`,
            [currentTime],
            (err) => {
                if (err) {
                    console.error("❌ Error removing expired boosts:", err.message);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Fetch all active boosts for a user
 * @param {string} userId - User ID
 * @param {number} currentTime - Current timestamp
 * @returns {Promise<Array>}
 */
function getActiveBoosts(userId, currentTime) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT type, multiplier, source 
             FROM activeBoosts
             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, currentTime],
            (err, rows) => {
                if (err) {
                    console.error(`❌ Error fetching boosts for user ${userId}:`, err.message);
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            }
        );
    });
}

/**
 * Get all users who have registered for income
 * @returns {Promise<Array>}
 */
function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.all(`SELECT userId FROM userCoins`, (err, rows) => {
            if (err) {
                console.error("❌ Error fetching users:", err.message);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Update user's coins and gems balance
 * @param {string} userId - User ID
 * @param {number} coinsToAdd - Amount of coins to add
 * @param {number} gemsToAdd - Amount of gems to add
 * @returns {Promise<void>}
 */
function updateUserBalance(userId, coinsToAdd, gemsToAdd) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE userCoins
             SET coins = COALESCE(coins, 0) + ?, 
                 gems = COALESCE(gems, 0) + ?
             WHERE userId = ?`,
            [coinsToAdd, gemsToAdd, userId],
            (err) => {
                if (err) {
                    console.error(`❌ Error updating balance for user ${userId}:`, err.message);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Update daily quest progress for coin collection
 * @param {string} userId - User ID
 * @param {number} coinsToAdd - Amount of coins earned
 * @returns {Promise<void>}
 */
function updateQuestProgress(userId, coinsToAdd) {
    return new Promise((resolve, reject) => {
        const date = new Date().toISOString().slice(0, 10);
        const questId = CONFIG.DAILY_QUEST_ID;
        const target = CONFIG.DAILY_QUEST_TARGET;

        db.run(
            `INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(userId, questId, date) DO UPDATE SET
                 progress = MIN(dailyQuestProgress.progress + ?, ?),
                 completed = CASE 
                     WHEN dailyQuestProgress.progress + ? >= ? THEN 1
                     ELSE dailyQuestProgress.completed
                 END`,
            [userId, questId, date, coinsToAdd, 0, coinsToAdd, target, coinsToAdd, target],
            (err) => {
                if (err) {
                    console.error(`❌ Error updating quest progress for user ${userId}:`, err.message);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Calculate multipliers from active boosts
 * @param {Array} boosts - Array of boost objects
 * @returns {Object} - {coinMultiplier, gemMultiplier, coinSources, gemSources}
 */
function calculateMultipliers(boosts) {
    let coinMultiplier = 1;
    let gemMultiplier = 1;
    let coinSources = [];
    let gemSources = [];

    boosts.forEach(boost => {
        const type = boost.type.toLowerCase();
        const mult = boost.multiplier;

        if (['coin', 'income'].includes(type)) {
            coinMultiplier *= mult;
            coinSources.push(`${type}:x${mult.toFixed(2)} from [${boost.source}]`);
        }

        if (['gem', 'gems', 'income'].includes(type)) {
            gemMultiplier *= mult;
            gemSources.push(`${type}:x${mult.toFixed(2)} from [${boost.source}]`);
        }
    });

    return {
        coinMultiplier,
        gemMultiplier,
        coinSources,
        gemSources
    };
}

/**
 * Calculate income amounts based on multipliers
 * @param {number} coinMultiplier - Coin boost multiplier
 * @param {number} gemMultiplier - Gem boost multiplier
 * @returns {Object} - {coinsToAdd, gemsToAdd}
 */
function calculateIncome(coinMultiplier, gemMultiplier) {
    return {
        coinsToAdd: Math.floor(CONFIG.BASE_COIN_RATE * coinMultiplier),
        gemsToAdd: Math.floor(CONFIG.BASE_GEM_RATE * gemMultiplier)
    };
}

/**
 * Process income for a single user
 * @param {string} userId - User ID to process
 * @param {number} currentTime - Current timestamp
 */
async function processUserIncome(userId, currentTime) {
    try {
        const boosts = await getActiveBoosts(userId, currentTime);
        const { coinMultiplier, gemMultiplier } = calculateMultipliers(boosts);
        const { coinsToAdd, gemsToAdd } = calculateIncome(coinMultiplier, gemMultiplier);
        await updateUserBalance(userId, coinsToAdd, gemsToAdd);
        await updateQuestProgress(userId, coinsToAdd);
    } catch (error) {
        console.error(`❌ Error processing income for user ${userId}:`, error.message);
    }
}

/**
 * Update coins and gems for all users based on active boosts
 * Runs recursively at configured interval
 */
async function updateCoins() {
    const currentTime = Date.now();

    try {
        await removeExpiredBoosts(currentTime);

        const users = await getAllUsers();

        if (!users || users.length === 0) {
            setTimeout(updateCoins, CONFIG.COIN_UPDATE_INTERVAL);
            return;
        }

        for (const user of users) {
            await processUserIncome(user.userId, currentTime);
        }

    } catch (error) {
        console.error("❌ Critical error in updateCoins:", error.message);
    }

    setTimeout(updateCoins, CONFIG.COIN_UPDATE_INTERVAL);
}

/**
 * Clean expired boosts from the database
 * Runs recursively at configured interval
 */
function cleanExpiredBoosts() {
    const currentTime = Date.now();

    db.run(
        `DELETE FROM activeBoosts WHERE expiresAt <= ?`,
        [currentTime],
        (err) => {
            if (err) {
                console.error("❌ Error cleaning expired boosts:", err.message);
            }
        }
    );

    setTimeout(cleanExpiredBoosts, CONFIG.BOOST_CLEANUP_INTERVAL);
}

/**
 * Log active boosts for a user (for debugging)
 * @param {string} userId - User ID to check boosts for
 */
function logBoosts(userId) {
    db.all(
        `SELECT * FROM activeBoosts WHERE userId = ?`,
        [userId],
        (err, rows) => {
            if (err) {
                console.error("❌ Failed to fetch boosts:", err.message);
                return;
            }

            if (!rows || rows.length === 0) {
                console.log(`🔭 No boosts found for user ${userId}`);
            } else {
                console.log(`📦 Active boosts for user ${userId}:`);
                rows.forEach(boost => {
                    console.log(`   - ${boost.type} x${boost.multiplier} from [${boost.source}]`);
                });
            }
        }
    );
}

/**
 * Start the passive income system
 * Initializes both coin updates and boost cleanup
 * Call this when the bot is ready
 */
function startIncomeSystem() {
    console.log('🚀 Initializing income system...');
    console.log(`   - Base coin rate: ${CONFIG.BASE_COIN_RATE} per ${CONFIG.COIN_UPDATE_INTERVAL / 1000}s`);
    console.log(`   - Base gem rate: ${CONFIG.BASE_GEM_RATE} per ${CONFIG.COIN_UPDATE_INTERVAL / 1000}s`);
    console.log(`   - Boost cleanup interval: ${CONFIG.BOOST_CLEANUP_INTERVAL / 1000}s`);

    updateCoins();
    cleanExpiredBoosts();

    console.log('✅ Income system started successfully');
}

module.exports = {
    startIncomeSystem,
    updateCoins,
    cleanExpiredBoosts,
    logBoosts,
    CONFIG: Object.freeze({ ...CONFIG })
};