const { getUserCurrency, deductCurrency, addItemToInventory } = require('./ShopDatabaseService');
const { updateUserStock, getUserShop } = require('./ShopCacheService');
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
        const purchases = [];
        const stockUpdates = [];

        for (const [itemName, itemData] of Object.entries(userShop)) {
            if (itemData.stock === 0) continue;

            let quantity;
            if (itemData.stock === 'unlimited') {
                quantity = 100;
            } else {
                quantity = itemData.stock;
            }

            const totalCost = itemData.cost * quantity;

            if (itemData.currency === 'coins' && currency.coins >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost });
                currency.coins -= totalCost;
                
                if (itemData.stock !== 'unlimited') {
                    stockUpdates.push({ itemName, newStock: 0 });
                }
            } else if (itemData.currency === 'gems' && currency.gems >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost });
                currency.gems -= totalCost;
                
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

        for (const item of purchases) {
            await deductCurrency(userId, item.itemData.currency, item.totalCost);
            await addItemToInventory(userId, item.itemName, item.quantity);

            if (item.itemData.currency === 'coins') {
                totalCoins += item.totalCost;
            } else {
                totalGems += item.totalCost;
            }

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