function getRarityFromFumoName(fumoName) {
    if (!fumoName) return 'Common';
    const match = fumoName.match(/\((.*?)\)$/);
    if (!match) return 'Common';
    return match[1];
}

function getStatsByRarity(fumoName) {
    const rarity = getRarityFromFumoName(fumoName);
    
    const statMap = {
        Common: [25, 5],
        UNCOMMON: [45, 10],
        RARE: [70, 20],
        EPIC: [100, 35],
        OTHERWORLDLY: [150, 50],
        LEGENDARY: [200, 75],
        MYTHICAL: [350, 115],
        EXCLUSIVE: [500, 150],
        '???': [750, 220],
        ASTRAL: [1000, 450],
        CELESTIAL: [2000, 700],
        INFINITE: [3500, 915],
        ETERNAL: [5000, 1150],
        TRANSCENDENT: [25000, 2500]
    };

    let [coinsPerMin, gemsPerMin] = statMap[rarity] || [0, 0];

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

function calculateFarmingRewards(farmingFumos, duration = 720) {
    let totalCoins = 0;
    let totalGems = 0;

    for (const fumo of farmingFumos) {
        const { coinsPerMin, gemsPerMin } = getStatsByRarity(fumo.fumoName);
        const quantity = fumo.quantity || 1;
        
        totalCoins += coinsPerMin * duration * quantity;
        totalGems += gemsPerMin * duration * quantity;
    }

    return { totalCoins, totalGems };
}

function applyPassiveIncome(duration = 720) {
    const baseCoins = 150;
    const baseGems = 50;
    
    const minutes = duration;
    
    return {
        coins: baseCoins * minutes,
        gems: baseGems * minutes
    };
}

module.exports = {
    getRarityFromFumoName,
    getStatsByRarity,
    calculateFarmingRewards,
    applyPassiveIncome
};