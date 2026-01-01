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
const { get, all } = require('../../Core/database');
const { parseTraitFromFumoName, stripTraitFromFumoName } = require('./FarmingParserService');

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

    // Check inventory before attempting to add (will be checked again in addFumoToFarm)
    const inventoryCount = await getInventoryCountForFumo(userId, fumoName);
    
    if (inventoryCount < actualQuantity) {
        return { success: false, error: 'INSUFFICIENT_INVENTORY', have: inventoryCount, need: actualQuantity };
    }

    const { coinsPerMin, gemsPerMin } = calculateFarmingStats(fumoName);

    const existingFumo = farmingFumos.find(f => f.fumoName === fumoName);
    
    // addFumoToFarm now actually removes from inventory and returns success/failure
    const added = await addFumoToFarm(userId, fumoName, coinsPerMin, gemsPerMin, actualQuantity);
    
    if (!added) {
        return { success: false, error: 'ADD_FAILED' };
    }
    
    // Start farming interval only if this is a new fumo type
    if (!existingFumo) {
        await startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin);
    }

    return { success: true, added: actualQuantity, fumoName };
}

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

    const updatedFumos = await getUserFarmingFumos(userId);
    const stillExists = updatedFumos.find(f => f.fumoName === fumoName);
    
    if (!stillExists) {
        stopFarmingInterval(userId, fumoName);
    }

    return { success: true, removed: actualQuantity, fumoName };
}

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
    
    const inventory = await all(
        `SELECT fumoName, SUM(quantity) as count 
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND TRIM(fumoName) != ''
         AND (fumoName LIKE '%(%)' OR fumoName LIKE '%[✨SHINY]' OR fumoName LIKE '%[🌟alG]' OR fumoName LIKE '%[🔮GLITCHED]' OR fumoName LIKE '%[🌀VOID]')
         GROUP BY fumoName`,
        [userId]
    );

    const inventoryWithStats = inventory
        .filter(item => {
            if (!item.fumoName || typeof item.fumoName !== 'string' || item.fumoName.trim() === '') {
                return false;
            }
            return item.fumoName.includes('(') || item.fumoName.includes('[');
        })
        .map(item => {
            const stats = calculateFarmingStats(item.fumoName);
            return {
                fumoName: item.fumoName,
                availableCount: parseInt(item.count) || 0,
                coinsPerMin: stats.coinsPerMin,
                gemsPerMin: stats.gemsPerMin,
                totalIncome: stats.coinsPerMin + stats.gemsPerMin
            };
        });

    inventoryWithStats.sort((a, b) => b.totalIncome - a.totalIncome);

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

    await stopAllFarmingIntervals(userId);
    await clearAllFarming(userId);

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
    addMultipleFumosToFarm,
    removeMultipleFumosFromFarm,
    getAvailableFumosByRarityAndTrait,
    getFarmingFumosByRarityAndTrait
};