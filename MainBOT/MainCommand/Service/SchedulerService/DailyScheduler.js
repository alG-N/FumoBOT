const cron = require('node-cron');
const { resetExpiredStreaks } = require('../UserDataService/DailyService/DailyService');
const { logSystemEvent, logError } = require('../../Core/logger');

let schedulerInitialized = false;

function initializeDailyScheduler(client) {
    if (schedulerInitialized) {
        console.log('⚠️ Daily scheduler already initialized');
        return;
    }
    
    cron.schedule('0 */6 * * *', async () => {
        try {
            const resetCount = await resetExpiredStreaks();
            
            if (resetCount > 0) {
                await logSystemEvent(
                    client,
                    'Daily Streak Reset',
                    `Reset ${resetCount} expired streak${resetCount !== 1 ? 's' : ''}`
                );
            }
            
            console.log(`[Daily Scheduler] Reset ${resetCount} expired streaks`);
        } catch (error) {
            await logError(client, 'Daily Scheduler - Streak Reset', error);
        }
    });
    
    schedulerInitialized = true;
    console.log('✅ Daily streak scheduler initialized (runs every 6 hours)');
}

module.exports = {
    initializeDailyScheduler
};