const { get, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

const exchangeCache = new Map();

const CACHE_EXPIRY_MS = 5 * 60 * 1000;

function generateExchangeId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function storeExchangeData(userId, type, amount) {
    const exchangeId = generateExchangeId();
    const expiresAt = Date.now() + CACHE_EXPIRY_MS;
    
    const data = {
        userId,
        type,
        amount,
        expiresAt
    };
    
    try {
        await run(
            `INSERT INTO exchangeCache (exchangeId, userId, type, amount, expiresAt)
             VALUES (?, ?, ?, ?, ?)`,
            [exchangeId, userId, type, amount, expiresAt]
        );
        debugLog('EXCHANGE_CACHE', `Stored exchange ${exchangeId} in database`);
    } catch (error) {
        debugLog('EXCHANGE_CACHE', `Using in-memory cache for ${exchangeId}: ${error.message}`);
        exchangeCache.set(exchangeId, data);
    }
    
    return exchangeId;
}

async function getExchangeData(exchangeId) {
    const now = Date.now();
    
    try {
        const row = await get(
            'SELECT userId, type, amount, expiresAt FROM exchangeCache WHERE exchangeId = ?',
            [exchangeId]
        );
        
        if (row) {
            if (row.expiresAt < now) {
                await deleteExchangeData(exchangeId);
                return null;
            }
            
            debugLog('EXCHANGE_CACHE', `Retrieved exchange ${exchangeId} from database`);
            return {
                userId: row.userId,
                type: row.type,
                amount: row.amount
            };
        }
    } catch (error) {
        debugLog('EXCHANGE_CACHE', `Database retrieval failed: ${error.message}`);
    }
    
    const cached = exchangeCache.get(exchangeId);
    if (cached) {
        if (cached.expiresAt < now) {
            exchangeCache.delete(exchangeId);
            return null;
        }
        debugLog('EXCHANGE_CACHE', `Retrieved exchange ${exchangeId} from memory`);
        return {
            userId: cached.userId,
            type: cached.type,
            amount: cached.amount
        };
    }
    
    return null;
}

async function deleteExchangeData(exchangeId) {
    try {
        await run('DELETE FROM exchangeCache WHERE exchangeId = ?', [exchangeId]);
        debugLog('EXCHANGE_CACHE', `Deleted exchange ${exchangeId} from database`);
    } catch (error) {
    }
    
    exchangeCache.delete(exchangeId);
}

async function cleanupExpiredExchanges() {
    const now = Date.now();
    
    try {
        const result = await run(
            'DELETE FROM exchangeCache WHERE expiresAt < ?',
            [now]
        );
        debugLog('EXCHANGE_CACHE', `Cleaned up ${result.changes} expired exchanges from database`);
    } catch (error) {
    }
    
    let cleaned = 0;
    for (const [id, data] of exchangeCache.entries()) {
        if (data.expiresAt < now) {
            exchangeCache.delete(id);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        debugLog('EXCHANGE_CACHE', `Cleaned up ${cleaned} expired exchanges from memory`);
    }
}

setInterval(cleanupExpiredExchanges, 10 * 60 * 1000);

module.exports = {
    storeExchangeData,
    getExchangeData,
    deleteExchangeData,
    cleanupExpiredExchanges
};