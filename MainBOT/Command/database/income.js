const db = require('./db');

/**
 * Clean expired boosts from the database
 * Runs recursively every minute
 */
function cleanExpiredBoosts() {
    const now = Date.now();
    db.run(`DELETE FROM activeBoosts WHERE expiresAt <= ?`, [now], (err) => {
        if (err) return console.error("❌ Error cleaning expired boosts:", err.message);
    });

    // Schedule next clean in 1 minute (60000 ms)
    setTimeout(cleanExpiredBoosts, 60000);
}

/**
 * Update coins and gems for all users based on active boosts
 * Runs recursively every 5 seconds
 */
function updateCoins() {
    const now = Date.now();

    // Remove expired boosts
    db.run(`DELETE FROM activeBoosts WHERE expiresAt IS NOT NULL AND expiresAt <= ?`, [now]);

    db.all(`SELECT userId FROM userCoins`, (err, users) => {
        if (err) return console.error(err);
        if (!users || users.length === 0) return;

        users.forEach(user => {
            const userId = user.userId;

            // STEP 1: Fetch all boost multipliers
            db.all(`
                SELECT type, multiplier, source FROM activeBoosts
                WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)
            `, [userId, now], (err, boosts) => {
                if (err) return console.error(err);

                let coinMultiplier = 1;
                let gemMultiplier = 1;

                let coinSources = [];
                let gemSources = [];

                // STEP 2: Calculate multipliers
                boosts.forEach(b => {
                    const type = b.type.toLowerCase();
                    const mult = b.multiplier;

                    if (['coin', 'income'].includes(type)) {
                        coinMultiplier *= mult;
                        coinSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
                    }
                    if (['gem', 'gems', 'income'].includes(type)) {
                        gemMultiplier *= mult;
                        gemSources.push(`${type}:x${mult.toFixed(2)} from [${b.source}]`);
                    }
                });

                const coinsToAdd = Math.floor(150 * coinMultiplier);
                const gemsToAdd = Math.floor(50 * gemMultiplier);

                // STEP 3: Update balances
                db.run(`
                    UPDATE userCoins
                    SET coins = COALESCE(coins, 0) + ?, gems = COALESCE(gems, 0) + ?
                    WHERE userId = ?
                `, [coinsToAdd, gemsToAdd, userId]);

                // STEP 4: Update quest progress
                const date = new Date().toISOString().slice(0, 10);
                const questId = "coins_1m";

                db.run(`
                    INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(userId, questId, date) DO UPDATE SET
                        progress = MIN(dailyQuestProgress.progress + ?, 1000000),
                        completed = CASE 
                            WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1
                            ELSE dailyQuestProgress.completed
                        END
                `, [userId, questId, date, coinsToAdd, 0, coinsToAdd, coinsToAdd]);
            });
        });

        // Run every 5 seconds
        setTimeout(updateCoins, 5000);
    });
}

/**
 * Log active boosts for a user (for debugging)
 * @param {string} userId - User ID to check boosts for
 */
function logBoosts(userId) {
    db.all(`SELECT * FROM activeBoosts WHERE userId = ?`, [userId], (err, rows) => {
        if (err) return console.error("❌ Failed to fetch boosts:", err);
        if (!rows.length) {
            console.log(`🔭 No boosts found for user ${userId}`);
        } else {
            console.log(`📦 Active boosts for user ${userId}:`, rows);
        }
    });
}

/**
 * Start the income system
 * Call this when the bot is ready
 */
function startIncomeSystem() {
    updateCoins();
    cleanExpiredBoosts();
    console.log('✅ Income system started');
}

module.exports = {
    cleanExpiredBoosts,
    updateCoins,
    logBoosts,
    startIncomeSystem
};