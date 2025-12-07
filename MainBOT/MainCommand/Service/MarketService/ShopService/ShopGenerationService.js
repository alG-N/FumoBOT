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

function isGuaranteedUnknownBlock() {
    const hour = new Date().getUTCHours();
    return hour % 12 === 0;
}

function isGuaranteedPrimeBlock() {
    const hour = new Date().getUTCHours();
    return hour === 0;
}

function assignStock(rarity, forceMystery = false, forceUnknown = false, forcePrime = false) {
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

    if (rarity === 'Unknown' || rarity === 'Prime') {
        const rand = Math.random();

        if (rand <= 0.001) {
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE_LUCKY),
                message: '⭐ MIRACULOUS Stock!'
            };
        }

        if (rand <= 0.05) {
            return {
                stock: getRandomInt(...STOCK_RANGES.ULTRA_RARE),
                message: 'Ultra Rare Stock'
            };
        }

        return { stock: 0, message: 'Out of Stock' };
    }

    if (rarity === '???') {
        const rand = Math.random();

        if (rand <= 0.02) {
            return {
                stock: getRandomInt(...STOCK_RANGES.MYSTERY),
                message: 'Mysterious Stock'
            };
        }

        return { stock: 0, message: 'Out of Stock' };
    }

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
    
    const guaranteeMystery = isGuaranteedMysteryBlock();
    const guaranteeUnknown = isGuaranteedUnknownBlock();
    const guaranteePrime = isGuaranteedPrimeBlock();
    
    debugLog('SHOP', `Generating shop - Mystery: ${guaranteeMystery}, Unknown: ${guaranteeUnknown}, Prime: ${guaranteePrime}`);

    let mysteryGiven = false;
    let unknownGiven = false;
    let primeGiven = false;

    const shuffledItems = [...ITEM_DEFINITIONS].sort(() => Math.random() - 0.5);

    for (const def of shuffledItems) {
        let forceMystery = false;
        let forceUnknown = false;
        let forcePrime = false;

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

    const itemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    
    const MINIMUM_STOCK_ITEMS = 8;
    
    if (itemsWithStock.length < MINIMUM_STOCK_ITEMS) {
        debugLog('SHOP', `Only ${itemsWithStock.length} items with stock, forcing minimum stock on random items`);
        
        const itemsWithoutStock = Object.keys(shop).filter(key => {
            const item = shop[key];
            
            const allowedRarities = ['Basic', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];
            
            if (item.rarity === 'Unknown' && guaranteeUnknown && item.stock === 0) return true;
            if (item.rarity === 'Prime' && guaranteePrime && item.stock === 0) return true;
            if (item.rarity === '???' && guaranteeMystery && item.stock === 0) return true;
            
            return allowedRarities.includes(item.rarity) && item.stock === 0;
        });

        const itemsToFix = Math.min(MINIMUM_STOCK_ITEMS - itemsWithStock.length, itemsWithoutStock.length);
        
        const rarityPriority = {
            'Basic': 1,
            'Common': 2,
            'Rare': 3,
            'Epic': 4,
            'Legendary': 5,
            'Mythical': 6,
            'Divine': 7,
            '???': 8,
            'Unknown': 9,
            'Prime': 10
        };
        
        const sortedItems = itemsWithoutStock.sort((a, b) => {
            const rarityA = shop[a].rarity;
            const rarityB = shop[b].rarity;
            return rarityPriority[rarityA] - rarityPriority[rarityB];
        });
        
        for (let i = 0; i < itemsToFix; i++) {
            const itemName = sortedItems[i];
            const item = shop[itemName];
            const def = ITEM_DEFINITIONS.find(d => d.name === itemName);
            
            if (def) {
                let stockRange;
                
                if (def.rarity === '???' || def.rarity === 'Unknown' || def.rarity === 'Prime') {
                    stockRange = STOCK_RANGES.ULTRA_RARE;
                } else if (def.rarity === 'Legendary' || def.rarity === 'Mythical' || def.rarity === 'Divine') {
                    stockRange = STOCK_RANGES.LOTS;
                } else {
                    stockRange = STOCK_RANGES.LEGENDARY;
                }
                
                item.stock = getRandomInt(...stockRange);
                item.message = 'On-Stock';
                debugLog('SHOP', `Forced stock on ${itemName} (${def.rarity}): ${item.stock}`);
            }
        }
    }

    const finalItemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    debugLog('SHOP', `Generated shop with ${Object.keys(shop).length} items, ${finalItemsWithStock.length} in stock`);
    
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