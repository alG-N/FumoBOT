const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.resolve(__dirname);
const dbPath = path.join(dbDir, 'fumos.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Database opening error:', err.message);
    process.exit(1);
  }

  console.log('✅ Connected to the fumos.db database.');

  // Recommended SQLite settings
  db.serialize(() => {
    db.run("PRAGMA busy_timeout = 15000;");
    db.run("PRAGMA journal_mode = WAL;", (err) => {
      if (err) {
        console.warn("⚠️ Failed to set WAL mode:", err.message);
      } else {
        console.log("ℹ️ Journal mode set to WAL.");
      }
    });
    db.run("PRAGMA synchronous = FAST;");            // Fastest writes (less safe) // Normal is alright
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA temp_store = MEMORY;");          // Use RAM for temp data
    db.run("PRAGMA cache_size = -250000;");         // ~250MB cache in RAM
    db.run("PRAGMA wal_checkpoint(FULL);");
  });
});

module.exports = db;
