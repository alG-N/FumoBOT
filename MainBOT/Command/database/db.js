const { promisify } = require('util');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure cross-platform absolute path resolution
const dbDir = path.resolve(__dirname);
const dbPath = path.join(dbDir, 'fumos.db');

// Ensure the database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open the database with better error handling and options
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Database opening error:', err.message);
    process.exit(1);
  }

  console.log('✅ Connected to the fumos.db database.');

  // Optimized SQLite settings for high concurrency
  db.serialize(() => {
    db.run("PRAGMA busy_timeout = 30000;");         // Increased to 30 seconds
    db.run("PRAGMA journal_mode = WAL;", (err) => {
      if (err) {
        console.warn("⚠️ Failed to set WAL mode:", err.message);
      } else {
        console.log("ℹ️ Journal mode set to WAL.");
      }
    });
    db.run("PRAGMA synchronous = NORMAL;");         // Changed from FAST for better reliability
    db.run("PRAGMA foreign_keys = ON;");
    db.run("PRAGMA temp_store = MEMORY;");
    db.run("PRAGMA cache_size = -250000;");
    db.run("PRAGMA mmap_size = 268435456;");        // 256MB memory-mapped I/O
    db.run("PRAGMA page_size = 8192;");             // Larger page size for better performance
    db.run("PRAGMA wal_autocheckpoint = 1000;");    // Checkpoint every 1000 pages
  });
});

// Transaction queue to batch operations
class TransactionQueue {
  constructor(db) {
    this.db = db;
    this.queue = [];
    this.processing = false;
    this.batchSize = 50;
    this.flushInterval = 1000; // Flush every 1 second
    
    // Auto-flush timer
    setInterval(() => this.flush(), this.flushInterval);
  }

  add(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.flush();
      }
    });
  }

  async flush() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const batch = this.queue.splice(0, this.batchSize);
    
    this.db.serialize(() => {
      this.db.run("BEGIN TRANSACTION");
      
      batch.forEach(({ operation, resolve, reject }) => {
        try {
          operation(this.db, resolve, reject);
        } catch (err) {
          reject(err);
        }
      });
      
      this.db.run("COMMIT", (err) => {
        if (err) {
          console.error("Transaction commit error:", err);
          batch.forEach(({ reject }) => reject(err));
        }
        this.processing = false;
      });
    });
  }
}

const transactionQueue = new TransactionQueue(db);

// Enhanced runAsync with transaction batching option
async function runAsync(sql, params = [], options = {}) {
  const maxRetries = options.maxRetries || 10;
  const retryDelay = options.retryDelay || 200;
  const useBatch = options.batch || false;

  if (useBatch) {
    return transactionQueue.add((db, resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  let attempts = 0;
  while (attempts <= maxRetries) {
    try {
      return await new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve(this);
        });
      });
    } catch (err) {
      if (err.code === "SQLITE_BUSY" && attempts < maxRetries) {
        attempts++;
        const backoff = retryDelay * Math.pow(2, attempts);
        const jitter = Math.floor(Math.random() * 100);
        const waitTime = backoff + jitter;
        console.warn(`SQLITE_BUSY on attempt ${attempts}, retrying in ${waitTime}ms`);
        await new Promise(res => setTimeout(res, waitTime));
      } else {
        throw new Error(`SQL error after ${attempts} attempt(s): ${err.message}`);
      }
    }
  }
  throw new Error(`Failed to execute SQL after ${maxRetries} retries.`);
}

// Promisified versions
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);
db.runAsync = runAsync;

// Periodic WAL checkpoint to prevent it from growing too large
setInterval(() => {
  db.run("PRAGMA wal_checkpoint(PASSIVE);", (err) => {
    if (err) console.warn("WAL checkpoint warning:", err.message);
  });
}, 300000); // Every 5 minutes

module.exports = db;