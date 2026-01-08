const { all, run } = require('../../Core/database');
const { stopFarmingInterval } = require('./FarmingIntervalService');
const { debugLog } = require('../../Core/logger');

const CLEANUP_INTERVAL = 60000; 
let cleanupIntervalId = null;

/**
 * NOTE: This cleanup is NO LONGER NEEDED since the farming system now:
 * - Removes fumos from inventory when adding to farm
 * - Returns fumos to inventory when removing from farm
 * 
 * The old logic that checked if fumos exist in inventory was WRONG
 * because fumos being farmed are NOT in inventory - they're in farmingFumos table.
 * 
 * This function now only cleans up entries with null/empty fumoName or quantity <= 0
 */
async function cleanupInvalidFarmingFumos() {
    try {
        // Only clean up truly invalid entries (null names, zero quantity, etc.)
        const result = await run(
            `DELETE FROM farmingFumos 
             WHERE fumoName IS NULL 
             OR TRIM(fumoName) = '' 
             OR quantity <= 0`
        );

        if (result && result.changes > 0) {
            debugLog('FARMING_CLEANUP', `Cleaned up ${result.changes} invalid farming entries (null/empty names or zero quantity)`);
        }

    } catch (error) {
        console.error('Error in farming cleanup:', error);
    }
}

function startCleanupJob() {
    if (cleanupIntervalId) {
        return;
    }

    // Run cleanup less frequently since it only handles edge cases now
    cleanupIntervalId = setInterval(cleanupInvalidFarmingFumos, CLEANUP_INTERVAL * 5); // Every 5 minutes
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