const FumoPool = require('../../../Data/FumoPool');
const { 
    rarityLevels,
    gemShopRarityLevels,
    COIN_MIN_SIZE,
    COIN_MAX_SIZE,
    GEM_MIN_SIZE,
    GEM_MAX_SIZE
} = require('../../../Configuration/marketConfig');

function getRandomStock(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function extractRarity(name) {
    const match = name.match(/\(([^)]+)\)$/);
    return match ? match[1] : null;
}

function getRarityData(rarityName, levels) {
    return levels.find(r => r.name.toLowerCase() === rarityName?.toLowerCase());
}

function selectFumosByRarity(fumoPool, levels, minSize, maxSize) {
    const selected = [];
    const usedNames = new Set();

    for (const fumo of fumoPool) {
        const rarity = getRarityData(fumo.rarity, levels);
        
        if (!rarity || usedNames.has(fumo.name)) continue;
        
        if (Math.random() < rarity.chance) {
            selected.push({
                name: fumo.name,
                price: fumo.price,
                rarity: rarity.name,
                stock: getRandomStock(rarity.minStock, rarity.maxStock),
                picture: fumo.picture
            });
            usedNames.add(fumo.name);
        }
    }

    const candidates = fumoPool.filter(f => !usedNames.has(f.name));
    while (selected.length < minSize && candidates.length > 0) {
        const idx = Math.floor(Math.random() * candidates.length);
        const fumo = candidates.splice(idx, 1)[0];
        const rarity = getRarityData(fumo.rarity, levels);
        
        if (!rarity || usedNames.has(fumo.name)) continue;

        selected.push({
            name: fumo.name,
            price: fumo.price,
            rarity: rarity.name,
            stock: getRandomStock(rarity.minStock, rarity.maxStock),
            picture: fumo.picture
        });
        usedNames.add(fumo.name);
    }

    if (selected.length > maxSize) {
        selected.splice(maxSize);
    }

    return selected;
}

function generateCoinMarket(userId) {
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

    return selectFumosByRarity(fumoPool, rarityLevels, COIN_MIN_SIZE, COIN_MAX_SIZE);
}

function generateGemMarket(userId) {
    const marketFumos = FumoPool.getForMarket();
    const fumoPool = marketFumos
        .map(fumo => {
            const rarity = extractRarity(fumo.name);
            return {
                name: fumo.name,
                price: Math.floor(fumo.price / 10),
                rarity: rarity,
                picture: fumo.picture || null
            };
        })
        .filter(fumo => {
            const rarityIndex = gemShopRarityLevels.findIndex(r => r.name === fumo.rarity);
            return rarityIndex !== -1;
        });

    return selectFumosByRarity(fumoPool, gemShopRarityLevels, GEM_MIN_SIZE, GEM_MAX_SIZE);
}

module.exports = {
    generateCoinMarket,
    generateGemMarket,
    getRandomStock,
    extractRarity,
    getRarityData
};