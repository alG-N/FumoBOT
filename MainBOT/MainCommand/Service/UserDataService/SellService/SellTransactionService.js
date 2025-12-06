const db = require('../../../Core/database');
const SellValidationService = require('./SellValidationService');

const SHINY_MULTIPLIER = 2;
const ALG_MULTIPLIER = 150;

class SellTransactionService {
    static async getSellMultiplier(userId) {
        try {
            const row = await db.get(
                `SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
                [userId, 'sellPenalty', 'AncientRelic']
            );
            if (row && row.expiresAt > Date.now()) {
                return row.multiplier;
            }
        } catch (error) {
            console.error('[SellTransaction] Error fetching sell multiplier:', error);
        }
        return 1.0;
    }

    static async calculateSellReward(userId, fumoName, quantity) {
        const rarity = SellValidationService.extractRarity(fumoName);
        const baseReward = SellValidationService.getBaseReward(rarity);
        const rewardType = SellValidationService.getRewardType(rarity);
        const sellMultiplier = await this.getSellMultiplier(userId);

        let reward = Math.floor(baseReward * quantity * sellMultiplier);

        const multipliers = {
            base: baseReward,
            sellPenalty: sellMultiplier,
            shiny: 1,
            alg: 1
        };

        if (fumoName.includes('[✨SHINY]')) {
            reward *= SHINY_MULTIPLIER;
            multipliers.shiny = SHINY_MULTIPLIER;
        }

        if (fumoName.includes('[🌟alG]')) {
            reward *= ALG_MULTIPLIER;
            multipliers.alg = ALG_MULTIPLIER;
        }

        return {
            reward,
            rewardType,
            multipliers
        };
    }

    static async calculateBulkSellReward(userId, rarity, tag, fumos) {
        const baseReward = SellValidationService.getBaseReward(rarity);
        const rewardType = SellValidationService.getRewardType(rarity);
        const sellMultiplier = await this.getSellMultiplier(userId);

        let totalReward = 0;
        let totalFumos = 0;

        for (const fumo of fumos) {
            let fumoReward = Math.floor(baseReward * fumo.count * sellMultiplier);

            if (tag && fumo.fumoName.endsWith(tag)) {
                if (tag === '[✨SHINY]') {
                    fumoReward *= SHINY_MULTIPLIER;
                } else if (tag === '[🌟alG]') {
                    fumoReward *= ALG_MULTIPLIER;
                }
            }

            totalReward += fumoReward;
            totalFumos += fumo.count;
        }

        const multipliers = {
            base: baseReward,
            sellPenalty: sellMultiplier,
            shiny: tag === '[✨SHINY]' ? SHINY_MULTIPLIER : 1,
            alg: tag === '[🌟alG]' ? ALG_MULTIPLIER : 1
        };

        return {
            totalReward,
            totalFumos,
            rewardType,
            multipliers
        };
    }

    static async executeSingleSell(userId, fumoName, quantity, reward, rewardType) {
        try {
            await db.run('BEGIN TRANSACTION');

            await db.run(
                `DELETE FROM userInventory WHERE rowid IN (
                    SELECT rowid FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT ?
                )`,
                [userId, fumoName, quantity]
            );

            await db.run(
                'INSERT INTO userSales (userId, fumoName, quantity, timestamp) VALUES (?, ?, ?, ?)',
                [userId, fumoName, quantity, Date.now()]
            );

            if (rewardType === 'coins') {
                await this.addUserReward(userId, reward, 0);
            } else {
                await this.addUserReward(userId, 0, reward);
            }

            await db.run('COMMIT');

            return { success: true };
        } catch (error) {
            await db.run('ROLLBACK').catch(() => {});
            console.error('[SellTransaction] Execute single sell error:', error);
            return { success: false, error };
        }
    }

    static async executeBulkSell(userId, fumos, totalReward, rewardType, tag) {
        try {
            await db.run('BEGIN TRANSACTION');

            for (const fumo of fumos) {
                if (tag && !fumo.fumoName.endsWith(tag)) continue;
                if (!tag && (fumo.fumoName.endsWith('[✨SHINY]') || fumo.fumoName.endsWith('[🌟alG]'))) continue;

                await db.run(
                    'DELETE FROM userInventory WHERE userId = ? AND fumoName = ?',
                    [userId, fumo.fumoName]
                );

                await db.run(
                    'INSERT INTO userSales (userId, fumoName, quantity, timestamp) VALUES (?, ?, ?, ?)',
                    [userId, fumo.fumoName, fumo.count, Date.now()]
                );
            }

            if (rewardType === 'coins') {
                await this.addUserReward(userId, totalReward, 0);
            } else {
                await this.addUserReward(userId, 0, totalReward);
            }

            await db.run('COMMIT');

            return { success: true };
        } catch (error) {
            await db.run('ROLLBACK').catch(() => {});
            console.error('[SellTransaction] Execute bulk sell error:', error);
            return { success: false, error };
        }
    }

    static async addUserReward(userId, coins, gems) {
        const res = await db.run(
            'UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?',
            [coins, gems, userId]
        );

        if (res.changes === 0) {
            await db.run(
                'INSERT INTO userCoins (userId, coins, gems) VALUES (?, ?, ?)',
                [userId, coins, gems]
            );
        }
    }
}

module.exports = SellTransactionService;