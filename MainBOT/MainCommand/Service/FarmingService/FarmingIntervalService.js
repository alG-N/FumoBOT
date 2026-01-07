const { all, get } = require('../../Core/database');
const { getUserFarmingFumos, updateFarmingIncome, updateDailyQuest } = require('./FarmingDatabaseService');
const { INCOME_INTERVAL } = require('./FarmingCalculationService');
const { getCurrentMultipliers } = require('./SeasonService/SeasonManagerService');
const { getBuildingLevels } = require('./BuildingService/BuildingDatabaseService');
const { 
    calculateBuildingMultiplier, 
    calculateCriticalChance,
    rollCritical,
    calculateEventAmplification,
    BUILDING_TYPES
} = require('../../Configuration/buildingConfig');
const { getRebirthMultiplier } = require('../../Configuration/rebirthConfig');
const { debugLog } = require('../../Core/logger');

const farmingIntervals = new Map();

/**
 * Get user's rebirth multiplier
 * @param {string} userId 
 * @returns {Promise<number>}
 */
async function getUserRebirthMultiplier(userId) {
    try {
        const row = await get(
            `SELECT rebirthCount FROM userRebirthProgress WHERE userId = ?`,
            [userId]
        );
        return getRebirthMultiplier(row?.rebirthCount || 0);
    } catch (error) {
        console.error('[Farming] Error getting rebirth multiplier:', error);
        return 1;
    }
}

async function getActiveBoostMultipliers(userId) {
    const { get, all: dbAll } = require('../../Core/database');
    const now = Date.now();
    
    let coinMultiplier = 1;
    let gemMultiplier = 1;

    try {
        const boosts = await dbAll(
            `SELECT type, multiplier FROM activeBoosts 
             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );

        boosts.forEach(b => {
            const type = (b.type || '').toLowerCase();
            const mult = b.multiplier || 1;
            
            if (['coin', 'income'].includes(type)) {
                coinMultiplier *= mult;
            }
            if (['gem', 'gems', 'income'].includes(type)) {
                gemMultiplier *= mult;
            }
        });
    } catch (err) {
        console.error("Error fetching active boosts:", err);
    }

    return { coinMultiplier, gemMultiplier };
}

function generateFarmingKey(userId, fumoName) {
    return `${userId}-${fumoName}`;
}

async function validateFumoInInventory(userId, fumoName) {
    const { get, all: dbAll } = require('../../Core/database');
    
    const baseWithRarity = fumoName
        .replace(/\[✨SHINY\]/g, '')
        .replace(/\[🌟alG\]/g, '')
        .replace(/\[🔮GLITCHED\]/g, '')
        .replace(/\[🌀VOID\]/g, '')
        .trim();
    
    const baseVariant = baseWithRarity;
    const shinyVariant = `${baseWithRarity}[✨SHINY]`;
    const alGVariant = `${baseWithRarity}[🌟alG]`;
    const glitchedVariant = `${baseWithRarity}[🔮GLITCHED]`;
    const voidVariant = `${baseWithRarity}[🌀VOID]`;
    
    const rows = await dbAll(
        `SELECT SUM(quantity) as totalCount 
         FROM userInventory 
         WHERE userId = ? 
         AND (
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ? OR
             fumoName = ?
         )`,
        [userId, baseVariant, shinyVariant, alGVariant, glitchedVariant, voidVariant]
    );
    
    const totalCount = rows[0]?.totalCount || 0;
    
    debugLog('FARMING', `[validateFumoInInventory] ${fumoName} -> ${baseWithRarity} has ${totalCount} total in inventory (base + shiny + alG + glitched + void)`);
    
    return totalCount > 0;
}

async function startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin) {
    const key = generateFarmingKey(userId, fumoName);
    
    if (farmingIntervals.has(key)) {
        return;
    }

    const intervalId = setInterval(async () => {
        try {
            // Check if fumo is still in the farm (not inventory - fumos are removed from inventory when farming)
            const farmingFumos = await getUserFarmingFumos(userId);
            const fumo = farmingFumos.find(f => f.fumoName === fumoName);
            
            if (!fumo) {
                // Fumo no longer in farm, stop interval
                clearInterval(intervalId);
                farmingIntervals.delete(key);
                return;
            }

            const { coinMultiplier: userCoinBoost, gemMultiplier: userGemBoost } = await getActiveBoostMultipliers(userId);
            let { coinMultiplier: seasonCoinMult, gemMultiplier: seasonGemMult } = await getCurrentMultipliers();
            
            const buildingLevels = await getBuildingLevels(userId);
            
            const coinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', buildingLevels.COIN_BOOST);
            const gemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', buildingLevels.GEM_BOOST);
            
            seasonCoinMult = calculateEventAmplification(buildingLevels.EVENT_BOOST, seasonCoinMult);
            seasonGemMult = calculateEventAmplification(buildingLevels.EVENT_BOOST, seasonGemMult);
            
            const criticalChance = calculateCriticalChance(buildingLevels.CRITICAL_FARMING);
            const isCritical = rollCritical(criticalChance);
            const criticalMult = isCritical ? BUILDING_TYPES.CRITICAL_FARMING.criticalMultiplier : 1;

            // Get rebirth multiplier
            const rebirthMult = await getUserRebirthMultiplier(userId);

            const quantity = fumo.quantity || 1;
            
            let coinsAwarded = Math.floor(
                fumo.coinsPerMin * quantity * userCoinBoost * coinBuildingBoost * seasonCoinMult * criticalMult * rebirthMult
            );
            let gemsAwarded = Math.floor(
                fumo.gemsPerMin * quantity * userGemBoost * gemBuildingBoost * seasonGemMult * criticalMult * rebirthMult
            );

            await updateFarmingIncome(userId, coinsAwarded, gemsAwarded);
            await updateDailyQuest(userId, coinsAwarded);
            
            if (isCritical) {
                debugLog('FARMING', `⚡ CRITICAL farming tick for ${userId}! Rewards: ${coinsAwarded} coins, ${gemsAwarded} gems`);
            }

        } catch (err) {
            console.error(`Farming update failed for ${key}:`, err);
        }
    }, INCOME_INTERVAL);

    farmingIntervals.set(key, intervalId);
    debugLog('FARMING', `Started farming interval for ${fumoName} (user: ${userId})`);
}

function stopFarmingInterval(userId, fumoName) {
    const key = generateFarmingKey(userId, fumoName);
    
    if (farmingIntervals.has(key)) {
        clearInterval(farmingIntervals.get(key));
        farmingIntervals.delete(key);
        debugLog('FARMING', `Stopped farming interval for ${fumoName} (user: ${userId})`);
    }
}

async function stopAllFarmingIntervals(userId) {
    const farmingFumos = await getUserFarmingFumos(userId);
    
    for (const fumo of farmingFumos) {
        stopFarmingInterval(userId, fumo.fumoName);
    }
    
    debugLog('FARMING', `Stopped all farming intervals for user ${userId}`);
}

async function resumeAllFarmingIntervals() {
    try {
        const { all: dbAll } = require('../../Core/database');
        const { 
            migrateExistingFarmingFumos, 
            isFarmingMigrationNeeded, 
            markFarmingMigrationDone 
        } = require('./FarmingDatabaseService');
        
        // Run migration if needed (one-time to deduct farming fumos from inventory)
        const needsMigration = await isFarmingMigrationNeeded();
        if (needsMigration) {
            console.log('🔄 Running farming inventory migration...');
            const result = await migrateExistingFarmingFumos();
            await markFarmingMigrationDone();
            console.log(`✅ Migration complete: ${result.migrated} migrated, ${result.cleaned} cleaned`);
        }
        
        const allFarming = await dbAll(`SELECT * FROM farmingFumos`);
        
        for (const row of allFarming) {
            const { userId, fumoName, coinsPerMin, gemsPerMin } = row;
            await startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin);
        }
        
        console.log(`✅ Resumed ${allFarming.length} farming intervals.`);
    } catch (err) {
        console.error("Failed to resume farming:", err);
    }
}

function clearAllIntervals() {
    for (const [key, intervalId] of farmingIntervals.entries()) {
        clearInterval(intervalId);
    }
    farmingIntervals.clear();
    debugLog('FARMING', 'Cleared all farming intervals');
}

function getActiveFarmingCount() {
    return farmingIntervals.size;
}

module.exports = {
    startFarmingInterval,
    stopFarmingInterval,
    stopAllFarmingIntervals,
    resumeAllFarmingIntervals,
    clearAllIntervals,
    getActiveFarmingCount,
    validateFumoInInventory,
    farmingIntervals
};