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

  db.serialize(() => {
    db.run("PRAGMA busy_timeout = 15000;");
    db.run("PRAGMA journal_mode = WAL;", (err) => {
      if (err) {
        console.warn("⚠️ Failed to set WAL mode:", err.message);
      } else {
        console.log("ℹ️ Journal mode set to WAL.");
      }
    });
    db.run("PRAGMA synchronous = FAST;");
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA temp_store = MEMORY;");
    db.run("PRAGMA cache_size = -250000;");
    db.run("PRAGMA wal_checkpoint(FULL);");
    db.run("PRAGMA mmap_size = 2147483648;");
    db.run("PRAGMA locking_mode = EXCLUSIVE;");
  });
});

module.exports = db;
