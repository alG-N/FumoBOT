const { resumeAllFarmingIntervals } = require('../../Service/FarmingService/FarmingIntervalService');
const { startCleanupJob } = require('../../Service/FarmingService/FarmingCleanupService');
const { logToDiscord, LogLevel } = require('../../Core/logger');

module.exports = async (client) => {
    client.once('ready', async () => {
        try {
            await resumeAllFarmingIntervals();
            
            startCleanupJob();
            
            await logToDiscord(
                client,
                '✅ Farming system initialized with cleanup job running every 60s',
                null,
                LogLevel.SUCCESS
            );
            console.log('✅ Farming system ready with auto-cleanup');
        } catch (error) {
            console.error('❌ Failed to initialize farming system:', error);
            await logToDiscord(
                client,
                'Failed to initialize farming system',
                error,
                LogLevel.ERROR
            );
        }
    });
};