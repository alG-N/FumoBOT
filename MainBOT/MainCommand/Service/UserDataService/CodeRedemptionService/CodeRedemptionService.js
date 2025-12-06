const { VALID_CODES, CODE_LIMITS, CODE_MESSAGES } = require('../../../Configuration/codeConfig');
const CodeRepository = require('./CodeRepository');
const { run, get } = require('../../../Core/database');

class CodeRedemptionService {
    static async validateCode(code, userId) {
        const codeData = VALID_CODES[code];
        
        if (!codeData) {
            return { valid: false, error: 'INVALID_CODE', message: CODE_MESSAGES.INVALID_CODE };
        }
        
        if (codeData.expires && new Date() > new Date(codeData.expires)) {
            return { valid: false, error: 'EXPIRED', message: CODE_MESSAGES.EXPIRED };
        }
        
        if (codeData.maxUses !== null) {
            const redemptionCount = await CodeRepository.getRedemptionCount(code);
            if (redemptionCount >= codeData.maxUses) {
                return { valid: false, error: 'MAX_USES', message: CODE_MESSAGES.MAX_USES_REACHED };
            }
        }
        
        const hasRedeemed = await CodeRepository.hasRedeemed(userId, code);
        if (hasRedeemed) {
            return { valid: false, error: 'ALREADY_REDEEMED', message: CODE_MESSAGES.ALREADY_REDEEMED };
        }
        
        const today = new Date().toISOString().split('T')[0];
        const todayRedemptions = await CodeRepository.getRedemptionsByDate(userId, today);
        if (todayRedemptions.length >= CODE_LIMITS.MAX_REDEMPTIONS_PER_DAY) {
            return { valid: false, error: 'DAILY_LIMIT', message: CODE_MESSAGES.DAILY_LIMIT };
        }
        
        return { valid: true, codeData };
    }

    static async redeemCode(code, userId) {
        const validation = await this.validateCode(code, userId);
        
        if (!validation.valid) {
            return { success: false, error: validation.error, message: validation.message };
        }
        
        const codeData = validation.codeData;
        const currentDate = new Date().toISOString();
        
        try {
            await run('BEGIN TRANSACTION');
            
            if (codeData.coins || codeData.gems) {
                await this.grantCurrency(userId, codeData.coins || 0, codeData.gems || 0, currentDate);
            }
            
            if (codeData.items && Array.isArray(codeData.items)) {
                await this.grantItems(userId, codeData.items);
            }
            
            await CodeRepository.markAsRedeemed(userId, code);
            
            await run('COMMIT');
            
            return { 
                success: true, 
                rewards: codeData,
                message: CODE_MESSAGES.SUCCESS
            };
            
        } catch (error) {
            await run('ROLLBACK').catch(() => {});
            console.error('[CODE_REDEMPTION] Error:', error);
            return { 
                success: false, 
                error: 'REDEMPTION_FAILED', 
                message: 'Something went wrong. Please try again later.' 
            };
        }
    }

    static async grantCurrency(userId, coins, gems, currentDate) {
        const userRow = await get(
            `SELECT * FROM userCoins WHERE userId = ?`,
            [userId]
        );
        
        if (userRow) {
            await run(
                `UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`,
                [coins, gems, userId]
            );
        } else {
            await run(
                `INSERT INTO userCoins (userId, coins, gems, joinDate) VALUES (?, ?, ?, ?)`,
                [userId, coins, gems, currentDate]
            );
        }
    }

    static async grantItems(userId, items) {
        for (const { item, quantity } of items) {
            const itemRow = await get(
                `SELECT * FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, item]
            );
            
            if (itemRow) {
                await run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                    [quantity, userId, item]
                );
            } else {
                await run(
                    `INSERT INTO userInventory (userId, itemName, quantity, type) VALUES (?, ?, ?, 'item')`,
                    [userId, item, quantity]
                );
            }
        }
    }

    static getActiveCodesList(isAdmin = false) {
        const now = new Date();
        const activeCodes = {};
        
        for (const [code, data] of Object.entries(VALID_CODES)) {
            if (!data.expires || new Date(data.expires) > now) {
                if (isAdmin || !data.adminOnly) {
                    activeCodes[code] = data;
                }
            }
        }
        
        return activeCodes;
    }

    static async getCodeStatistics(code) {
        const codeData = VALID_CODES[code];
        if (!codeData) return null;
        
        const stats = await CodeRepository.getCodeStats(code);
        
        return {
            code,
            ...codeData,
            ...stats
        };
    }

    static async getUserRedemptionStats(userId) {
        const total = await CodeRepository.getTotalUserRedemptions(userId);
        const recent = await CodeRepository.getUserRedemptions(userId);
        
        return {
            totalRedemptions: total,
            recentRedemptions: recent
        };
    }

    static isAdmin(userId) {
        const { ADMIN_IDS } = require('../../../Configuration/codeConfig');
        return ADMIN_IDS.includes(userId);
    }

    static async cleanExpiredCodes() {
        const now = new Date();
        const expiredCodes = [];
        
        for (const [code, data] of Object.entries(VALID_CODES)) {
            if (data.expires && new Date(data.expires) <= now) {
                expiredCodes.push(code);
            }
        }
        
        if (expiredCodes.length > 0) {
            await CodeRepository.clearExpiredCodes(expiredCodes);
        }
        
        return expiredCodes;
    }
}

module.exports = CodeRedemptionService;