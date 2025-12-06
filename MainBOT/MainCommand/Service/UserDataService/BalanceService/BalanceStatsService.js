const { getStatsByRarity } = require('../../../Ultility/characterStats');
const { formatNumber } = require('../../../Ultility/formatting');

function calculateTotalFarmingRate(farmingFumos) {
    let totalCoins = 0;
    let totalGems = 0;
    
    for (const fumo of farmingFumos) {
        const { coinsPerMin, gemsPerMin } = getStatsByRarity(fumo.fumoName);
        const quantity = fumo.quantity || 1;
        
        totalCoins += coinsPerMin * quantity;
        totalGems += gemsPerMin * quantity;
    }
    
    return { totalCoins, totalGems };
}

function calculateBoostMultipliers(activeBoosts) {
    let coinMultiplier = 1;
    let gemMultiplier = 1;
    const boostDetails = {
        coin: [],
        gem: [],
        income: []
    };
    
    for (const boost of activeBoosts) {
        const type = boost.type.toLowerCase();
        const mult = boost.multiplier;
        const source = boost.source;
        
        if (type === 'coin' || type === 'income') {
            coinMultiplier *= mult;
            boostDetails.coin.push({ source, multiplier: mult });
        }
        
        if (type === 'gem' || type === 'gems' || type === 'income') {
            gemMultiplier *= mult;
            boostDetails.gem.push({ source, multiplier: mult });
        }
        
        if (type === 'income') {
            boostDetails.income.push({ source, multiplier: mult });
        }
    }
    
    return {
        coinMultiplier,
        gemMultiplier,
        boostDetails
    };
}

function calculateNetWorth(userData) {
    const coinValue = userData.coins || 0;
    const gemValue = (userData.gems || 0) * 10;
    const tokenValue = (userData.spiritTokens || 0) * 1000;
    
    return coinValue + gemValue + tokenValue;
}

function calculateEfficiency(userData) {
    const totalRolls = userData.totalRolls || 1;
    const yukariCoins = userData.yukariCoins || 0;
    const yukariGems = userData.yukariGems || 0;
    
    const coinsPerRoll = yukariCoins / totalRolls;
    const gemsPerRoll = yukariGems / totalRolls;
    
    return {
        coinsPerRoll,
        gemsPerRoll,
        totalEfficiency: coinsPerRoll + (gemsPerRoll * 10)
    };
}

function getLevelProgress(userData) {
    const currentLevel = userData.level || 1;
    const currentExp = userData.exp || 0;
    const expToNextLevel = calculateExpRequired(currentLevel);
    const progress = (currentExp / expToNextLevel) * 100;
    
    return {
        currentLevel,
        currentExp,
        expToNextLevel,
        progress: Math.min(progress, 100)
    };
}

function calculateExpRequired(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
}

function getPlayerRank(userData) {
    const netWorth = calculateNetWorth(userData);
    const level = userData.level || 1;
    const rebirth = userData.rebirth || 0;
    
    const rankScore = (netWorth / 1e9) + (level * 10) + (rebirth * 1000);
    
    if (rankScore >= 10000) return { rank: 'Transcendent', emoji: '🌈', tier: 10 };
    if (rankScore >= 5000) return { rank: 'Eternal', emoji: '🪐', tier: 9 };
    if (rankScore >= 2500) return { rank: 'Celestial', emoji: '✨', tier: 8 };
    if (rankScore >= 1000) return { rank: 'Astral', emoji: '🌠', tier: 7 };
    if (rankScore >= 500) return { rank: 'Mythical', emoji: '🔴', tier: 6 };
    if (rankScore >= 250) return { rank: 'Legendary', emoji: '🟠', tier: 5 };
    if (rankScore >= 100) return { rank: 'Epic', emoji: '🟣', tier: 4 };
    if (rankScore >= 50) return { rank: 'Rare', emoji: '🔵', tier: 3 };
    if (rankScore >= 25) return { rank: 'Uncommon', emoji: '🟢', tier: 2 };
    return { rank: 'Common', emoji: '⚪', tier: 1 };
}

function calculateDailyValue(farmingRate, boostMultipliers) {
    const minutesPerDay = 1440;
    
    const dailyCoins = farmingRate.totalCoins * minutesPerDay * boostMultipliers.coinMultiplier;
    const dailyGems = farmingRate.totalGems * minutesPerDay * boostMultipliers.gemMultiplier;
    
    return {
        coins: Math.floor(dailyCoins),
        gems: Math.floor(dailyGems),
        total: Math.floor(dailyCoins + (dailyGems * 10))
    };
}

function getPityProgress(userData) {
    const pities = {
        transcendent: {
            current: userData.rollsSinceLastQuestionMark || 0,
            max: 1500000,
            name: 'Transcendent'
        },
        eternal: {
            current: userData.pityEternal || 0,
            max: 500000,
            name: 'Eternal'
        },
        infinite: {
            current: userData.pityInfinite || 0,
            max: 200000,
            name: 'Infinite'
        },
        celestial: {
            current: userData.pityCelestial || 0,
            max: 90000,
            name: 'Celestial'
        },
        astral: {
            current: userData.pityAstral || 0,
            max: 30000,
            name: 'Astral'
        }
    };
    
    return pities;
}

function getStreakRewards(streak) {
    const baseReward = 1000;
    const multiplier = Math.min(streak, 30);
    
    return {
        coins: baseReward * multiplier,
        gems: Math.floor((baseReward * multiplier) / 10)
    };
}

module.exports = {
    calculateTotalFarmingRate,
    calculateBoostMultipliers,
    calculateNetWorth,
    calculateEfficiency,
    getLevelProgress,
    getPlayerRank,
    calculateDailyValue,
    getPityProgress,
    getStreakRewards
};