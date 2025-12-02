const { ITEM_DEFINITIONS, RARITY_THRESHOLDS, STOCK_RANGES } = require('../../../Configuration/shopConfig');
const { debugLog } = require('../../../Core/logger');

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isDoubleLuckDay() {
    const day = new Date().getDay();
    return day === 5 || day === 6 || day === 0;
}

// ??? guaranteed every 6 hours (0, 6, 12, 18)
function isGuaranteedMysteryBlock() {
    const hour = new Date().getUTCHours();
    return hour % 6 === 0;
}

// Unknown guaranteed once per day at midnight UTC
function isGuaranteedUnknownBlock() {
    const hour = new Date().getUTCHours();
    return hour === 0;
}

// Prime guaranteed every 3 days at midnight UTC
function isGuaranteedPrimeBlock() {
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const hour = now.getUTCHours();
    return (dayOfYear % 3 === 0) && hour === 0;
}

function assignStock(rarity, forceMystery = false, forceUnknown = false, forcePrime = false) {
    // CRITICAL: Force stock for guaranteed items
    if (forceMystery && rarity === '???') {
        return { 
            stock: getRandomInt(...STOCK_RANGES.MYSTERY), 
            message: '🎁 GUARANTEED Stock!' 
        };
    }

    if (forceUnknown && rarity === 'Unknown') {
        return {
            stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE),
            message: '🌀 GUARANTEED Ultra Rare!'
        };
    }

    if (forcePrime && rarity === 'Prime') {
        return {
            stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE),
            message: '👑 GUARANTEED PRIME!'
        };
    }

    // Ultra-rare handling (Unknown/Prime without guarantee)
    if (rarity === 'Unknown' || rarity === 'Prime') {
        const rand = Math.random();
        
        // 0.1% chance for lucky stock
        if (rand <= 0.001) {
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE_LUCKY),
                message: '⭐ MIRACULOUS Stock!'
            };
        }
        
        // 5% chance for normal stock (was 15%, made MUCH rarer)
        if (rand <= 0.05) {
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE),
                message: 'Ultra Rare Stock'
            };
        }
        
        return { stock: 0, message: 'Out of Stock' };
    }

    // ??? handling without guarantee
    if (rarity === '???') {
        const rand = Math.random();
        
        // 2% chance for stock (was higher in threshold)
        if (rand <= 0.02) {
            return {
                stock: getRandomInt(...STOCK_RANGES.MYSTERY),
                message: 'Mysterious Stock'
            };
        }
        
        return { stock: 0, message: 'Out of Stock' };
    }

    // Standard rarity handling
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

function createItem(basePrice, currency, rarity, forceMystery = false, forceUnknown = false, forcePrime = false) {
    const { cost, priceTag } = randomizePrice(basePrice);
    const stockData = assignStock(rarity, forceMystery, forceUnknown, forcePrime);
    
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
    
    // Check guarantees
    const guaranteeMystery = isGuaranteedMysteryBlock();
    const guaranteeUnknown = isGuaranteedUnknownBlock();
    const guaranteePrime = isGuaranteedPrimeBlock();
    
    let mysteryGiven = false;
    let unknownGiven = false;
    let primeGiven = false;

    debugLog('SHOP', `Generating shop - Mystery: ${guaranteeMystery}, Unknown: ${guaranteeUnknown}, Prime: ${guaranteePrime}`);

    const shuffledItems = [...ITEM_DEFINITIONS].sort(() => Math.random() - 0.5);

    for (const def of shuffledItems) {
        let forceMystery = false;
        let forceUnknown = false;
        let forcePrime = false;

        // Apply guarantees
        if (def.rarity === '???' && guaranteeMystery && !mysteryGiven) {
            forceMystery = true;
            mysteryGiven = true;
            debugLog('SHOP', `Guaranteed ??? item: ${def.name}`);
        }

        if (def.rarity === 'Unknown' && guaranteeUnknown && !unknownGiven) {
            forceUnknown = true;
            unknownGiven = true;
            debugLog('SHOP', `Guaranteed Unknown item: ${def.name}`);
        }

        if (def.rarity === 'Prime' && guaranteePrime && !primeGiven) {
            forcePrime = true;
            primeGiven = true;
            debugLog('SHOP', `Guaranteed Prime item: ${def.name}`);
        }

        shop[def.name] = createItem(def.basePrice, def.currency, def.rarity, forceMystery, forceUnknown, forcePrime);
    }

    // Ensure minimum stock items
    const itemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    
    if (itemsWithStock.length < 3) {
        debugLog('SHOP', `Only ${itemsWithStock.length} items with stock, forcing minimum stock on random items`);
        
        const itemsWithoutStock = Object.keys(shop).filter(key => {
            const item = shop[key];
            // Don't force stock on ultra-rares unless it's their guarantee time
            if (item.rarity === 'Unknown' || item.rarity === 'Prime') return false;
            return item.stock === 0;
        });

        const itemsToFix = Math.min(3 - itemsWithStock.length, itemsWithoutStock.length);
        
        for (let i = 0; i < itemsToFix; i++) {
            const randomIndex = Math.floor(Math.random() * itemsWithoutStock.length);
            const itemName = itemsWithoutStock.splice(randomIndex, 1)[0];
            const item = shop[itemName];
            
            const def = ITEM_DEFINITIONS.find(d => d.name === itemName);
            if (def) {
                const stockRange = def.rarity === '???' ? STOCK_RANGES.MYSTERY : STOCK_RANGES.ON_STOCK;
                item.stock = getRandomInt(...stockRange);
                item.message = 'On-Stock';
                debugLog('SHOP', `Forced stock on ${itemName}: ${item.stock}`);
            }
        }
    }

    debugLog('SHOP', `Generated shop with ${Object.keys(shop).length} items, ${itemsWithStock.length} in stock`);
    return shop;
}

module.exports = {
    generateUserShop,
    isDoubleLuckDay,
    isGuaranteedMysteryBlock,
    isGuaranteedUnknownBlock,
    isGuaranteedPrimeBlock,
    getRandomInt
};