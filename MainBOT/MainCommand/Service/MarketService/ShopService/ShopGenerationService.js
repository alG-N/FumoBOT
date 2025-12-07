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

// Unknown guaranteed every 12 hours (0, 12)
function isGuaranteedUnknownBlock() {
    const hour = new Date().getUTCHours();
    return hour % 12 === 0;
}

// Prime guaranteed every 24 hours at midnight UTC
function isGuaranteedPrimeBlock() {
    const hour = new Date().getUTCHours();
    return hour === 0;
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
    console.log('[SHOP_GEN] Starting shop generation...');
    const shop = {};
    
    // Check guarantees
    const guaranteeMystery = isGuaranteedMysteryBlock();
    const guaranteeUnknown = isGuaranteedUnknownBlock();
    const guaranteePrime = isGuaranteedPrimeBlock();
    
    console.log('[SHOP_GEN] Guarantees - Mystery:', guaranteeMystery, 'Unknown:', guaranteeUnknown, 'Prime:', guaranteePrime);
    debugLog('SHOP', `Generating shop - Mystery: ${guaranteeMystery}, Unknown: ${guaranteeUnknown}, Prime: ${guaranteePrime}`);

    let mysteryGiven = false;
    let unknownGiven = false;
    let primeGiven = false;

    const shuffledItems = [...ITEM_DEFINITIONS].sort(() => Math.random() - 0.5);
    console.log('[SHOP_GEN] Processing', shuffledItems.length, 'items');

    for (const def of shuffledItems) {
        let forceMystery = false;
        let forceUnknown = false;
        let forcePrime = false;

        // Apply guarantees
        if (def.rarity === '???' && guaranteeMystery && !mysteryGiven) {
            forceMystery = true;
            mysteryGiven = true;
            console.log('[SHOP_GEN] Guaranteed ??? item:', def.name);
            debugLog('SHOP', `Guaranteed ??? item: ${def.name}`);
        }

        if (def.rarity === 'Unknown' && guaranteeUnknown && !unknownGiven) {
            forceUnknown = true;
            unknownGiven = true;
            console.log('[SHOP_GEN] Guaranteed Unknown item:', def.name);
            debugLog('SHOP', `Guaranteed Unknown item: ${def.name}`);
        }

        if (def.rarity === 'Prime' && guaranteePrime && !primeGiven) {
            forcePrime = true;
            primeGiven = true;
            console.log('[SHOP_GEN] Guaranteed Prime item:', def.name);
            debugLog('SHOP', `Guaranteed Prime item: ${def.name}`);
        }

        shop[def.name] = createItem(def.basePrice, def.currency, def.rarity, forceMystery, forceUnknown, forcePrime);
    }

    // ✅ CRITICAL FIX: Ensure AT LEAST 8 items with stock (increased from 5)
    const itemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    console.log('[SHOP_GEN] Items with stock before minimum check:', itemsWithStock.length);
    
    const MINIMUM_STOCK_ITEMS = 8; // Increased minimum
    
    if (itemsWithStock.length < MINIMUM_STOCK_ITEMS) {
        console.log('[SHOP_GEN] Only', itemsWithStock.length, 'items with stock, forcing minimum...');
        debugLog('SHOP', `Only ${itemsWithStock.length} items with stock, forcing minimum stock on random items`);
        
        // Get items that SHOULD have stock (Common to Legendary)
        const itemsWithoutStock = Object.keys(shop).filter(key => {
            const item = shop[key];
            
            // ALWAYS allow these rarities to get forced stock
            const allowedRarities = ['Basic', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];
            
            // Allow ultra-rares ONLY if it's their guarantee time
            if (item.rarity === 'Unknown' && guaranteeUnknown && item.stock === 0) return true;
            if (item.rarity === 'Prime' && guaranteePrime && item.stock === 0) return true;
            if (item.rarity === '???' && guaranteeMystery && item.stock === 0) return true;
            
            // For normal rarities, only select if no stock
            return allowedRarities.includes(item.rarity) && item.stock === 0;
        });

        const itemsToFix = Math.min(MINIMUM_STOCK_ITEMS - itemsWithStock.length, itemsWithoutStock.length);
        console.log('[SHOP_GEN] Forcing stock on', itemsToFix, 'items from pool of', itemsWithoutStock.length);
        
        // Prioritize by rarity (lower rarity = higher priority)
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
        
        // Force stock on the lowest rarity items first
        for (let i = 0; i < itemsToFix; i++) {
            const itemName = sortedItems[i];
            const item = shop[itemName];
            const def = ITEM_DEFINITIONS.find(d => d.name === itemName);
            
            if (def) {
                let stockRange;
                
                // Use appropriate stock ranges
                if (def.rarity === '???' || def.rarity === 'Unknown' || def.rarity === 'Prime') {
                    stockRange = STOCK_RANGES.ULTRA_RARE; // [1, 1]
                } else if (def.rarity === 'Legendary' || def.rarity === 'Mythical' || def.rarity === 'Divine') {
                    stockRange = STOCK_RANGES.LOTS; // [3, 15]
                } else {
                    stockRange = STOCK_RANGES.LEGENDARY; // [15, 30]
                }
                
                item.stock = getRandomInt(...stockRange);
                item.message = 'On-Stock';
                console.log('[SHOP_GEN] Forced stock on', itemName, '(', def.rarity, '):', item.stock);
                debugLog('SHOP', `Forced stock on ${itemName} (${def.rarity}): ${item.stock}`);
            }
        }
    }

    const finalItemsWithStock = Object.values(shop).filter(item => item.stock > 0 || item.stock === 'unlimited');
    console.log('[SHOP_GEN] Final items with stock:', finalItemsWithStock.length);
    debugLog('SHOP', `Generated shop with ${Object.keys(shop).length} items, ${finalItemsWithStock.length} in stock`);
    
    // Detailed debug log
    if (finalItemsWithStock.length > 0) {
        const stockSummary = finalItemsWithStock.map(item => {
            const itemName = Object.keys(shop).find(key => shop[key] === item);
            return `${itemName}: ${item.stock} (${item.rarity})`;
        }).join(', ');
        console.log('[SHOP_GEN] Stock summary:', stockSummary);
        debugLog('SHOP', `Items in stock: ${stockSummary}`);
    } else {
        console.error('⚠️ [SHOP_GEN] NO ITEMS IN STOCK! This should not happen.');
        debugLog('SHOP', '⚠️ NO ITEMS IN STOCK! This should not happen.');
    }
    
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