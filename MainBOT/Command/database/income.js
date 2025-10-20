const db = require('./db');

// Cache for boost data to reduce DB reads
const boostCache = new Map();
const CACHE_TTL = 10000; // 10 seconds

/**
 * Get cached boosts or fetch from DB
 */
async function getCachedBoosts(userId) {
  const now = Date.now();
  const cached = boostCache.get(userId);
  
  if (cached && cached.timestamp > now - CACHE_TTL) {
    return cached.boosts;
  }
  
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT type, multiplier, source FROM activeBoosts
       WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
      [userId, now],
      (err, boosts) => {
        if (err) return reject(err);
        
        boostCache.set(userId, { boosts, timestamp: now });
        resolve(boosts);
      }
    );
  });
}

/**
 * Clean expired boosts from the database
 * Runs every 2 minutes instead of 1 minute
 */
function cleanExpiredBoosts() {
  const now = Date.now();
  db.run(`DELETE FROM activeBoosts WHERE expiresAt <= ?`, [now], (err) => {
    if (err) return console.error("❌ Error cleaning expired boosts:", err.message);
    
    // Clear cache for affected users
    boostCache.clear();
  });

  // Schedule next clean in 2 minutes
  setTimeout(cleanExpiredBoosts, 120000);
}

/**
 * Batched income update system
 */
class IncomeUpdateBatcher {
  constructor(updateInterval = 10000) { // Changed to 10 seconds
    this.updateInterval = updateInterval;
    this.isRunning = false;
  }

  async start() {
    this.isRunning = true;
    await this.processUpdates();
  }

  stop() {
    this.isRunning = false;
  }

  async processUpdates() {
    if (!this.isRunning) return;

    const now = Date.now();

    try {
      // Get all users in one query
      const users = await new Promise((resolve, reject) => {
        db.all(`SELECT userId FROM userCoins`, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      if (!users || users.length === 0) {
        setTimeout(() => this.processUpdates(), this.updateInterval);
        return;
      }

      // Batch all updates into a single transaction
      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run("BEGIN IMMEDIATE TRANSACTION", async (err) => {
            if (err) {
              console.error("Failed to begin transaction:", err);
              return reject(err);
            }

            const date = new Date().toISOString().slice(0, 10);
            const questId = "coins_1m";
            let processed = 0;

            for (const user of users) {
              const userId = user.userId;

              try {
                // Get boosts (cached)
                const boosts = await getCachedBoosts(userId);

                let coinMultiplier = 1;
                let gemMultiplier = 1;

                boosts.forEach(b => {
                  const type = b.type.toLowerCase();
                  const mult = b.multiplier;

                  if (['coin', 'income'].includes(type)) {
                    coinMultiplier *= mult;
                  }
                  if (['gem', 'gems', 'income'].includes(type)) {
                    gemMultiplier *= mult;
                  }
                });

                const coinsToAdd = Math.floor(150 * coinMultiplier);
                const gemsToAdd = Math.floor(50 * gemMultiplier);

                // Update coins/gems
                db.run(
                  `UPDATE userCoins
                   SET coins = COALESCE(coins, 0) + ?, 
                       gems = COALESCE(gems, 0) + ?
                   WHERE userId = ?`,
                  [coinsToAdd, gemsToAdd, userId],
                  (err) => {
                    if (err) console.error(`Income update error for ${userId}:`, err);
                  }
                );

                // Update quest progress
                db.run(
                  `INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(userId, questId, date) DO UPDATE SET
                     progress = MIN(dailyQuestProgress.progress + ?, 1000000),
                     completed = CASE 
                       WHEN dailyQuestProgress.progress + ? >= 1000000 THEN 1
                       ELSE dailyQuestProgress.completed
                     END`,
                  [userId, questId, date, coinsToAdd, 0, coinsToAdd, coinsToAdd],
                  (err) => {
                    if (err) console.error(`Quest update error for ${userId}:`, err);
                  }
                );

              } catch (err) {
                console.error(`Error processing income for ${userId}:`, err);
              }

              processed++;

              // Commit after processing all users
              if (processed === users.length) {
                db.run("COMMIT", (err) => {
                  if (err) {
                    console.error("Income batch commit failed:", err);
                    db.run("ROLLBACK");
                    reject(err);
                  } else {
                    console.log(`✅ Income updated for ${users.length} users`);
                    resolve();
                  }
                });
              }
            }
          });
        });
      });

    } catch (err) {
      console.error("Income update batch error:", err);
    }

    // Schedule next update
    setTimeout(() => this.processUpdates(), this.updateInterval);
  }
}

const incomeBatcher = new IncomeUpdateBatcher(60000); // 1-minute intervals

/**
 * Log active boosts for a user (for debugging)
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
 */
function startIncomeSystem() {
  incomeBatcher.start();
  cleanExpiredBoosts();
  console.log('✅ Income system started (10-second updates, batched transactions)');
}

/**
 * Stop the income system gracefully
 */
function stopIncomeSystem() {
  incomeBatcher.stop();
  console.log('🛑 Income system stopped');
}

// Graceful shutdown
process.on('SIGINT', () => {
  stopIncomeSystem();
});

process.on('SIGTERM', () => {
  stopIncomeSystem();
});

module.exports = {
  cleanExpiredBoosts,
  logBoosts,
  startIncomeSystem,
  stopIncomeSystem
};