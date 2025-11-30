const BUILDING_TYPES = {
    COIN_BOOST: {
        id: 'coin_boost',
        name: 'Coin Production',
        emoji: '💰',
        description: 'Increase coin generation from farming',
        maxLevel: 50,
        baseMultiplier: 0.05,
        baseCost: {
            coins: 500000,
            gems: 10000
        },
        costMultiplier: 2.5 
    },
    GEM_BOOST: {
        id: 'gem_boost',
        name: 'Gem Production',
        emoji: '💎',
        description: 'Increase gem generation from farming',
        maxLevel: 50,
        baseMultiplier: 0.05,
        baseCost: {
            coins: 250000,
            gems: 5000
        },
        costMultiplier: 2.5
    },
    CRITICAL_FARMING: {
        id: 'critical_farming',
        name: 'Critical Farming',
        emoji: '⚡',
        description: 'Chance to get 3x rewards from farming ticks',
        maxLevel: 20,
        baseChance: 0.02,
        baseCost: {
            coins: 1000000,
            gems: 25000
        },
        costMultiplier: 5.0,
        criticalMultiplier: 3
    },
    EVENT_BOOST: {
        id: 'event_boost',
        name: 'Event Amplifier',
        emoji: '🌟',
        description: 'Amplify seasonal event multipliers',
        maxLevel: 30,
        baseMultiplier: 0.03,
        baseCost: {
            coins: 15000000,
            gems: 350000
        },
        costMultiplier: 10.5
    }
};

function calculateUpgradeCost(buildingType, currentLevel) {
    const building = BUILDING_TYPES[buildingType];
    if (!building) return null;
    
    const coinCost = Math.floor(
        building.baseCost.coins * Math.pow(building.costMultiplier, currentLevel)
    );
    const gemCost = Math.floor(
        building.baseCost.gems * Math.pow(building.costMultiplier, currentLevel)
    );
    
    return { coins: coinCost, gems: gemCost };
}

function calculateBuildingMultiplier(buildingType, level) {
    const building = BUILDING_TYPES[buildingType];
    if (!building) return 1;
    
    if (buildingType === 'CRITICAL_FARMING') {
        return building.baseChance * level;
    }
    
    return 1 + (building.baseMultiplier * level);
}

function calculateCriticalChance(level) {
    const building = BUILDING_TYPES.CRITICAL_FARMING;
    return Math.min(building.baseChance * level, 0.5); 
}

function rollCritical(criticalChance) {
    return Math.random() < criticalChance;
}

function calculateEventAmplification(level, originalMultiplier) {
    const building = BUILDING_TYPES.EVENT_BOOST;
    const amplification = 1 + (building.baseMultiplier * level);
    
    if (originalMultiplier === 1) return 1;
    
    return originalMultiplier * amplification;
}

function canUpgrade(buildingType, currentLevel) {
    const building = BUILDING_TYPES[buildingType];
    if (!building) {
        return { valid: false, error: 'INVALID_BUILDING' };
    }
    
    if (currentLevel >= building.maxLevel) {
        return { 
            valid: false, 
            error: 'MAX_LEVEL',
            maxLevel: building.maxLevel 
        };
    }
    
    return { valid: true };
}

function getBuildingInfo(buildingType, currentLevel = 0) {
    const building = BUILDING_TYPES[buildingType];
    if (!building) return null;
    
    const currentBonus = calculateBuildingMultiplier(buildingType, currentLevel);
    const nextBonus = calculateBuildingMultiplier(buildingType, currentLevel + 1);
    const cost = calculateUpgradeCost(buildingType, currentLevel);
    
    return {
        ...building,
        currentLevel,
        currentBonus,
        nextBonus,
        upgradeCost: cost,
        canUpgrade: currentLevel < building.maxLevel
    };
}

function getAllBuildingsInfo(levels = {}) {
    const buildings = {};
    
    for (const [key, building] of Object.entries(BUILDING_TYPES)) {
        const level = levels[key] || 0;
        buildings[key] = getBuildingInfo(key, level);
    }
    
    return buildings;
}

function formatMultiplier(multiplier, buildingType) {
    if (buildingType === 'CRITICAL_FARMING') {
        return `${(multiplier * 100).toFixed(1)}% chance`;
    }
    
    if (buildingType === 'EVENT_BOOST') {
        const bonus = ((multiplier - 1) * 100).toFixed(1);
        return `+${bonus}% event boost`;
    }
    
    return `x${multiplier.toFixed(2)}`;
}

module.exports = {
    BUILDING_TYPES,
    calculateUpgradeCost,
    calculateBuildingMultiplier,
    calculateCriticalChance,
    rollCritical,
    calculateEventAmplification,
    canUpgrade,
    getBuildingInfo,
    getAllBuildingsInfo,
    formatMultiplier
};