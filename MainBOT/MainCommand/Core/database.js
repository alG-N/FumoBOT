const db = require('./Database/dbSetting');

/**
 * Retry logic for SQLITE_BUSY errors
 */
async function runAsync(sql, params = [], maxRetries = 10, retryDelay = 200) {
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
                await new Promise(res => setTimeout(res, backoff + jitter));
            } else {
                throw new Error(`SQL error after ${attempts} attempts: ${err.message}`);
            }
        }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
}

/**
 * Get single row from database
 */
async function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

/**
 * Get multiple rows from database
 */
async function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Run SQL command (INSERT, UPDATE, DELETE)
 */
async function run(sql, params = []) {
    return runAsync(sql, params);
}

/**
 * Batch operations with transaction
 */
async function transaction(operations) {
    await run('BEGIN TRANSACTION');
    try {
        for (const op of operations) {
            await run(op.sql, op.params);
        }
        await run('COMMIT');
    } catch (err) {
        await run('ROLLBACK');
        throw err;
    }
}

module.exports = {
    get,
    all,
    run,
    transaction,
    raw: db
};