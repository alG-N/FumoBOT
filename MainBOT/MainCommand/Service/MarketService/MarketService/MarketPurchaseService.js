const { get, run } = require('../../../Core/database');
const { getCoinMarket, getGemMarket, updateCoinMarketStock, updateGemMarketStock } = require('./MarketCacheService');
const { addFumoToInventory } = require('./MarketInventoryService');
const { purchaseGlobalListing } = require('./MarketStorageService');

async function validateShopPurchase(userId, fumoIndex, amount, market, currency) {
    if (fumoIndex < 0 || fumoIndex >= market.market.length) {
        return { 
            valid: false, 
            error: 'NOT_FOUND'
        };
    }
    
    const fumo = market.market[fumoIndex];
    
    if (fumo.stock < amount) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_STOCK',
            stock: fumo.stock,
            requested: amount
        };
    }
    
    const totalPrice = fumo.price * amount;
    const userRow = await get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [userId]);
    
    if (!userRow) {
        return { 
            valid: false, 
            error: 'NO_ACCOUNT' 
        };
    }
    
    if (userRow[currency] < totalPrice) {
        return { 
            valid: false, 
            error: currency === 'coins' ? 'INSUFFICIENT_COINS' : 'INSUFFICIENT_GEMS',
            required: totalPrice,
            current: userRow[currency]
        };
    }
    
    return { 
        valid: true, 
        fumo, 
        totalPrice,
        currentBalance: userRow[currency]
    };
}

async function processShopPurchase(userId, fumo, amount, totalPrice, currency, shopType) {
    await run(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [totalPrice, userId]);
    
    const balanceRow = await get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [userId]);
    const remainingBalance = balanceRow?.[currency] || 0;
    
    const luckRow = await get(`SELECT luck FROM userCoins WHERE userId = ?`, [userId]);
    const shinyMarkValue = luckRow?.luck || 0;
    
    for (let i = 0; i < amount; i++) {
        await addFumoToInventory(userId, fumo, shinyMarkValue);
    }
    
    if (shopType === 'coin') {
        updateCoinMarketStock(userId, fumo.name, amount);
    } else {
        updateGemMarketStock(userId, fumo.name, amount);
    }
    
    return { remainingBalance };
}

async function validateGlobalPurchase(userId, listing) {
    const currency = listing.currency;
    const userRow = await get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [userId]);
    
    if (!userRow) {
        return { 
            valid: false, 
            error: 'NO_ACCOUNT' 
        };
    }
    
    if (userRow[currency] < listing.price) {
        return { 
            valid: false, 
            error: currency === 'coins' ? 'INSUFFICIENT_COINS' : 'INSUFFICIENT_GEMS',
            required: listing.price,
            current: userRow[currency]
        };
    }
    
    return { 
        valid: true,
        currentBalance: userRow[currency]
    };
}

async function processGlobalPurchase(buyerId, listing) {
    const currency = listing.currency;
    const price = listing.price;
    const tax = Math.floor(price * 0.05);
    const sellerReceives = price - tax;
    
    await run(`UPDATE userCoins SET ${currency} = ${currency} - ? WHERE userId = ?`, [price, buyerId]);
    await run(`UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`, [sellerReceives, listing.userId]);
    
    const balanceRow = await get(`SELECT ${currency} FROM userCoins WHERE userId = ?`, [buyerId]);
    const remainingBalance = balanceRow?.[currency] || 0;
    
    const luckRow = await get(`SELECT luck FROM userCoins WHERE userId = ?`, [buyerId]);
    const shinyMarkValue = luckRow?.luck || 0;
    
    const fumoToAdd = {
        name: listing.fumoName,
        variant: listing.variant
    };
    
    await addFumoToInventory(buyerId, fumoToAdd, shinyMarkValue);
    
    const removed = purchaseGlobalListing(listing.id, buyerId);
    
    return { 
        remainingBalance,
        sellerReceives,
        tax
    };
}

module.exports = {
    validateShopPurchase,
    processShopPurchase,
    validateGlobalPurchase,
    processGlobalPurchase
};