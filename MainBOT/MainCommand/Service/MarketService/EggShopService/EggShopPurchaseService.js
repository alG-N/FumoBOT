const { get, run, withUserLock, atomicDeductCurrency } = require('../../../Core/database');
const { hasUserPurchased, markEggPurchased } = require('./EggShopCacheService');
const { debugLog } = require('../../../Core/logger');
const { formatNumber } = require('../../../Ultility/formatting');

async function validatePurchase(userId, eggIndex, egg) {
    if (hasUserPurchased(userId, eggIndex)) {
        return {
            valid: false,
            error: 'ALREADY_PURCHASED',
            message: "You've already bought this egg this hour!"
        };
    }

    const userRow = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );

    if (!userRow) {
        return {
            valid: false,
            error: 'NO_ACCOUNT',
            message: "You don't have any coins or gems yet."
        };
    }

    if (userRow.coins < egg.price.coins || userRow.gems < egg.price.gems) {
        return {
            valid: false,
            error: 'INSUFFICIENT_FUNDS',
            message: `You need <a:coin:1130479446263644260> **${formatNumber(egg.price.coins)}** and <a:gem:1130479444305707139> **${formatNumber(egg.price.gems)}**.`
        };
    }

    return {
        valid: true,
        currentCoins: userRow.coins,
        currentGems: userRow.gems
    };
}

async function processPurchase(userId, eggIndex, egg) {
    const validation = await validatePurchase(userId, eggIndex, egg);
    
    if (!validation.valid) {
        return validation;
    }

    // FIXED: Use user lock and atomic currency deduction to prevent race conditions
    return await withUserLock(userId, 'egg_purchase', async () => {
        try {
            // Atomic currency deduction
            const deductResult = await atomicDeductCurrency(userId, egg.price.coins, egg.price.gems);
            if (!deductResult.success) {
                return {
                    success: false,
                    error: deductResult.error,
                    message: `Insufficient ${deductResult.error === 'INSUFFICIENT_COINS' ? 'coins' : 'gems'}.`
                };
            }

            await run(
                `INSERT INTO petInventory (petId, userId, type, name, timestamp) 
                 VALUES (?, ?, 'egg', ?, ?)`,
                [
                    `egg_${userId}_${Date.now()}`,
                    userId,
                    egg.name,
                    Date.now()
                ]
            );

            markEggPurchased(userId, eggIndex);

            debugLog('EGG_PURCHASE', `${userId} bought ${egg.name} for ${egg.price.coins} coins, ${egg.price.gems} gems`);

            return {
                success: true,
                egg,
                remainingCoins: validation.currentCoins - egg.price.coins,
                remainingGems: validation.currentGems - egg.price.gems
            };

        } catch (error) {
            console.error('[EGG_PURCHASE] Purchase error:', error);
            return {
                success: false,
                error: 'PROCESSING_ERROR',
                message: 'Error processing your purchase.'
            };
        }
    });
}

module.exports = {
    validatePurchase,
    processPurchase
};