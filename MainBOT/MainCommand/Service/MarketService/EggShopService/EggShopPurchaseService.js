const { get, run, withUserLock, transaction } = require('../../../Core/database');
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
    console.log(`[EGGSHOP] Starting purchase for ${userId}, egg ${eggIndex}`);
    
    // First validate with base egg price to check if already purchased
    const validation = await validatePurchase(userId, eggIndex, egg);
    console.log(`[EGGSHOP] Validation result:`, validation.valid ? 'VALID' : validation.error);
    
    if (!validation.valid) {
        return validation;
    }

    console.log(`[EGGSHOP] Acquiring lock for ${userId}...`);
    // Use user lock to prevent race conditions
    return await withUserLock(userId, 'egg_purchase', async () => {
        console.log(`[EGGSHOP] Lock acquired for ${userId}`);
        try {
            // Re-verify balance inside lock (in case it changed)
            const user = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
            if (!user) {
                return { success: false, error: 'NO_ACCOUNT', message: "You don't have any coins or gems yet." };
            }
            if (user.coins < validation.scaledCoinPrice) {
                return { success: false, error: 'INSUFFICIENT_COINS', message: 'Insufficient coins.' };
            }
            if (user.gems < validation.scaledGemPrice) {
                return { success: false, error: 'INSUFFICIENT_GEMS', message: 'Insufficient gems.' };
            }

            // Direct deduction without nested lock
            console.log(`[EGGSHOP] Deducting ${validation.scaledCoinPrice} coins, ${validation.scaledGemPrice} gems`);
            await run(
                `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
                [validation.scaledCoinPrice, validation.scaledGemPrice, userId]
            );
            console.log(`[EGGSHOP] Deduct complete`);

            console.log(`[EGGSHOP] Inserting egg into petInventory...`);
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
            console.log(`[EGGSHOP] Egg inserted successfully`);

            markEggPurchased(userId, eggIndex);

            debugLog('EGG_PURCHASE', `${userId} bought ${egg.name} for ${validation.scaledCoinPrice} coins (base: ${egg.price.coins}), ${validation.scaledGemPrice} gems (base: ${egg.price.gems})`);

            console.log(`[EGGSHOP] Purchase complete for ${userId}`);
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