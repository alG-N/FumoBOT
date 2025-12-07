const { getUserCurrency, deductCurrency, addItemToInventory } = require('./ShopDatabaseService');
const { updateUserStock } = require('./ShopCacheService');
const { debugLog } = require('../../../Core/logger');

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
    const totalCost = itemData.cost * quantity;

    if (!currency || currency[itemData.currency] < totalCost) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_FUNDS',
            message: `💸 You need ${totalCost} ${itemData.currency} but only have ${currency[itemData.currency] || 0}.`
        };
    }

    return { 
        valid: true, 
        totalCost,
        currency: itemData.currency
    };
}

async function processPurchase(userId, itemName, itemData, quantity) {
    const validation = await validatePurchase(userId, itemName, itemData, quantity);
    
    if (!validation.valid) {
        return validation;
    }

    try {
        await deductCurrency(userId, validation.currency, validation.totalCost);
        await addItemToInventory(userId, itemName, quantity);

        if (itemData.stock !== 'unlimited') {
            const newStock = itemData.stock - quantity;
            updateUserStock(userId, itemName, newStock);
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
        console.error('Purchase processing error:', error);
        return {
            success: false,
            error: 'PROCESSING_ERROR',
            message: '❌ Purchase failed. Please try again.'
        };
    }
}

async function processBuyAll(userId, userShop) {
    try {
        const currency = await getUserCurrency(userId);
        let totalCoins = 0;
        let totalGems = 0;
        const purchases = [];
        const itemsToBuy = [];

        for (const [itemName, itemData] of Object.entries(userShop)) {
            if (itemData.stock === 0) continue;

            let quantity;
            if (itemData.stock === 'unlimited') {
                quantity = 100;
            } else {
                quantity = itemData.stock;
            }

            const totalCost = itemData.cost * quantity;

            if (itemData.currency === 'coins') {
                if (currency.coins >= totalCoins + totalCost) {
                    itemsToBuy.push({ itemName, itemData, quantity, totalCost });
                    totalCoins += totalCost;
                }
            } else if (itemData.currency === 'gems') {
                if (currency.gems >= totalGems + totalCost) {
                    itemsToBuy.push({ itemName, itemData, quantity, totalCost });
                    totalGems += totalCost;
                }
            }
        }

        if (itemsToBuy.length === 0) {
            return {
                success: false,
                message: '❌ You cannot afford any items in your shop.'
            };
        }

        for (const item of itemsToBuy) {
            await deductCurrency(userId, item.itemData.currency, item.totalCost);
            await addItemToInventory(userId, item.itemName, item.quantity);

            if (item.itemData.stock !== 'unlimited') {
                updateUserStock(userId, item.itemName, 0);
            }

            purchases.push({
                itemName: item.itemName,
                quantity: item.quantity,
                cost: item.totalCost,
                currency: item.itemData.currency
            });

            debugLog('SHOP_BUY_ALL', `${userId} bought ${item.quantity}x ${item.itemName} for ${item.totalCost} ${item.itemData.currency}`);
        }

        return {
            success: true,
            purchases,
            totalCoins,
            totalGems
        };

    } catch (error) {
        console.error('Buy all processing error:', error);
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