const { all, run } = require('../../Core/database');
const { stopFarmingInterval } = require('./FarmingIntervalService');
const { debugLog } = require('../../Core/logger');

const CLEANUP_INTERVAL = 60000; 
let cleanupIntervalId = null;

async function cleanupInvalidFarmingFumos() {
    try {
        const allFarming = await all(
            `SELECT DISTINCT userId, fumoName FROM farmingFumos`
        );

        let removedCount = 0;

        for (const { userId, fumoName } of allFarming) {
            const inventoryRow = await all(
                `SELECT COUNT(*) as count FROM userInventory 
                 WHERE userId = ? AND fumoName = ?`,
                [userId, fumoName]
            );

            const existsInInventory = (inventoryRow[0]?.count || 0) > 0;

            if (!existsInInventory) {
                debugLog('FARMING_CLEANUP', `Removing ${fumoName} from farm for user ${userId} - not in inventory`);
                
                await run(
                    `DELETE FROM farmingFumos WHERE userId = ? AND fumoName = ?`,
                    [userId, fumoName]
                );

                stopFarmingInterval(userId, fumoName);
                
                removedCount++;
            }
        }

        if (removedCount > 0) {
            debugLog('FARMING_CLEANUP', `Cleaned up ${removedCount} invalid farming entries`);
        }

    } catch (error) {
        console.error('Error in farming cleanup:', error);
    }
}

function startCleanupJob() {
    if (cleanupIntervalId) {
        console.log('⚠️ Cleanup job already running');
        return;
    }

    cleanupIntervalId = setInterval(cleanupInvalidFarmingFumos, CLEANUP_INTERVAL);
    console.log(`✅ Started farming cleanup job (every ${CLEANUP_INTERVAL / 1000}s)`);
}

function stopCleanupJob() {
    if (cleanupIntervalId) {
        clearInterval(cleanupIntervalId);
        cleanupIntervalId = null;
        console.log('🛑 Stopped farming cleanup job');
    }
}

module.exports = {
    cleanupInvalidFarmingFumos,
    startCleanupJob,
    stopCleanupJob,
    CLEANUP_INTERVAL
};