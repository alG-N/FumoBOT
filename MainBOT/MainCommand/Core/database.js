const db = require('./Database/dbSetting');

const queryCache = new Map();
const CACHE_TTL = 5000;

setInterval(() => {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, { timestamp }] of queryCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            toDelete.push(key);
        }
    }
    
    toDelete.forEach(key => queryCache.delete(key));
}, 10000);

function getCacheKey(sql, params = []) {
    return `${sql}|${JSON.stringify(params)}`;
}

async function retryOperation(operation, maxRetries = 10, baseDelay = 100) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (error.code !== 'SQLITE_BUSY' || attempt === maxRetries) {
                throw error;
            }
            
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
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
    await run('BEGIN TRANSACTION');
    
    try {
        for (const { sql, params } of operations) {
            await run(sql, params);
        }
        await run('COMMIT');
    } catch (error) {
        await run('ROLLBACK').catch(() => {});
        throw error;
    }
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

module.exports = {
    get,
    all,
    run,
    transaction,
    batchInsert,
    batchUpdate,
    clearCache,
    getCacheStats,
    raw: db
};