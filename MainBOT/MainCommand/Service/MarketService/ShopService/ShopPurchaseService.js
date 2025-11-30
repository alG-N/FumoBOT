const { getUserCurrency, deductCurrency, addItemToInventory } = require('./ShopDatabaseService');
const { debugLog } = require('../../../Core/logger');

async function validatePurchase(userId, itemName, itemData, quantity) {
    if (!itemData) {
        return { 
            valid: false, 
            error: 'ITEM_NOT_FOUND',
            message: `🔍 The item "${itemName}" is not available in your magical shop.`
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
            message: `⚠️ Sorry, you only have ${itemData.stock} ${itemName}(s) in your shop.`
        };
    }

    const currency = await getUserCurrency(userId);
    const totalCost = itemData.cost * quantity;

    if (!currency || currency[itemData.currency] < totalCost) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_FUNDS',
            message: `💸 You do not have enough ${itemData.currency} to buy ${quantity} ${itemName}(s).`
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
            itemData.stock -= quantity;
            if (itemData.stock <= 0) {
                itemData.stock = 0;
                itemData.message = 'Out of Stock';
            }
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

module.exports = {
    validatePurchase,
    processPurchase
};