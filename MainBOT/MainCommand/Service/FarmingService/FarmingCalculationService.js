const { RARITY_PRIORITY } = require('../../Configuration/rarity');

const FARMING_STATS = {
    'Common': { coins: 25, gems: 5 },
    'UNCOMMON': { coins: 55, gems: 15 },
    'RARE': { coins: 120, gems: 35 },
    'EPIC': { coins: 250, gems: 75 },
    'OTHERWORLDLY': { coins: 550, gems: 165 },
    'LEGENDARY': { coins: 1200, gems: 360 },
    'MYTHICAL': { coins: 2500, gems: 750 },
    'EXCLUSIVE': { coins: 5500, gems: 1650 },
    '???': { coins: 12000, gems: 3600 },
    'ASTRAL': { coins: 25000, gems: 7500 },
    'CELESTIAL': { coins: 50000, gems: 15000 },
    'INFINITE': { coins: 85000, gems: 25500 },
    'ETERNAL': { coins: 125000, gems: 37500 },
    'TRANSCENDENT': { coins: 375000, gems: 57500 }
};

const BASE_FARM_LIMIT = 5;
const INCOME_INTERVAL = 60000;

function getRarityFromName(fumoName) {
    if (!fumoName) return 'Common';
    return RARITY_PRIORITY.find(r => fumoName.includes(r)) || 'Common';
}

function calculateFarmingStats(fumoName) {
    const rarity = getRarityFromName(fumoName);
    let stats = FARMING_STATS[rarity] || { coins: 0, gems: 0 };
    
    let coinsPerMin = stats.coins;
    let gemsPerMin = stats.gems;

    if (fumoName.includes('✨SHINY')) {
        coinsPerMin *= 2;
        gemsPerMin *= 2;
    }
    if (fumoName.includes('🌟alG')) {
        coinsPerMin *= 100;
        gemsPerMin *= 100;
    }

    return { coinsPerMin, gemsPerMin };
}

function calculateFarmLimit(fragmentUses = 0) {
    return BASE_FARM_LIMIT + fragmentUses;
}

function calculateTotalIncome(farmingFumos, boostMultipliers) {
    let totalCoins = 0;
    let totalGems = 0;

    farmingFumos.forEach(fumo => {
        const quantity = fumo.quantity || 1;
        totalCoins += Math.floor(fumo.coinsPerMin * quantity * boostMultipliers.coinMultiplier);
        totalGems += Math.floor(fumo.gemsPerMin * quantity * boostMultipliers.gemMultiplier);
    });

    return { totalCoins, totalGems };
}

function sortByIncome(farmingFumos) {
    return farmingFumos.sort((a, b) => {
        const totalA = (a.coinsPerMin || 0) + (a.gemsPerMin || 0);
        const totalB = (b.coinsPerMin || 0) + (b.gemsPerMin || 0);
        return totalB - totalA;
    });
}

function groupByRarity(farmingFumos) {
    const grouped = {};
    
    farmingFumos.forEach(fumo => {
        const rarity = getRarityFromName(fumo.fumoName);
        if (!grouped[rarity]) {
            grouped[rarity] = {
                fumos: [],
                totalCoins: 0,
                totalGems: 0
            };
        }
        
        grouped[rarity].fumos.push(fumo);
        grouped[rarity].totalCoins += fumo.coinsPerMin * (fumo.quantity || 1);
        grouped[rarity].totalGems += fumo.gemsPerMin * (fumo.quantity || 1);
    });

    return grouped;
}

module.exports = {
    FARMING_STATS,
    BASE_FARM_LIMIT,
    INCOME_INTERVAL,

    getRarityFromName,
    calculateFarmingStats,
    calculateFarmLimit,
    calculateTotalIncome,
    sortByIncome,
    groupByRarity
};