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
    cleanExpiredSeasons
} = require('./SeasonDatabaseService');

const { debugLog, logToDiscord, LogLevel } = require('../../../Core/logger');

const weatherCheckIntervals = new Map();
let cleanupInterval = null;
let guaranteeCheckInterval = null;
let lastWeatherEventTime = Date.now();

const GUARANTEED_WEATHER_INTERVAL = 3 * 60 * 60 * 1000; // 3 hours

async function initializeSeasonSystem(client) {
    try {
        await cleanExpiredSeasons();
        
        // Always start weekend season if applicable
        if (isWeekend()) {
            const active = await getActiveSeasonTypes();
            if (!active.includes('WEEKEND')) {
                await startSeason('WEEKEND', null);
                debugLog('SEASONS', 'Weekend season started');
            }
        }
        
        // Start individual weather check intervals
        for (const weather of WEATHER_EVENTS) {
            startWeatherCheckInterval(weather, client);
        }
        
        // Start cleanup interval
        cleanupInterval = setInterval(async () => {
            const cleaned = await cleanExpiredSeasons();
            if (cleaned > 0) {
                debugLog('SEASONS', `Auto-cleanup: removed ${cleaned} expired seasons`);
            }
        }, 300000); // 5 minutes
        
        // Start guaranteed weather check
        startGuaranteedWeatherCheck(client);
        
        console.log('✅ Season system initialized with buffed weather rates');
        await logToDiscord(
            client,
            '✅ Season system initialized\n' +
            `• Weekend season: ${isWeekend() ? 'ACTIVE' : 'Inactive'}\n` +
            `• Weather events: ${WEATHER_EVENTS.length} active\n` +
            `• Guaranteed weather: Every 3 hours\n` +
            '• All weather chances buffed significantly!',
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
                
                // Update last weather event time
                lastWeatherEventTime = Date.now();
                
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
    debugLog('SEASONS', `Started weather check for ${weatherType} (every ${interval / 60000} min)`);
}

function startGuaranteedWeatherCheck(client) {
    // Check every 10 minutes if we need to guarantee a weather event
    guaranteeCheckInterval = setInterval(async () => {
        try {
            const timeSinceLastWeather = Date.now() - lastWeatherEventTime;
            
            // If it's been 3 hours without weather, force a random event
            if (timeSinceLastWeather >= GUARANTEED_WEATHER_INTERVAL) {
                const activeSeasons = await getActiveSeasonTypes();
                
                // Don't count WEEKEND as a weather event
                const activeWeather = activeSeasons.filter(s => s !== 'WEEKEND');
                
                // Only guarantee if no weather is currently active
                if (activeWeather.length === 0) {
                    await triggerGuaranteedWeather(client);
                } else {
                    // Reset timer if weather is active
                    lastWeatherEventTime = Date.now();
                }
            }
        } catch (error) {
            console.error('Error in guaranteed weather check:', error);
        }
    }, 600000); // Check every 10 minutes
    
    debugLog('SEASONS', 'Started guaranteed weather check (every 10 min)');
}

async function triggerGuaranteedWeather(client) {
    // Pick a random positive weather event (avoid negative ones)
    const positiveWeather = [
        'FESTIVAL_HARVEST',
        'DAWN_DAYLIGHT',
        'GOLDEN_HOUR',
        'METEOR_SHOWER',
        'BLOOD_MOON',
        'AURORA_BOREALIS',
        'SOLAR_FLARE'
    ];
    
    const randomWeather = positiveWeather[Math.floor(Math.random() * positiveWeather.length)];
    const duration = getWeatherDuration(randomWeather);
    
    await startSeason(randomWeather, duration);
    lastWeatherEventTime = Date.now();
    
    const description = getSeasonDescription(randomWeather);
    
    console.log(`🌟 GUARANTEED Weather Event: ${randomWeather}`);
    
    await logToDiscord(
        client,
        `🌟 **GUARANTEED Weather Event**\n` +
        `No weather for 3 hours, triggering guaranteed event!\n\n` +
        `${description}\n` +
        `Duration: ${Math.floor(duration / 60000)} minutes`,
        null,
        LogLevel.ACTIVITY
    );
}

function stopAllWeatherIntervals() {
    // Stop individual weather checks
    for (const [weather, intervalId] of weatherCheckIntervals.entries()) {
        clearInterval(intervalId);
        debugLog('SEASONS', `Stopped weather interval: ${weather}`);
    }
    weatherCheckIntervals.clear();
    
    // Stop cleanup interval
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
    
    // Stop guarantee check
    if (guaranteeCheckInterval) {
        clearInterval(guaranteeCheckInterval);
        guaranteeCheckInterval = null;
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
    
    // Update last weather event time
    if (weatherType !== 'WEEKEND') {
        lastWeatherEventTime = Date.now();
    }
    
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

async function getTimeSinceLastWeather() {
    return Date.now() - lastWeatherEventTime;
}

async function getTimeUntilGuaranteedWeather() {
    const timeSince = Date.now() - lastWeatherEventTime;
    const timeRemaining = GUARANTEED_WEATHER_INTERVAL - timeSince;
    return Math.max(0, timeRemaining);
}

module.exports = {
    initializeSeasonSystem,
    stopAllWeatherIntervals,
    getCurrentMultipliers,
    getActiveSeasonsList,
    forceWeatherEvent,
    stopWeatherEvent,
    triggerGuaranteedWeather,
    getTimeSinceLastWeather,
    getTimeUntilGuaranteedWeather,
    GUARANTEED_WEATHER_INTERVAL
};