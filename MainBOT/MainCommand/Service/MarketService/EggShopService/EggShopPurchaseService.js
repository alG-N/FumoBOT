const { get, run, withUserLock, atomicDeductCurrency } = require('../../../Core/database');
const { hasUserPurchased, markEggPurchased } = require('./EggShopCacheService');
const { debugLog } = require('../../../Core/logger');
const { formatNumber } = require('../../../Ultility/formatting');
const { calculateDualPrice } = require('../WealthPricingService');

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

    // Calculate wealth-scaled prices for both currencies
    const priceCalc = await calculateDualPrice(userId, egg.price.coins, egg.price.gems, 'eggShop');
    
    const scaledCoinPrice = priceCalc.coins.finalPrice;
    const scaledGemPrice = priceCalc.gems.finalPrice;

    if (userRow.coins < scaledCoinPrice || userRow.gems < scaledGemPrice) {
        const coinDisplay = priceCalc.coins.scaled 
            ? `${formatNumber(scaledCoinPrice)} (scaled)` 
            : formatNumber(scaledCoinPrice);
        const gemDisplay = priceCalc.gems.scaled 
            ? `${formatNumber(scaledGemPrice)} (scaled)` 
            : formatNumber(scaledGemPrice);
        
        return {
            valid: false,
            error: 'INSUFFICIENT_FUNDS',
            message: `You need <a:coin:1130479446263644260> **${coinDisplay}** and <a:gem:1130479444305707139> **${gemDisplay}**.`
        };
    }

    return {
        valid: true,
        currentCoins: userRow.coins,
        currentGems: userRow.gems,
        scaledCoinPrice,
        scaledGemPrice,
        baseCoinPrice: egg.price.coins,
        baseGemPrice: egg.price.gems,
        priceScaled: priceCalc.totalScaled
    };
}

async function processPurchase(userId, eggIndex, egg) {
    // First validate with base egg price to check if already purchased
    const validation = await validatePurchase(userId, eggIndex, egg);
    
    if (!validation.valid) {
        return validation;
    }

    // FIXED: Use user lock and atomic currency deduction to prevent race conditions
    return await withUserLock(userId, 'egg_purchase', async () => {
        try {
            // Use the scaled prices for actual deduction
            const deductResult = await atomicDeductCurrency(userId, validation.scaledCoinPrice, validation.scaledGemPrice);
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

            debugLog('EGG_PURCHASE', `${userId} bought ${egg.name} for ${validation.scaledCoinPrice} coins (base: ${egg.price.coins}), ${validation.scaledGemPrice} gems (base: ${egg.price.gems})`);

            return {
                success: true,
                egg,
                remainingCoins: validation.currentCoins - validation.scaledCoinPrice,
                remainingGems: validation.currentGems - validation.scaledGemPrice,
                paidCoins: validation.scaledCoinPrice,
                paidGems: validation.scaledGemPrice,
                priceScaled: validation.priceScaled
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