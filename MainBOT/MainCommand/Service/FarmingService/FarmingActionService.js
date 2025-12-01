const { calculateFarmingStats, calculateFarmLimit, sortByIncome } = require('./FarmingCalculationService');
const {
    getFarmLimit,
    getUserFarmingFumos,
    addFumoToFarm,
    removeFumoFromFarm,
    clearAllFarming,
    getUserInventoryFumo,
    getUserInventoryByRarity,
    getAllUserInventory,
    checkFumoInFarm,
    replaceFarm,
    getUserInventoryByRarityAndTrait,
    getInventoryCountForFumo
} = require('./FarmingDatabaseService');
const { startFarmingInterval, stopFarmingInterval, stopAllFarmingIntervals } = require('./FarmingIntervalService');
const { debugLog } = require('../../Core/logger');
const { get } = require('../../Core/database');
const { parseTraitFromFumoName, stripTraitFromFumoName } = require('./FarmingParserService');

// NEW: Add multiple fumos to farm
async function addMultipleFumosToFarm(userId, fumoName, quantity) {
    const fragmentUses = await getFarmLimit(userId);
    const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const limit = calculateFarmLimit(fragmentUses) + limitBreaks;
    
    const farmingFumos = await getUserFarmingFumos(userId);
    const currentFarmCount = farmingFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);
    const availableSlots = limit - currentFarmCount;

    if (availableSlots <= 0) {
        return { success: false, error: 'FARM_FULL', limit };
    }

    const actualQuantity = Math.min(quantity, availableSlots);

    // Check inventory count
    const inventoryCount = await getInventoryCountForFumo(userId, fumoName);
    
    if (inventoryCount < actualQuantity) {
        return { success: false, error: 'INSUFFICIENT_INVENTORY' };
    }

    const { coinsPerMin, gemsPerMin } = calculateFarmingStats(fumoName);

    // Check if already farming this fumo
    const existingFumo = farmingFumos.find(f => f.fumoName === fumoName);
    
    if (existingFumo) {
        // Add to existing
        await addFumoToFarm(userId, fumoName, coinsPerMin, gemsPerMin, actualQuantity);
    } else {
        // Add new entry
        await addFumoToFarm(userId, fumoName, coinsPerMin, gemsPerMin, actualQuantity);
        await startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin);
    }

    return { success: true, added: actualQuantity, fumoName };
}

// NEW: Remove multiple fumos from farm
async function removeMultipleFumosFromFarm(userId, fumoName, quantity) {
    const farmingFumos = await getUserFarmingFumos(userId);
    const fumo = farmingFumos.find(f => f.fumoName === fumoName);

    if (!fumo) {
        return { success: false, error: 'NOT_IN_FARM' };
    }

    const actualQuantity = Math.min(quantity, fumo.quantity || 1);
    const removed = await removeFumoFromFarm(userId, fumoName, actualQuantity);

    if (!removed) {
        return { success: false, error: 'REMOVE_FAILED' };
    }

    // Check if fumo still exists after removal
    const updatedFumos = await getUserFarmingFumos(userId);
    const stillExists = updatedFumos.find(f => f.fumoName === fumoName);
    
    if (!stillExists) {
        stopFarmingInterval(userId, fumoName);
    }

    return { success: true, removed: actualQuantity, fumoName };
}

// NEW: Get available fumos by rarity and trait
async function getAvailableFumosByRarityAndTrait(userId, rarity, trait) {
    const inventoryFumos = await getUserInventoryByRarityAndTrait(userId, rarity, trait);
    
    return inventoryFumos.map(f => ({
        fullName: f.fumoName,
        baseName: stripTraitFromFumoName(f.fumoName).replace(/\(.*?\)/g, '').trim(),
        displayName: f.fumoName,
        count: f.count,
        trait: parseTraitFromFumoName(f.fumoName)
    }));
}

// NEW: Get farming fumos by rarity and trait
async function getFarmingFumosByRarityAndTrait(userId, rarity, trait) {
    const farmingFumos = await getUserFarmingFumos(userId);
    
    const filtered = farmingFumos.filter(f => {
        const fumoRarity = f.fumoName.match(/\((.*?)\)/)?.[1] || 'Common';
        const fumoTrait = parseTraitFromFumoName(f.fumoName);
        
        return fumoRarity === rarity && fumoTrait === trait;
    });
    
    return filtered.map(f => ({
        fullName: f.fumoName,
        baseName: stripTraitFromFumoName(f.fumoName).replace(/\(.*?\)/g, '').trim(),
        displayName: f.fumoName,
        quantity: f.quantity || 1,
        trait: parseTraitFromFumoName(f.fumoName)
    }));
}

// EXISTING: Single fumo add (kept for compatibility)
async function addSingleFumo(userId, fumoName) {
    return addMultipleFumosToFarm(userId, fumoName, 1);
}

async function addRandomByRarity(userId, rarity) {
    const fragmentUses = await getFarmLimit(userId);
    const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const limit = calculateFarmLimit(fragmentUses) + limitBreaks;
    const farmingFumos = await getUserFarmingFumos(userId);
    const currentFarmCount = farmingFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);
    const availableSlots = limit - currentFarmCount;

    if (availableSlots <= 0) {
        return { success: false, error: 'FARM_FULL', limit };
    }

    const inventory = await getUserInventoryByRarity(userId, rarity);
    inventory.sort(() => Math.random() - 0.5);

    let added = 0;
    const farmNames = new Set(farmingFumos.map(f => f.fumoName));

    for (const item of inventory) {
        if (farmNames.has(item.fumoName)) continue;
        if (item.count <= 0) continue;

        const { coinsPerMin, gemsPerMin } = calculateFarmingStats(item.fumoName);
        await addFumoToFarm(userId, item.fumoName, coinsPerMin, gemsPerMin, 1);
        await startFarmingInterval(userId, item.fumoName, coinsPerMin, gemsPerMin);
        
        added++;
        if (added >= availableSlots) break;
    }

    if (added === 0) {
        return { success: false, error: 'NO_FUMOS_FOUND', rarity };
    }

    return { success: true, added, rarity };
}

async function optimizeFarm(userId) {
    const fragmentUses = await getFarmLimit(userId);
    const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const limit = calculateFarmLimit(fragmentUses) + limitBreaks;
    
    const farmingFumos = await getUserFarmingFumos(userId);
    const inventory = await getAllUserInventory(userId);

    // Filter out items with null/invalid fumoName and get stats
    const inventoryWithStats = inventory
        .filter(item => item.fumoName && typeof item.fumoName === 'string')
        .map(item => ({
            fumoName: item.fumoName,
            availableCount: item.count,
            ...calculateFarmingStats(item.fumoName),
            totalIncome: 0 // Will calculate after
        }));

    // Calculate total income (coins + gems) for each fumo type
    inventoryWithStats.forEach(item => {
        item.totalIncome = item.coinsPerMin + item.gemsPerMin;
    });

    // Sort by income (highest first)
    inventoryWithStats.sort((a, b) => b.totalIncome - a.totalIncome);

    // Build optimal farm considering quantities
    const optimalFarm = [];
    let slotsUsed = 0;

    for (const item of inventoryWithStats) {
        if (slotsUsed >= limit) break;

        const slotsAvailable = limit - slotsUsed;
        const quantityToAdd = Math.min(item.availableCount, slotsAvailable);

        if (quantityToAdd > 0) {
            optimalFarm.push({
                fumoName: item.fumoName,
                quantity: quantityToAdd,
                coinsPerMin: item.coinsPerMin,
                gemsPerMin: item.gemsPerMin
            });
            slotsUsed += quantityToAdd;
        }
    }

    // Clear existing farm and replace with optimal
    await stopAllFarmingIntervals(userId);
    await clearAllFarming(userId);

    // Add optimal fumos to farm
    for (const fumo of optimalFarm) {
        await addFumoToFarm(userId, fumo.fumoName, fumo.coinsPerMin, fumo.gemsPerMin, fumo.quantity);
        await startFarmingInterval(userId, fumo.fumoName, fumo.coinsPerMin, fumo.gemsPerMin);
    }

    const totalAdded = optimalFarm.reduce((sum, f) => sum + f.quantity, 0);

    return { success: true, count: totalAdded, uniqueFumos: optimalFarm.length };
}

async function removeByName(userId, fumoName, quantity = 1) {
    return removeMultipleFumosFromFarm(userId, fumoName, quantity);
}

async function removeByRarity(userId, rarity) {
    const farmingFumos = await getUserFarmingFumos(userId);
    const { getRarityFromName } = require('./FarmingCalculationService');
    
    const matching = farmingFumos.filter(f => getRarityFromName(f.fumoName) === rarity);

    if (matching.length === 0) {
        return { success: false, error: 'NO_FUMOS_FOUND', rarity };
    }

    for (const fumo of matching) {
        await removeFumoFromFarm(userId, fumo.fumoName, fumo.quantity);
        stopFarmingInterval(userId, fumo.fumoName);
    }

    return { success: true, count: matching.length, rarity };
}

async function removeAll(userId) {
    await stopAllFarmingIntervals(userId);
    await clearAllFarming(userId);
    return { success: true };
}

module.exports = {
    addSingleFumo,
    addRandomByRarity,
    optimizeFarm,
    removeByName,
    removeByRarity,
    removeAll,
    // NEW EXPORTS
    addMultipleFumosToFarm,
    removeMultipleFumosFromFarm,
    getAvailableFumosByRarityAndTrait,
    getFarmingFumosByRarityAndTrait
};