const { resumeAllFarmingIntervals } = require('../../Service/FarmingService/FarmingIntervalService');
const { logToDiscord, LogLevel } = require('../../Core/logger');

module.exports = async (client) => {
    client.once('ready', async () => {
        try {
            await resumeAllFarmingIntervals();
            await logToDiscord(
                client,
                '✅ Farming system initialized and all intervals resumed.',
                null,
                LogLevel.SUCCESS
            );
            console.log('✅ Farming system ready');
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