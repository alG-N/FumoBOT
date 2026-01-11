/**
 * Administrator Database
 * Separate SQLite database for server administration features
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'admin.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ [AdminDB] Failed to connect:', err.message);
    } else {
        console.log('✅ [AdminDB] Connected to admin.db');
    }
});

// Enable WAL mode for better performance
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA foreign_keys = ON');

// ═══════════════════════════════════════════════════════════════
// SCHEMA INITIALIZATION
// ═══════════════════════════════════════════════════════════════

function initializeSchema() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Guild Settings Table
            db.run(`
                CREATE TABLE IF NOT EXISTS guildSettings (
                    guildId TEXT PRIMARY KEY,
                    snipe_limit INTEGER DEFAULT 10,
                    announcement_channel TEXT,
                    log_channel TEXT,
                    admin_roles TEXT DEFAULT '[]',
                    mod_roles TEXT DEFAULT '[]',
                    mute_role TEXT,
                    auto_mod_enabled INTEGER DEFAULT 0,
                    welcome_channel TEXT,
                    welcome_message TEXT,
                    goodbye_channel TEXT,
                    goodbye_message TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                )
            `, (err) => {
                if (err) console.error('❌ [AdminDB] guildSettings table error:', err.message);
            });

            // Moderation Logs Table (optional - for persistent logging)
            db.run(`
                CREATE TABLE IF NOT EXISTS moderationLogs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    guildId TEXT NOT NULL,
                    action TEXT NOT NULL,
                    targetId TEXT NOT NULL,
                    moderatorId TEXT NOT NULL,
                    reason TEXT,
                    duration INTEGER,
                    timestamp INTEGER NOT NULL,
                    FOREIGN KEY (guildId) REFERENCES guildSettings(guildId)
                )
            `, (err) => {
                if (err) console.error('❌ [AdminDB] moderationLogs table error:', err.message);
            });

            // Create indexes
            db.run(`CREATE INDEX IF NOT EXISTS idx_modlogs_guild ON moderationLogs(guildId)`, (err) => {
                if (err) console.error('❌ [AdminDB] Index error:', err.message);
            });

            db.run(`CREATE INDEX IF NOT EXISTS idx_modlogs_target ON moderationLogs(targetId)`, (err) => {
                if (err) console.error('❌ [AdminDB] Index error:', err.message);
                else {
                    console.log('✅ [AdminDB] Schema initialized');
                    resolve();
                }
            });
        });
    });
}

// Initialize on load
initializeSchema().catch(console.error);

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Run a query that doesn't return data
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Get a single row
 */
function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Get all matching rows
 */
function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    db,
    run,
    get,
    all,
    initializeSchema,
    DB_PATH
};
