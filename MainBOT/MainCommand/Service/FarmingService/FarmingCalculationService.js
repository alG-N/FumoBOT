const { RARITY_PRIORITY } = require('../../Configuration/rarity');

const FARMING_STATS = {
    'Common': { coins: 25, gems: 5 },
    'UNCOMMON': { coins: 45, gems: 10 },
    'RARE': { coins: 70, gems: 20 },
    'EPIC': { coins: 100, gems: 35 },
    'OTHERWORLDLY': { coins: 150, gems: 50 },
    'LEGENDARY': { coins: 200, gems: 75 },
    'MYTHICAL': { coins: 350, gems: 115 },
    'EXCLUSIVE': { coins: 500, gems: 150 },
    '???': { coins: 750, gems: 220 },
    'ASTRAL': { coins: 1000, gems: 450 },
    'CELESTIAL': { coins: 2000, gems: 700 },
    'INFINITE': { coins: 3500, gems: 915 },
    'ETERNAL': { coins: 5000, gems: 1150 },
    'TRANSCENDENT': { coins: 175000, gems: 17500 }
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

    // Apply multipliers
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