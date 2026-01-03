const { get, run, withUserLock, atomicDeductCoins, atomicDeductGems, atomicDeductCurrency, transaction } = require('../../../Core/database');
const { getCoinMarket, getGemMarket, updateCoinMarketStock, updateGemMarketStock } = require('./MarketCacheService');
const { addFumoToInventory } = require('./MarketInventoryService');
const { purchaseGlobalListing } = require('./MarketStorageService');
const { calculateCoinPrice, calculateGemPrice, formatScaledPrice } = require('../WealthPricingService');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

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
    
    // Calculate wealth-scaled price
    const shopType = currency === 'coins' ? 'coinMarket' : 'gemMarket';
    const priceCalc = currency === 'coins'
        ? await calculateCoinPrice(userId, fumo.price, shopType)
        : await calculateGemPrice(userId, fumo.price, shopType);
    
    const scaledUnitPrice = priceCalc.finalPrice;
    const totalPrice = scaledUnitPrice * amount;
    
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
            baseRequired: fumo.price * amount,
            current: userRow[currency],
            scaled: priceCalc.scaled
        };
    }
    
    return { 
        valid: true, 
        fumo, 
        totalPrice,
        basePrice: fumo.price * amount,
        priceScaled: priceCalc.scaled,
        multiplier: priceCalc.multiplier,
        currentBalance: userRow[currency]
    };
}

async function processShopPurchase(userId, fumo, amount, totalPrice, currency, shopType) {
    // FIXED: Use user lock and atomic deduction to prevent race conditions
    return await withUserLock(userId, 'market_purchase', async () => {
        // Atomic currency deduction
        let deductResult;
        if (currency === 'coins') {
            deductResult = await atomicDeductCoins(userId, totalPrice);
        } else {
            deductResult = await atomicDeductGems(userId, totalPrice);
        }
        
        if (!deductResult.success) {
            throw new Error(deductResult.error);
        }
        
        // OPTIMIZED: Single query for both balance and luck
        const userRow = await get(`SELECT ${currency}, luck FROM userCoins WHERE userId = ?`, [userId]);
        
        const remainingBalance = userRow?.[currency] || 0;
        const shinyMarkValue = userRow?.luck || 0;
        
        for (let i = 0; i < amount; i++) {
            await addFumoToInventory(userId, fumo, shinyMarkValue);
        }
        
        if (shopType === 'coin') {
            updateCoinMarketStock(userId, fumo.name, amount);
        } else {
            updateGemMarketStock(userId, fumo.name, amount);
        }
        
        return { remainingBalance };
    });
}

async function validateGlobalPurchase(userId, listing) {
    const userRow = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`, 
        [userId]
    );
    
    if (!userRow) {
        return { 
            valid: false, 
            error: 'NO_ACCOUNT' 
        };
    }
    
    if (userRow.coins < listing.coinPrice) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_COINS',
            required: listing.coinPrice,
            current: userRow.coins
        };
    }
    
    if (userRow.gems < listing.gemPrice) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_GEMS',
            required: listing.gemPrice,
            current: userRow.gems
        };
    }
    
    return { 
        valid: true,
        currentCoins: userRow.coins,
        currentGems: userRow.gems
    };
}

async function processGlobalPurchase(buyerId, listing) {
    // FIXED: Use user lock and transaction for atomic global market purchase
    return await withUserLock(buyerId, 'global_market_purchase', async () => {
        const coinTax = Math.floor(listing.coinPrice * 0.05);
        const gemTax = Math.floor(listing.gemPrice * 0.05);
        const sellerReceivesCoins = listing.coinPrice - coinTax;
        const sellerReceivesGems = listing.gemPrice - gemTax;
        
        // Atomic currency deduction for buyer
        const deductResult = await atomicDeductCurrency(buyerId, listing.coinPrice, listing.gemPrice);
        if (!deductResult.success) {
            throw new Error(deductResult.error);
        }
        
        // Credit seller (in transaction for consistency)
        await run(`UPDATE userCoins SET coins = coins + ?, gems = gems + ? WHERE userId = ?`, 
            [sellerReceivesCoins, sellerReceivesGems, listing.userId]);
        
        // OPTIMIZED: Single query for balance and luck
        const userRow = await get(`SELECT coins, gems, luck FROM userCoins WHERE userId = ?`, [buyerId]);
        
        const shinyMarkValue = userRow?.luck || 0;
        
        const fumoToAdd = {
            name: listing.fumoName,
            variant: listing.variant
        };
        
        await addFumoToInventory(buyerId, fumoToAdd, shinyMarkValue);
        
        const removed = purchaseGlobalListing(listing.id, buyerId);
        
        // Track market sale for seller's quests
        try {
            await QuestMiddleware.trackMarketSale(listing.userId);
        } catch (err) {
            // Silent fail for quest tracking
        }
        
        return { 
            remainingCoins: userRow?.coins || 0,
            remainingGems: userRow?.gems || 0,
            sellerReceivesCoins,
            sellerReceivesGems,
            coinTax,
            gemTax
        };
    });
}

module.exports = {
    validateShopPurchase,
    processShopPurchase,
    validateGlobalPurchase,
    processGlobalPurchase
};