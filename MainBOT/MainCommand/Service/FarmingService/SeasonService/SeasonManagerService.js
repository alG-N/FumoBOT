const {
    WEATHER_EVENTS,
    isWeekend,
    shouldTriggerWeather,
    calculateTotalMultipliers,
    getWeatherDuration,
    getWeatherCheckInterval,
    getSeasonDescription
} = require('../../../Configuration/seasonConfig');

const {
    getActiveSeasonTypes,
    startSeason,
    endSeason,
    cleanExpiredSeasons,
    initializeSeasonTables
} = require('./SeasonDatabaseService');

const { debugLog, logToDiscord, LogLevel } = require('../../../Core/logger');

const weatherCheckIntervals = new Map();
let cleanupInterval = null;

async function initializeSeasonSystem(client) {
    try {
        await initializeSeasonTables();
        await cleanExpiredSeasons();
        
        if (isWeekend()) {
            const active = await getActiveSeasonTypes();
            if (!active.includes('WEEKEND')) {
                await startSeason('WEEKEND', null);
                debugLog('SEASONS', 'Weekend season started');
            }
        }
        
        for (const weather of WEATHER_EVENTS) {
            startWeatherCheckInterval(weather, client);
        }
        
        cleanupInterval = setInterval(async () => {
            const cleaned = await cleanExpiredSeasons();
            if (cleaned > 0) {
                debugLog('SEASONS', `Auto-cleanup: removed ${cleaned} expired seasons`);
            }
        }, 300000);
        
        console.log('✅ Season system initialized');
        await logToDiscord(
            client,
            '✅ Season system initialized with weather events',
            null,
            LogLevel.SUCCESS
        );
    } catch (error) {
        console.error('❌ Failed to initialize season system:', error);
        await logToDiscord(
            client,
            'Failed to initialize season system',
            error,
            LogLevel.ERROR
        );
    }
}

function startWeatherCheckInterval(weatherType, client) {
    const interval = getWeatherCheckInterval(weatherType);
    
    const intervalId = setInterval(async () => {
        try {
            if (shouldTriggerWeather(weatherType)) {
                const duration = getWeatherDuration(weatherType);
                await startSeason(weatherType, duration);
                
                const description = getSeasonDescription(weatherType);
                console.log(`🌤️ Weather event triggered: ${weatherType}`);
                
                await logToDiscord(
                    client,
                    `🌤️ **Weather Event Started**\n${description}\nDuration: ${Math.floor(duration / 60000)} minutes`,
                    null,
                    LogLevel.ACTIVITY
                );
            }
        } catch (error) {
            console.error(`Error checking weather ${weatherType}:`, error);
        }
    }, interval);
    
    weatherCheckIntervals.set(weatherType, intervalId);
    debugLog('SEASONS', `Started weather check interval for ${weatherType} (every ${interval / 60000} min)`);
}

function stopAllWeatherIntervals() {
    for (const [weather, intervalId] of weatherCheckIntervals.entries()) {
        clearInterval(intervalId);
        debugLog('SEASONS', `Stopped weather interval: ${weather}`);
    }
    weatherCheckIntervals.clear();
    
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}

async function getCurrentMultipliers() {
    await cleanExpiredSeasons();
    const activeSeasons = await getActiveSeasonTypes();
    return calculateTotalMultipliers(activeSeasons);
}

async function getActiveSeasonsList() {
    const activeSeasons = await getActiveSeasonTypes();
    if (activeSeasons.length === 0) {
        return 'No active seasonal events';
    }
    
    return activeSeasons
        .map(season => getSeasonDescription(season))
        .join('\n');
}

async function forceWeatherEvent(weatherType, duration = null, client = null) {
    if (!WEATHER_EVENTS.includes(weatherType) && weatherType !== 'WEEKEND') {
        return { success: false, error: 'INVALID_WEATHER_TYPE' };
    }
    
    const finalDuration = duration || getWeatherDuration(weatherType);
    await startSeason(weatherType, finalDuration);
    
    const description = getSeasonDescription(weatherType);
    
    if (client) {
        await logToDiscord(
            client,
            `🌤️ **Weather Event Forced**\n${description}\nDuration: ${Math.floor(finalDuration / 60000)} minutes`,
            null,
            LogLevel.ACTIVITY
        );
    }
    
    return { success: true, weatherType, duration: finalDuration };
}

async function stopWeatherEvent(weatherType, client = null) {
    await endSeason(weatherType);
    
    if (client) {
        await logToDiscord(
            client,
            `🌤️ Weather event ended: ${weatherType}`,
            null,
            LogLevel.ACTIVITY
        );
    }
    
    return { success: true };
}

module.exports = {
    initializeSeasonSystem,
    stopAllWeatherIntervals,
    getCurrentMultipliers,
    getActiveSeasonsList,
    forceWeatherEvent,
    stopWeatherEvent
};