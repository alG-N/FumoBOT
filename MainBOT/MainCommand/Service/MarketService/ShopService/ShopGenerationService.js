const { ITEM_DEFINITIONS, RARITY_THRESHOLDS, STOCK_RANGES } = require('../../../Configuration/shopConfig');
const { debugLog } = require('../../../Core/logger');

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isDoubleLuckDay() {
    const day = new Date().getDay();
    return day === 5 || day === 6 || day === 0;
}

function isGuaranteedMysteryBlock() {
    const hour = new Date().getUTCHours();
    return hour % 6 === 0;
}

function assignStock(rarity, forceMystery = false) {
    if (rarity === '???' && forceMystery) {
        return { 
            stock: getRandomInt(...STOCK_RANGES.MYSTERY), 
            message: 'On-Stock' 
        };
    }

    // Special handling for Unknown and Prime - no unlimited stock
    if (rarity === 'Unknown' || rarity === 'Prime') {
        const rand = Math.random();
        
        // 0.1% chance for 3-5 stock
        if (rand <= 0.001) {
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE_LUCKY),
                message: 'MIRACULOUS Stock!'
            };
        }
        
        // Normal case: 1-2 stock or out of stock
        const stockRand = Math.random();
        if (stockRand <= 0.15) { // 15% chance for stock
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE),
                message: 'Ultra Rare Stock'
            };
        }
        
        return { stock: 0, message: 'Out of Stock' };
    }

    // Existing logic for other rarities
    const thresholds = RARITY_THRESHOLDS[rarity] || [];
    if (thresholds.length === 0) {
        return { stock: 0, message: 'Out of Stock' };
    }

    let rand = Math.random();
    if (isDoubleLuckDay() && rarity !== '???') {
        rand = Math.min(rand * 0.5, 1);
    }

    if (rand <= thresholds[0]) {
        return { stock: 'unlimited', message: '!!!U*L?M%2D!!!' };
    }
    if (thresholds[1] && rand <= thresholds[1]) {
        return { stock: getRandomInt(...STOCK_RANGES.LEGENDARY), message: 'LEGENDARY stock' };
    }
    if (thresholds[2] && rand <= thresholds[2]) {
        return { stock: getRandomInt(...STOCK_RANGES.LOTS), message: 'A lot of items.' };
    }
    if (thresholds[3] && rand <= thresholds[3]) {
        return { stock: getRandomInt(...STOCK_RANGES.ON_STOCK), message: 'On-Stock' };
    }

    return { stock: 0, message: 'Out of Stock' };
}

function randomizePrice(basePrice) {
    const eventChance = Math.random();
    let variationPercent = 20;
    let priceTag = 'NORMAL';

    if (eventChance < 0.1) {
        variationPercent = -40;
        priceTag = 'SALE';
    } else if (eventChance > 0.9) {
        variationPercent = 50;
        priceTag = 'SURGE';
    }

    const variation = basePrice * (variationPercent / 100);
    const min = Math.floor(basePrice + Math.min(0, variation));
    const max = Math.ceil(basePrice + Math.max(0, variation));
    const cost = getRandomInt(min, max);

    return { cost, priceTag };
}

function createItem(basePrice, currency, rarity, forceMystery = false) {
    const { cost, priceTag } = randomizePrice(basePrice);
    const stockData = assignStock(rarity, forceMystery);
    
    return {
        cost,
        priceTag,
        currency,
        ...stockData,
        rarity
    };
}

function generateUserShop() {
    const shop = {};
    let guaranteedMysteryGiven = false;
    const guaranteeMystery = isGuaranteedMysteryBlock();

    const shuffledItems = [...ITEM_DEFINITIONS].sort(() => Math.random() - 0.5);

    for (const def of shuffledItems) {
        const forceMystery = def.rarity === '???' && guaranteeMystery && !guaranteedMysteryGiven;
        if (forceMystery) guaranteedMysteryGiven = true;

        shop[def.name] = createItem(def.basePrice, def.currency, def.rarity, forceMystery);
    }

    // CRITICAL FIX: Guarantee at least 3 items have stock
    const itemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    
    if (itemsWithStock.length < 3) {
        debugLog('SHOP', `Only ${itemsWithStock.length} items with stock, forcing minimum stock on random items`);
        
        const itemsWithoutStock = Object.keys(shop).filter(key => {
            const item = shop[key];
            return item.stock === 0;
        });

        // Force stock on random items until we have at least 3
        const itemsToFix = Math.min(3 - itemsWithStock.length, itemsWithoutStock.length);
        
        for (let i = 0; i < itemsToFix; i++) {
            const randomIndex = Math.floor(Math.random() * itemsWithoutStock.length);
            const itemName = itemsWithoutStock.splice(randomIndex, 1)[0];
            const item = shop[itemName];
            
            // Find the item definition to get stock ranges
            const def = ITEM_DEFINITIONS.find(d => d.name === itemName);
            if (def) {
                const stockRange = def.rarity === '???' ? STOCK_RANGES.MYSTERY : STOCK_RANGES.ON_STOCK;
                item.stock = getRandomInt(...stockRange);
                item.message = 'On-Stock';
                debugLog('SHOP', `Forced stock on ${itemName}: ${item.stock}`);
            }
        }
    }

    debugLog('SHOP', `Generated shop with ${Object.keys(shop).length} items`);
    return shop;
}

module.exports = {
    generateUserShop,
    isDoubleLuckDay,
    isGuaranteedMysteryBlock,
    getRandomInt
};