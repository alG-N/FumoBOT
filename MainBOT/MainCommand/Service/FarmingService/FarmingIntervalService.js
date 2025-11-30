const { all } = require('../../Core/database');
const { getUserFarmingFumos, updateFarmingIncome, updateDailyQuest } = require('./FarmingDatabaseService');
const { INCOME_INTERVAL } = require('./FarmingCalculationService');
const { debugLog } = require('../../Core/logger');

const farmingIntervals = new Map();

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

async function startFarmingInterval(userId, fumoName, coinsPerMin, gemsPerMin) {
    const key = generateFarmingKey(userId, fumoName);
    
    if (farmingIntervals.has(key)) {
        return;
    }

    const intervalId = setInterval(async () => {
        try {
            const farmingFumos = await getUserFarmingFumos(userId);
            const fumo = farmingFumos.find(f => f.fumoName === fumoName);
            
            if (!fumo) {
                clearInterval(intervalId);
                farmingIntervals.delete(key);
                return;
            }

            const { coinMultiplier, gemMultiplier } = await getActiveBoostMultipliers(userId);

            const quantity = fumo.quantity || 1;
            const coinsAwarded = Math.floor(fumo.coinsPerMin * quantity * coinMultiplier);
            const gemsAwarded = Math.floor(fumo.gemsPerMin * quantity * gemMultiplier);

            await updateFarmingIncome(userId, coinsAwarded, gemsAwarded);
            await updateDailyQuest(userId, coinsAwarded);

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
    farmingIntervals
};