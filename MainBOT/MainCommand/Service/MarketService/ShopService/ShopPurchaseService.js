const { getUserCurrency, deductCurrency, addItemToInventory, batchProcessPurchases } = require('./ShopDatabaseService');
const { updateUserStock, getUserShop } = require('./ShopCacheService');
const { debugLog } = require('../../../Core/logger');
const { withUserLock } = require('../../../Core/database');
const { calculateCoinPrice, calculateGemPrice, formatScaledPrice } = require('../WealthPricingService');

async function validatePurchase(userId, itemName, itemData, quantity) {
    if (!itemData) {
        return { 
            valid: false, 
            error: 'ITEM_NOT_FOUND',
            message: `🔍 The item "${itemName}" is not available in your shop.`
        };
    }

    if (itemData.stock === 0) {
        return { 
            valid: false, 
            error: 'OUT_OF_STOCK',
            message: `❌ You don't have this item in your shop stock.`
        };
    }

    if (itemData.stock !== 'unlimited' && itemData.stock < quantity) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_STOCK',
            message: `⚠️ You only have ${itemData.stock} ${itemName}(s) in your personal shop view.`
        };
    }

    const currency = await getUserCurrency(userId);
    
    // Calculate wealth-scaled price
    const priceCalc = itemData.currency === 'coins' 
        ? await calculateCoinPrice(userId, itemData.cost, 'itemShop')
        : await calculateGemPrice(userId, itemData.cost, 'itemShop');
    
    const scaledUnitPrice = priceCalc.finalPrice;
    const totalCost = scaledUnitPrice * quantity;

    if (!currency || currency[itemData.currency] < totalCost) {
        const priceDisplay = priceCalc.scaled 
            ? `${totalCost.toLocaleString()} (scaled from ${(itemData.cost * quantity).toLocaleString()})`
            : totalCost.toLocaleString();
        return { 
            valid: false, 
            error: 'INSUFFICIENT_FUNDS',
            message: `💸 You need ${priceDisplay} ${itemData.currency} but only have ${(currency[itemData.currency] || 0).toLocaleString()}.`
        };
    }

    return { 
        valid: true, 
        totalCost,
        basePrice: itemData.cost * quantity,
        scaledPrice: totalCost,
        priceScaled: priceCalc.scaled,
        multiplier: priceCalc.multiplier,
        currency: itemData.currency
    };
}

async function processPurchase(userId, itemName, itemData, quantity) {
    const validation = await validatePurchase(userId, itemName, itemData, quantity);
    
    if (!validation.valid) {
        return validation;
    }

    // FIXED: Use user lock to prevent race conditions
    return await withUserLock(userId, 'shop_purchase', async () => {
        try {
            await deductCurrency(userId, validation.currency, validation.totalCost);
            await addItemToInventory(userId, itemName, quantity);

            if (itemData.stock !== 'unlimited') {
                const newStock = itemData.stock - quantity;
                await updateUserStock(userId, itemName, newStock);
            }

            debugLog('SHOP_PURCHASE', `${userId} bought ${quantity}x ${itemName} for ${validation.totalCost} ${validation.currency}`);

            return {
                success: true,
                itemName,
                quantity,
                totalCost: validation.totalCost,
                currency: validation.currency
            };

        } catch (error) {
            console.error('[SHOP_PURCHASE] Purchase processing error:', error);
            return {
                success: false,
                error: 'PROCESSING_ERROR',
                message: '❌ Purchase failed. Please try again.'
            };
        }
    });
}

async function processBuyAll(userId, userShop) {
    try {
        const currency = await getUserCurrency(userId);
        
        const purchases = [];
        const stockUpdates = [];
        let availableCoins = currency.coins;
        let availableGems = currency.gems;

        for (const [itemName, itemData] of Object.entries(userShop)) {
            if (itemData.stock === 0 || itemData.stock === '0') {
                continue;
            }

            let quantity;
            if (itemData.stock === 'unlimited') {
                quantity = 100;
            } else {
                quantity = parseInt(itemData.stock);
            }

            // Calculate wealth-scaled price for buy all
            const priceCalc = itemData.currency === 'coins' 
                ? await calculateCoinPrice(userId, itemData.cost, 'itemShop')
                : await calculateGemPrice(userId, itemData.cost, 'itemShop');
            
            const totalCost = priceCalc.finalPrice * quantity;

            if (itemData.currency === 'coins' && availableCoins >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost, basePrice: itemData.cost * quantity });
                availableCoins -= totalCost;
                
                if (itemData.stock !== 'unlimited') {
                    stockUpdates.push({ itemName, newStock: 0 });
                }
            } else if (itemData.currency === 'gems' && availableGems >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost, basePrice: itemData.cost * quantity });
                availableGems -= totalCost;
                
                if (itemData.stock !== 'unlimited') {
                    stockUpdates.push({ itemName, newStock: 0 });
                }
            }
        }

        if (purchases.length === 0) {
            return {
                success: false,
                message: '❌ You cannot afford any items in your shop.'
            };
        }

        let totalCoins = 0;
        let totalGems = 0;

        // Calculate totals
        for (const item of purchases) {
            if (item.itemData.currency === 'coins') {
                totalCoins += item.totalCost;
            } else {
                totalGems += item.totalCost;
            }
        }

        // OPTIMIZED: Process all purchases in batch
        await batchProcessPurchases(userId, purchases, totalCoins, totalGems);

        for (const item of purchases) {
            debugLog('SHOP_BUY_ALL', `${userId} bought ${item.quantity}x ${item.itemName} for ${item.totalCost} ${item.itemData.currency}`);
        }

        for (const { itemName, newStock } of stockUpdates) {
            await updateUserStock(userId, itemName, newStock);
        }

        return {
            success: true,
            purchases: purchases.map(p => ({
                itemName: p.itemName,
                quantity: p.quantity,
                cost: p.totalCost,
                currency: p.itemData.currency
            })),
            totalCoins,
            totalGems
        };

    } catch (error) {
        console.error('[SHOP_BUY_ALL] Buy all processing error:', error);
        return {
            success: false,
            error: 'PROCESSING_ERROR',
            message: '❌ Bulk purchase failed. Please try again.'
        };
    }
}

module.exports = {
    validatePurchase,
    processPurchase,
    processBuyAll
};