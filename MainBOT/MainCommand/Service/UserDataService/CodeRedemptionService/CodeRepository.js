const { get, run, all } = require('../../../Core/database');

class CodeRepository {
    static async hasRedeemed(userId, code) {
        const row = await get(
            `SELECT * FROM redeemedCodes WHERE userId = ? AND code = ?`,
            [userId, code]
        );
        return !!row;
    }

    static async markAsRedeemed(userId, code) {
        await run(
            `INSERT INTO redeemedCodes (userId, code) VALUES (?, ?)`,
            [userId, code]
        );
    }

    static async getRedemptionCount(code) {
        const row = await get(
            `SELECT COUNT(*) as count FROM redeemedCodes WHERE code = ?`,
            [code]
        );
        return row?.count || 0;
    }

    static async getUserRedemptions(userId) {
        return await all(
            `SELECT code, rowid as redeemedAt FROM redeemedCodes WHERE userId = ? ORDER BY rowid DESC LIMIT 50`,
            [userId]
        );
    }

    static async getRedemptionsByDate(userId, date) {
        return await all(
            `SELECT COUNT(*) as count FROM redeemedCodes 
             WHERE userId = ? AND date(rowid) = date(?)`,
            [userId, date]
        );
    }

    static async getTotalUserRedemptions(userId) {
        const row = await get(
            `SELECT COUNT(*) as count FROM redeemedCodes WHERE userId = ?`,
            [userId]
        );
        return row?.count || 0;
    }

    static async getTopRedeemers(limit = 10) {
        return await all(
            `SELECT userId, COUNT(*) as redemptions 
             FROM redeemedCodes 
             GROUP BY userId 
             ORDER BY redemptions DESC 
             LIMIT ?`,
            [limit]
        );
    }

    static async getCodeStats(code) {
        const row = await get(
            `SELECT 
                COUNT(*) as totalRedemptions,
                COUNT(DISTINCT userId) as uniqueUsers,
                MIN(rowid) as firstRedemption,
                MAX(rowid) as lastRedemption
             FROM redeemedCodes 
             WHERE code = ?`,
            [code]
        );
        return row;
    }

    static async getAllActiveCodes() {
        return await all(
            `SELECT code, COUNT(*) as uses 
             FROM redeemedCodes 
             GROUP BY code 
             ORDER BY uses DESC`
        );
    }

    static async deleteUserRedemption(userId, code) {
        await run(
            `DELETE FROM redeemedCodes WHERE userId = ? AND code = ?`,
            [userId, code]
        );
    }

    static async clearExpiredCodes(expiredCodes) {
        if (expiredCodes.length === 0) return;

        const placeholders = expiredCodes.map(() => '?').join(',');
        await run(
            `DELETE FROM redeemedCodes WHERE code IN (${placeholders})`,
            expiredCodes
        );
    }
}

module.exports = CodeRepository;