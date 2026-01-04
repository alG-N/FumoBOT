const db = require('./Database/dbSetting');

const queryCache = new Map();
const CACHE_TTL = 5000;
const MAX_CACHE_SIZE = 10000; // Prevent unbounded cache growth

// ========== USER LOCKS FOR RACE CONDITION PREVENTION ==========
const userLocks = new Map();
const LOCK_TIMEOUT = 30000; // 30 second max lock duration

/**
 * Acquire a lock for a user to prevent race conditions
 * @param {string} userId - User ID to lock
 * @param {string} operation - Operation name for debugging
 * @returns {Promise<Function>} Release function
 */
async function acquireUserLock(userId, operation = 'unknown') {
    const lockKey = `lock_${userId}`;
    
    // Wait for existing lock to release
    while (userLocks.has(lockKey)) {
        const existingLock = userLocks.get(lockKey);
        // Check for stale lock
        if (Date.now() - existingLock.timestamp > LOCK_TIMEOUT) {
            console.warn(`[DB] Releasing stale lock for user ${userId} (operation: ${existingLock.operation})`);
            userLocks.delete(lockKey);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Acquire lock
    userLocks.set(lockKey, { timestamp: Date.now(), operation });
    
    // Return release function
    return () => {
        userLocks.delete(lockKey);
    };
}

/**
 * Execute an operation with user lock protection
 * Prevents race conditions in currency/inventory operations
 * @param {string} userId - User ID to lock
 * @param {string} operation - Operation name for debugging
 * @param {Function} callback - Async function to execute while locked
 * @returns {Promise<any>} Result of callback
 */
async function withUserLock(userId, operation, callback) {
    const release = await acquireUserLock(userId, operation);
    try {
        return await callback();
    } finally {
        release();
    }
}

// Cache cleanup with size limit
setInterval(() => {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, { timestamp }] of queryCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            toDelete.push(key);
        }
    }
    
    toDelete.forEach(key => queryCache.delete(key));
    
    // Enforce max cache size by removing oldest entries
    if (queryCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(queryCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const removeCount = queryCache.size - MAX_CACHE_SIZE;
        for (let i = 0; i < removeCount; i++) {
            queryCache.delete(entries[i][0]);
        }
    }
}, 10000);

function getCacheKey(sql, params = []) {
    return `${sql}|${JSON.stringify(params)}`;
}

async function retryOperation(operation, maxRetries = 5, baseDelay = 50) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (error.code !== 'SQLITE_BUSY' || attempt === maxRetries) {
                throw error;
            }
            
            // OPTIMIZED: Shorter delays for faster retries (max ~1.6s total)
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 50;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`Operation failed after ${maxRetries} retries: ${lastError.message}`);
}

async function get(sql, params = [], useCache = false) {
    const cacheKey = useCache ? getCacheKey(sql, params) : null;
    
    if (useCache && queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        queryCache.delete(cacheKey);
    }
    
    const result = await retryOperation(() => 
        new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        })
    );
    
    if (useCache && cacheKey) {
        queryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
    }
    
    return result;
}

async function all(sql, params = [], useCache = false) {
    const cacheKey = useCache ? getCacheKey(sql, params) : null;
    
    if (useCache && queryCache.has(cacheKey)) {
        const cached = queryCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        queryCache.delete(cacheKey);
    }
    
    const result = await retryOperation(() =>
        new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        })
    );
    
    if (useCache && cacheKey) {
        queryCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
    }
    
    return result;
}

async function run(sql, params = []) {
    return await retryOperation(() =>
        new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) return reject(err);
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            });
        })
    );
}

async function transaction(operations) {
    // Try to start transaction - if we're already in one, SQLite will error
    // In that case, just run operations directly (they're part of parent transaction)
    let startedTransaction = false;
    
    try {
        await new Promise((resolve, reject) => {
            db.run('BEGIN IMMEDIATE', function(err) {
                if (err) {
                    // Already in transaction - that's fine, just run operations
                    if (err.message.includes('cannot start a transaction within a transaction')) {
                        resolve(false);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(true);
                }
            });
        }).then(started => { startedTransaction = started; });
        
        // Run all operations
        for (const { sql, params } of operations) {
            await run(sql, params);
        }
        
        // Only commit if we started the transaction
        if (startedTransaction) {
            await run('COMMIT');
        }
    } catch (error) {
        // Only rollback if we started the transaction
        if (startedTransaction) {
            await run('ROLLBACK').catch(() => {});
        }
        throw error;
    }
}

// ========== ATOMIC CURRENCY OPERATIONS ==========
// These prevent race conditions by using atomic SQL operations

/**
 * Atomically deduct coins if user has enough balance
 * Returns { success: true, newBalance } or { success: false, error: 'INSUFFICIENT_COINS' }
 */
async function atomicDeductCoins(userId, amount) {
    if (amount <= 0) return { success: true, newBalance: null };
    
    const result = await run(
        `UPDATE userCoins SET coins = coins - ? 
         WHERE userId = ? AND coins >= ?`,
        [amount, userId, amount]
    );
    
    if (result.changes === 0) {
        const user = await get(`SELECT coins FROM userCoins WHERE userId = ?`, [userId]);
        return { 
            success: false, 
            error: 'INSUFFICIENT_COINS',
            have: user?.coins || 0,
            need: amount
        };
    }
    
    const updated = await get(`SELECT coins FROM userCoins WHERE userId = ?`, [userId]);
    return { success: true, newBalance: updated?.coins || 0 };
}

/**
 * Atomically deduct gems if user has enough balance
 */
async function atomicDeductGems(userId, amount) {
    if (amount <= 0) return { success: true, newBalance: null };
    
    const result = await run(
        `UPDATE userCoins SET gems = gems - ? 
         WHERE userId = ? AND gems >= ?`,
        [amount, userId, amount]
    );
    
    if (result.changes === 0) {
        const user = await get(`SELECT gems FROM userCoins WHERE userId = ?`, [userId]);
        return { 
            success: false, 
            error: 'INSUFFICIENT_GEMS',
            have: user?.gems || 0,
            need: amount
        };
    }
    
    const updated = await get(`SELECT gems FROM userCoins WHERE userId = ?`, [userId]);
    return { success: true, newBalance: updated?.gems || 0 };
}

/**
 * Atomically deduct both coins and gems in a transaction
 */
async function atomicDeductCurrency(userId, coins, gems) {
    return await withUserLock(userId, 'deductCurrency', async () => {
        // First verify both balances
        const user = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
        if (!user) return { success: false, error: 'USER_NOT_FOUND' };
        if (user.coins < coins) return { success: false, error: 'INSUFFICIENT_COINS', have: user.coins, need: coins };
        if (user.gems < gems) return { success: false, error: 'INSUFFICIENT_GEMS', have: user.gems, need: gems };
        
        // Deduct in transaction
        await transaction([{
            sql: `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
            params: [coins, gems, userId]
        }]);
        
        return { success: true };
    });
}

/**
 * Atomically deduct from inventory if user has enough quantity
 * Returns { success: true } or { success: false, error: 'INSUFFICIENT_QUANTITY' }
 */
async function atomicDeductInventory(userId, itemName, quantity, isFumo = false) {
    const field = isFumo ? 'fumoName' : 'itemName';
    
    const result = await run(
        `UPDATE userInventory SET quantity = quantity - ? 
         WHERE userId = ? AND ${field} = ? AND quantity >= ?`,
        [quantity, userId, itemName, quantity]
    );
    
    if (result.changes === 0) {
        const item = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND ${field} = ?`,
            [userId, itemName]
        );
        return { 
            success: false, 
            error: 'INSUFFICIENT_QUANTITY',
            have: item?.quantity || 0,
            need: quantity
        };
    }
    
    // Clean up zero quantity items
    await run(
        `DELETE FROM userInventory WHERE userId = ? AND ${field} = ? AND quantity <= 0`,
        [userId, itemName]
    );
    
    return { success: true };
}

/**
 * Safe transfer of items between users with validation
 * Uses transaction to ensure atomicity
 */
async function atomicTransferItem(fromUserId, toUserId, itemName, quantity, rarity = null, isFumo = false) {
    // Prevent trading untradable items (badges)
    if (!isFumo && itemName && itemName.includes('Badge')) {
        return {
            success: false,
            error: 'UNTRADABLE_ITEM',
            message: 'Badges cannot be traded!'
        };
    }
    
    const field = isFumo ? 'fumoName' : 'itemName';
    
    return await withUserLock(fromUserId, `transfer_${itemName}`, async () => {
        // Verify sender has item
        const senderItem = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND ${field} = ?`,
            [fromUserId, itemName]
        );
        
        if (!senderItem || senderItem.quantity < quantity) {
            return { 
                success: false, 
                error: 'INSUFFICIENT_QUANTITY',
                have: senderItem?.quantity || 0,
                need: quantity
            };
        }
        
        const operations = [
            // Deduct from sender
            {
                sql: `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND ${field} = ?`,
                params: [quantity, fromUserId, itemName]
            },
            // Add to receiver
            {
                sql: isFumo
                    ? `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)
                       ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`
                    : `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                       ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                params: isFumo 
                    ? [toUserId, itemName, quantity, rarity, quantity]
                    : [toUserId, itemName, quantity, quantity]
            },
            // Clean up zero quantity
            {
                sql: `DELETE FROM userInventory WHERE userId = ? AND ${field} = ? AND quantity <= 0`,
                params: [fromUserId, itemName]
            }
        ];
        
        await transaction(operations);
        return { success: true };
    });
}

async function batchInsert(table, rows, columns) {
    if (rows.length === 0) return;
    
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    const operations = rows.map(row => ({
        sql,
        params: columns.map(col => row[col])
    }));
    
    await transaction(operations);
}

async function batchUpdate(table, updates) {
    if (updates.length === 0) return;
    
    const operations = updates.map(({ values, where }) => {
        const setClause = Object.keys(values).map(k => `${k} = ?`).join(', ');
        const whereClause = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
        
        return {
            sql: `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`,
            params: [...Object.values(values), ...Object.values(where)]
        };
    });
    
    await transaction(operations);
}

/**
 * BATCH UPSERT - Insert or update multiple rows in single transaction
 * Critical for inventory operations with many items
 */
async function batchUpsert(table, rows, columns, conflictColumns, updateColumns) {
    if (rows.length === 0) return;
    
    const placeholders = columns.map(() => '?').join(', ');
    const conflictClause = conflictColumns.join(', ');
    const updateClause = updateColumns.map(col => `${col} = excluded.${col}`).join(', ');
    
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
                 ON CONFLICT(${conflictClause}) DO UPDATE SET ${updateClause}`;
    
    const operations = rows.map(row => ({
        sql,
        params: columns.map(col => row[col])
    }));
    
    await transaction(operations);
}

/**
 * BATCH DELETE - Delete multiple rows efficiently
 */
async function batchDelete(table, conditions) {
    if (conditions.length === 0) return;
    
    const operations = conditions.map(where => {
        const whereClause = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
        return {
            sql: `DELETE FROM ${table} WHERE ${whereClause}`,
            params: Object.values(where)
        };
    });
    
    await transaction(operations);
}

/**
 * BATCH ADD TO INVENTORY - Optimized for gacha multi-roll
 * Groups same items together for fewer DB operations
 */
async function batchAddToInventory(userId, items) {
    if (items.length === 0) return;
    
    // Group items by name for efficient batch insert
    const grouped = new Map();
    for (const item of items) {
        const key = item.fumoName || item.itemName;
        if (grouped.has(key)) {
            grouped.get(key).quantity += (item.quantity || 1);
        } else {
            grouped.set(key, {
                name: key,
                quantity: item.quantity || 1,
                rarity: item.rarity || null
            });
        }
    }
    
    const operations = [];
    for (const [name, data] of grouped) {
        if (data.rarity) {
            // Fumo with rarity
            operations.push({
                sql: `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)
                      ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
                params: [userId, name, data.quantity, data.rarity, data.quantity]
            });
        } else {
            // Item without rarity
            operations.push({
                sql: `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                      ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                params: [userId, name, data.quantity, data.quantity]
            });
        }
    }
    
    await transaction(operations);
}

/**
 * BATCH REMOVE FROM INVENTORY - Optimized for trades/crafting
 */
async function batchRemoveFromInventory(userId, items) {
    if (items.length === 0) return;
    
    const operations = [];
    
    for (const item of items) {
        const name = item.fumoName || item.itemName;
        const quantity = item.quantity || 1;
        
        // Use a single update that handles both decrement and potential delete
        operations.push({
            sql: `UPDATE userInventory SET quantity = quantity - ? 
                  WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity >= ?`,
            params: [quantity, userId, name, name, quantity]
        });
    }
    
    // Execute updates
    await transaction(operations);
    
    // Clean up zero quantity items in separate transaction
    await run(`DELETE FROM userInventory WHERE userId = ? AND quantity <= 0`, [userId]);
}

/**
 * BATCH TRANSFER INVENTORY - Atomic transfer between users (trading)
 */
async function batchTransferInventory(fromUserId, toUserId, items) {
    if (items.length === 0) return;
    
    const operations = [];
    
    for (const item of items) {
        const name = item.fumoName || item.itemName;
        const quantity = item.quantity || 1;
        const rarity = item.rarity || null;
        
        // Decrement from sender
        operations.push({
            sql: `UPDATE userInventory SET quantity = quantity - ? 
                  WHERE userId = ? AND (fumoName = ? OR itemName = ?) AND quantity >= ?`,
            params: [quantity, fromUserId, name, name, quantity]
        });
        
        // Add to receiver
        if (rarity) {
            operations.push({
                sql: `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)
                      ON CONFLICT(userId, fumoName) DO UPDATE SET quantity = quantity + ?`,
                params: [toUserId, name, quantity, rarity, quantity]
            });
        } else {
            operations.push({
                sql: `INSERT INTO userInventory (userId, itemName, quantity) VALUES (?, ?, ?)
                      ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                params: [toUserId, name, quantity, quantity]
            });
        }
    }
    
    await transaction(operations);
    
    // Clean up zero quantity items
    await run(`DELETE FROM userInventory WHERE userId = ? AND quantity <= 0`, [fromUserId]);
}

/**
 * BATCH CURRENCY UPDATE - Multiple currency operations in one transaction
 */
async function batchCurrencyUpdate(updates) {
    if (updates.length === 0) return;
    
    const operations = updates.map(({ userId, coins = 0, gems = 0, rolls = 0, tokens = 0 }) => ({
        sql: `UPDATE userCoins SET 
              coins = coins + ?,
              gems = gems + ?,
              rollsLeft = rollsLeft + ?,
              spiritTokens = COALESCE(spiritTokens, 0) + ?
              WHERE userId = ?`,
        params: [coins, gems, rolls, tokens, userId]
    }));
    
    await transaction(operations);
}

/**
 * BATCH GET USERS - Fetch multiple users in single query
 */
async function batchGetUsers(userIds, columns = '*') {
    if (userIds.length === 0) return new Map();
    
    const placeholders = userIds.map(() => '?').join(',');
    const rows = await all(
        `SELECT ${columns} FROM userCoins WHERE userId IN (${placeholders})`,
        userIds,
        true
    );
    
    const result = new Map();
    for (const row of rows) {
        result.set(row.userId, row);
    }
    return result;
}

/**
 * INVALIDATE USER CACHE - Clear cache entries for a specific user
 */
function invalidateUserCache(userId) {
    const toDelete = [];
    for (const key of queryCache.keys()) {
        if (key.includes(userId)) {
            toDelete.push(key);
        }
    }
    toDelete.forEach(key => queryCache.delete(key));
}

/**
 * BULK INSERT - Insert many rows with chunking (respects SQLite limits)
 */
async function bulkInsert(table, rows, columns) {
    if (rows.length === 0) return;
    
    // SQLite has a max of ~999 variables, chunk accordingly
    const varsPerRow = columns.length;
    const maxRowsPerChunk = Math.floor(900 / varsPerRow);
    
    for (let i = 0; i < rows.length; i += maxRowsPerChunk) {
        const chunk = rows.slice(i, i + maxRowsPerChunk);
        const placeholders = chunk.map(() => 
            `(${columns.map(() => '?').join(', ')})`
        ).join(', ');
        
        const params = chunk.flatMap(row => columns.map(col => row[col]));
        
        await run(
            `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
            params
        );
    }
}

function clearCache() {
    const size = queryCache.size;
    queryCache.clear();
    console.log(`[Database] Cleared ${size} cached queries`);
}

function getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const { timestamp } of queryCache.values()) {
        if (now - timestamp < CACHE_TTL) {
            valid++;
        } else {
            expired++;
        }
    }
    
    return {
        total: queryCache.size,
        valid,
        expired,
        ttl: CACHE_TTL
    };
}

// Add this function and call it during initialization
async function ensureSanaeColumns() {
    try {
        await run(`ALTER TABLE sanaeBlessings ADD COLUMN permanentLuckBonus REAL DEFAULT 0`);
        console.log('[DB] Added permanentLuckBonus column');
    } catch (error) {
        // Column already exists or table doesn't exist - ignore
        if (!error.message.includes('duplicate column')) {
            // Only log if it's not a duplicate column error
            // console.log('[DB] Sanae column check:', error.message);
        }
    }
}

// Call this after database is opened
// ensureSanaeColumns();

module.exports = {
    get,
    all,
    run,
    transaction,
    batchInsert,
    batchUpdate,
    batchUpsert,
    batchDelete,
    batchAddToInventory,
    batchRemoveFromInventory,
    batchTransferInventory,
    batchCurrencyUpdate,
    batchGetUsers,
    invalidateUserCache,
    bulkInsert,
    clearCache,
    getCacheStats,
    // New atomic operations for race condition prevention
    acquireUserLock,
    withUserLock,
    atomicDeductCoins,
    atomicDeductGems,
    atomicDeductCurrency,
    atomicDeductInventory,
    atomicTransferItem,
    raw: db
};