const { all, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

async function recordExchange(userId, type, amount, taxedAmount, result, taxRate) {
    const today = new Date().toISOString().split('T')[0];

    try {
        await run(
            `INSERT INTO exchangeHistory (userId, type, amount, taxedAmount, result, taxRate, date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, type, amount, taxedAmount, result, taxRate, today]
        );
    } catch (error) {
        if (error.message.includes('no column named taxRate')) {
            await run(
                `INSERT INTO exchangeHistory (userId, type, amount, taxedAmount, result, date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, type, amount, taxedAmount, result, today]
            );
        } else {
            throw error;
        }
    }

    await run(
        `INSERT INTO userExchangeLimits (userId, date, count)
         VALUES (?, ?, 1)
         ON CONFLICT(userId, date)
         DO UPDATE SET count = count + 1`,
        [userId, today]
    );

    debugLog('EXCHANGE', `Recorded exchange for ${userId}: ${amount} ${type} -> ${result}`);
}

async function getUserHistory(userId, limit = 5) {
    const rows = await all(
        'SELECT * FROM exchangeHistory WHERE userId = ? ORDER BY rowid DESC LIMIT ?',
        [userId, limit]
    );

    return rows || [];
}

async function getUserExchangeStats(userId) {
    const rows = await all(
        'SELECT type, SUM(amount) as total FROM exchangeHistory WHERE userId = ? GROUP BY type',
        [userId]
    );

    const stats = {
        totalCoinsExchanged: 0,
        totalGemsExchanged: 0,
        totalExchanges: 0
    };

    for (const row of rows) {
        if (row.type === 'coins') {
            stats.totalCoinsExchanged = row.total;
        } else if (row.type === 'gems') {
            stats.totalGemsExchanged = row.total;
        }
        stats.totalExchanges++;
    }

    return stats;
}

async function clearOldHistory(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const result = await run(
        'DELETE FROM exchangeHistory WHERE date < ?',
        [cutoffStr]
    );

    debugLog('EXCHANGE', `Cleared ${result.changes} old exchange records`);
    return result.changes;
}

module.exports = {
    recordExchange,
    getUserHistory,
    getUserExchangeStats,
    clearOldHistory
};