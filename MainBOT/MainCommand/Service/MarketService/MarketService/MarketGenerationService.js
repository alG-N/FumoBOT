const FumoPool = require('../../../Data/FumoPool');
const { 
    rarityLevels, 
    HIGH_RARITIES, 
    CELESTIAL_PLUS,
    MIN_MARKET_SIZE,
    MAX_MARKET_SIZE_BASE,
    MAX_MARKET_SIZE_RANGE
} = require('../../../Configuration/marketConfig');
const { debugLog } = require('../../../Core/logger');

function getRandomStock(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function extractRarity(name) {
    const match = name.match(/\(([^)]+)\)$/);
    return match ? match[1] : null;
}

function getRarityData(rarityName) {
    return rarityLevels.find(r => r.name.toLowerCase() === rarityName?.toLowerCase());
}

function applyBuffs(levels, consecutiveMisses = 0) {
    const day = new Date().getDay();
    const isWeekend = [0, 5, 6].includes(day);
    const scaleFactor = 0.05 * consecutiveMisses;

    return levels.map(r => {
        if (!HIGH_RARITIES.includes(r.name)) return { ...r };
        
        let buffedChance = r.chance;
        if (consecutiveMisses > 0) buffedChance *= (1 + scaleFactor);
        if (isWeekend) buffedChance *= 2;
        
        return { ...r, chance: buffedChance };
    });
}

function generateUserMarket(userId) {
    debugLog('MARKET_GEN', `Generating market for user ${userId}`);
    
    let consecutiveMisses = 0;
    const effectiveLevels = applyBuffs(rarityLevels, consecutiveMisses);
    const usedNames = new Set();
    const selected = [];

    const marketFumos = FumoPool.getForMarket();
    const fumoPool = marketFumos.map(fumo => {
        const rarity = extractRarity(fumo.name);
        return {
            name: fumo.name,
            price: fumo.price,
            rarity: rarity,
            picture: fumo.picture || null
        };
    });

    // Main loop - add fumos based on their rarity chance
    for (const fumo of fumoPool) {
        const rarity = getRarityData(fumo.rarity);
        
        // Skip if already in market or no rarity data or failed chance
        if (!rarity || usedNames.has(fumo.name) || Math.random() >= rarity.chance) continue;

        selected.push({
            name: fumo.name,
            price: fumo.price,
            rarity: rarity.name,
            stock: getRandomStock(rarity.minStock, rarity.maxStock),
            picture: fumo.picture
        });
        usedNames.add(fumo.name);
    }

    // Fill to minimum - add random fumos if we don't have enough
    const candidates = fumoPool.filter(f => !usedNames.has(f.name));
    while (selected.length < MIN_MARKET_SIZE && candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        const fumo = candidates.splice(idx, 1)[0];
        const rarity = getRarityData(fumo.rarity);
        
        if (!rarity) continue;

        // Double-check name isn't used (safety check)
        if (usedNames.has(fumo.name)) continue;

        selected.push({
            name: fumo.name,
            price: fumo.price,
            rarity: rarity.name,
            stock: getRandomStock(rarity.minStock, rarity.maxStock),
            picture: fumo.picture
        });
        usedNames.add(fumo.name);
    }

    // Trim to maximum size if needed
    if (selected.length > MAX_MARKET_SIZE_BASE) {
        const maxSize = MAX_MARKET_SIZE_BASE + Math.floor(Math.random() * MAX_MARKET_SIZE_RANGE);
        selected.splice(maxSize);
    }

    // Guarantee high rarity - replace first slot if needed
    const hasHighRarity = selected.some(f => HIGH_RARITIES.includes(f.rarity));
    if (!hasHighRarity) {
        const highRarityFumos = fumoPool.filter(f => 
            HIGH_RARITIES.includes(f.rarity) && !usedNames.has(f.name)
        );
        
        if (highRarityFumos.length > 0 && selected.length > 0) {
            const forced = highRarityFumos[Math.floor(Math.random() * highRarityFumos.length)];
            const rarity = getRarityData(forced.rarity);
            
            // Remove the old first item from usedNames
            usedNames.delete(selected[0].name);
            
            selected[0] = {
                name: forced.name,
                price: forced.price,
                rarity: rarity.name,
                stock: getRandomStock(rarity.minStock, rarity.maxStock),
                picture: forced.picture
            };
            usedNames.add(forced.name);
        }
    }

    // Guarantee celestial+ - replace second slot if needed
    const hasCelestialPlus = selected.some(f => CELESTIAL_PLUS.includes(f.rarity));
    if (!hasCelestialPlus) {
        const celestialFumos = fumoPool.filter(f => 
            CELESTIAL_PLUS.includes(f.rarity) && !usedNames.has(f.name)
        );
        
        if (celestialFumos.length > 0 && selected.length > 1) {
            const forced = celestialFumos[Math.floor(Math.random() * celestialFumos.length)];
            const rarity = getRarityData(forced.rarity);
            
            // Remove the old second item from usedNames
            usedNames.delete(selected[1].name);
            
            selected[1] = {
                name: forced.name,
                price: forced.price,
                rarity: rarity.name,
                stock: getRandomStock(rarity.minStock, rarity.maxStock),
                picture: forced.picture
            };
            usedNames.add(forced.name);
        }
    }

    debugLog('MARKET_GEN', `Generated market with ${selected.length} items`);
    return selected;
}

module.exports = {
    generateUserMarket,
    getRandomStock,
    extractRarity,
    getRarityData,
    applyBuffs
};