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
    console.log('[SHOP_PURCHASE] Starting purchase:', { userId, itemName, quantity });
    
    const validation = await validatePurchase(userId, itemName, itemData, quantity);
    
    if (!validation.valid) {
        console.log('[SHOP_PURCHASE] Validation failed:', validation);
        return validation;
    }

    try {
        await deductCurrency(userId, validation.currency, validation.totalCost);
        await addItemToInventory(userId, itemName, quantity);

        if (itemData.stock !== 'unlimited') {
            const newStock = itemData.stock - quantity;
            console.log(`[SHOP_PURCHASE] Updating stock: ${itemData.stock} -> ${newStock}`);
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
}

async function processBuyAll(userId, userShop) {
    console.log('[SHOP_BUY_ALL] Starting buy all for user:', userId);
    console.log('[SHOP_BUY_ALL] User shop items:', Object.keys(userShop).length);
    
    try {
        const currency = await getUserCurrency(userId);
        console.log('[SHOP_BUY_ALL] User currency:', currency);
        
        const purchases = [];
        const stockUpdates = [];
        let availableCoins = currency.coins;
        let availableGems = currency.gems;

        for (const [itemName, itemData] of Object.entries(userShop)) {
            console.log(`[SHOP_BUY_ALL] Checking item: ${itemName}, stock: ${itemData.stock}`);
            
            if (itemData.stock === 0 || itemData.stock === '0') {
                console.log(`[SHOP_BUY_ALL] Skipping ${itemName} - no stock`);
                continue;
            }

            let quantity;
            if (itemData.stock === 'unlimited') {
                quantity = 100;
            } else {
                quantity = parseInt(itemData.stock);
            }

            const totalCost = itemData.cost * quantity;
            console.log(`[SHOP_BUY_ALL] ${itemName}: ${quantity}x @ ${itemData.cost} = ${totalCost} ${itemData.currency}`);

            if (itemData.currency === 'coins' && availableCoins >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost });
                availableCoins -= totalCost;
                
                if (itemData.stock !== 'unlimited') {
                    stockUpdates.push({ itemName, newStock: 0 });
                }
                console.log(`[SHOP_BUY_ALL] Added ${itemName} to purchases (coins)`);
            } else if (itemData.currency === 'gems' && availableGems >= totalCost) {
                purchases.push({ itemName, itemData, quantity, totalCost });
                availableGems -= totalCost;
                
                if (itemData.stock !== 'unlimited') {
                    stockUpdates.push({ itemName, newStock: 0 });
                }
                console.log(`[SHOP_BUY_ALL] Added ${itemName} to purchases (gems)`);
            } else {
                console.log(`[SHOP_BUY_ALL] Cannot afford ${itemName}`);
            }
        }

        console.log(`[SHOP_BUY_ALL] Total purchases to process: ${purchases.length}`);

        if (purchases.length === 0) {
            return {
                success: false,
                message: '❌ You cannot afford any items in your shop.'
            };
        }

        let totalCoins = 0;
        let totalGems = 0;

        console.log('[SHOP_BUY_ALL] Processing purchases...');
        for (const item of purchases) {
            console.log(`[SHOP_BUY_ALL] Deducting ${item.totalCost} ${item.itemData.currency} for ${item.itemName}`);
            await deductCurrency(userId, item.itemData.currency, item.totalCost);
            
            console.log(`[SHOP_BUY_ALL] Adding ${item.quantity}x ${item.itemName} to inventory`);
            await addItemToInventory(userId, item.itemName, item.quantity);

            if (item.itemData.currency === 'coins') {
                totalCoins += item.totalCost;
            } else {
                totalGems += item.totalCost;
            }

            debugLog('SHOP_BUY_ALL', `${userId} bought ${item.quantity}x ${item.itemName} for ${item.totalCost} ${item.itemData.currency}`);
        }

        console.log(`[SHOP_BUY_ALL] Processing ${stockUpdates.length} stock updates...`);
        for (const { itemName, newStock } of stockUpdates) {
            console.log(`[SHOP_BUY_ALL] Updating stock for ${itemName} to ${newStock}`);
            const updateResult = await updateUserStock(userId, itemName, newStock);
            console.log(`[SHOP_BUY_ALL] Stock update result for ${itemName}:`, updateResult);
        }

        console.log('[SHOP_BUY_ALL] All purchases completed successfully');
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