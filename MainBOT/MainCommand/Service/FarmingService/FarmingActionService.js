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
    replaceFarm
} = require('./FarmingDatabaseService');
const { startFarmingInterval, stopFarmingInterval, stopAllFarmingIntervals } = require('./FarmingIntervalService');
const { debugLog } = require('../../Core/logger');
const { get } = require('../../Core/database');

async function addSingleFumo(userId, fumoName) {
    const fragmentUses = await getFarmLimit(userId);
    const limit = calculateFarmLimit(fragmentUses);
    const farmingFumos = await getUserFarmingFumos(userId);

    if (farmingFumos.length >= limit) {
        return { success: false, error: 'FARM_FULL', limit };
    }

    const inFarm = await checkFumoInFarm(userId, fumoName);
    if (inFarm) {
        return { success: false, error: 'ALREADY_FARMING', fumoName };
    }

    const inventoryRow = await getUserInventoryFumo(userId, fumoName);
    if (!inventoryRow || inventoryRow.count <= 0) {
        return { success: false, error: 'NOT_IN_INVENTORY', fumoName };
    }

    const { coinsPerMin, gemsPerMin } = calculateFarmingStats(fumoName);

    await addFumoToFarm(userId, fumoName, coinsPerMin, gemsPerMin);
    await startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin);

    return { success: true, fumoName };
}

async function addRandomByRarity(userId, rarity) {
    const fragmentUses = await getFarmLimit(userId);
    const upgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const limit = calculateFarmLimit(fragmentUses) + limitBreaks;
    const farmingFumos = await getUserFarmingFumos(userId);
    const availableSlots = limit - farmingFumos.length;

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
        await addFumoToFarm(userId, item.fumoName, coinsPerMin, gemsPerMin);
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
    
    // UPDATE THIS LINE: Add limitBreaks to the calculation
    const limit = calculateFarmLimit(fragmentUses) + limitBreaks;
    
    const farmingFumos = await getUserFarmingFumos(userId);
    const inventory = await getAllUserInventory(userId);

    const currentFarm = farmingFumos.map(f => ({
        ...f,
        ...calculateFarmingStats(f.fumoName)
    }));

    const farmNames = new Set(currentFarm.map(f => f.fumoName));

    const potential = inventory
        .filter(f => f.fumoName && typeof f.fumoName === 'string' && f.fumoName.trim())
        .filter(f => !farmNames.has(f.fumoName))
        .map(f => ({
            fumoName: f.fumoName,
            ...calculateFarmingStats(f.fumoName)
        }));

    const combined = [...currentFarm, ...potential];
    const sorted = sortByIncome(combined);
    const best = sorted.slice(0, limit);

    await stopAllFarmingIntervals(userId);
    await replaceFarm(userId, best);

    for (const fumo of best) {
        await startFarmingInterval(userId, fumo.fumoName, fumo.coinsPerMin, fumo.gemsPerMin);
    }

    return { success: true, count: best.length };
}

async function removeByName(userId, fumoName, quantity = 1) {
    const inFarm = await checkFumoInFarm(userId, fumoName);
    if (!inFarm) {
        return { success: false, error: 'NOT_IN_FARM', fumoName };
    }

    const removed = await removeFumoFromFarm(userId, fumoName, quantity);
    if (!removed) {
        return { success: false, error: 'REMOVE_FAILED', fumoName };
    }

    const farmingFumos = await getUserFarmingFumos(userId);
    const stillExists = farmingFumos.find(f => f.fumoName === fumoName);
    
    if (!stillExists) {
        stopFarmingInterval(userId, fumoName);
    }

    return { success: true, fumoName, quantity };
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
    removeAll
};