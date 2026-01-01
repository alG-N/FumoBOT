const {
    WEATHER_CONFIG,
    WEATHER_EVENTS,
    isWeekend,
    shouldTriggerWeather,
    calculateTotalMultipliers,
    getWeatherDuration,
    getWeatherCheckInterval,
    getSeasonDescription,
    GLOBAL_WEATHER_COOLDOWN,
    MAX_SIMULTANEOUS_WEATHER,
    GUARANTEED_WEATHER_INTERVAL
} = require('../../../Configuration/seasonConfig');

const {
    WEATHER_COMBOS,
    checkForWeatherCombo,
    getComboDescription,
    getComboDuration
} = require('../../../Configuration/weatherComboConfig');

const {
    getActiveSeasonTypes,
    startSeason,
    endSeason,
    cleanExpiredSeasons,
    isSeasonActive
} = require('./SeasonDatabaseService');

const { debugLog, logToDiscord, LogLevel } = require('../../../Core/logger');

const weatherCheckIntervals = new Map();
const comboCheckInterval = null;
let cleanupInterval = null;
let guaranteeCheckInterval = null;
let lastWeatherEventTime = Date.now();
let lastWeatherCooldowns = new Map(); // Track per-weather cooldowns

const COMBO_CHECK_INTERVAL = 60000;

async function initializeSeasonSystem(client) {
    try {
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
        
        startGuaranteedWeatherCheck(client);
        startWeatherComboCheck(client);
        startWeekendMonitor(client);
        
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

function startWeekendMonitor(client) {
    setInterval(async () => {
        const activeSeasons = await getActiveSeasonTypes();
        const isCurrentlyWeekend = isWeekend();
        const hasWeekendActive = activeSeasons.includes('WEEKEND');
        
        if (!isCurrentlyWeekend && hasWeekendActive) {
            await endSeason('WEEKEND');
            console.log('🎊 Weekend season ended (no longer weekend)');
            await logToDiscord(client, '🎊 Weekend season ended', null, LogLevel.INFO);
        } else if (isCurrentlyWeekend && !hasWeekendActive) {
            await startSeason('WEEKEND', null);
            console.log('🎊 Weekend season started');
            await logToDiscord(client, '🎊 Weekend season started', null, LogLevel.INFO);
        }
    }, 3600000); 
}

function startWeatherCheckInterval(weatherType, client) {
    const interval = getWeatherCheckInterval(weatherType);
    const weatherConfig = WEATHER_CONFIG[weatherType];
    const cooldown = weatherConfig?.cooldown || 3600000;
    
    const intervalId = setInterval(async () => {
        try {
            // Check global cooldown between any weather events
            const timeSinceLastWeather = Date.now() - lastWeatherEventTime;
            if (timeSinceLastWeather < GLOBAL_WEATHER_COOLDOWN) {
                return;
            }
            
            // Check per-weather cooldown
            const lastCooldown = lastWeatherCooldowns.get(weatherType) || 0;
            if (Date.now() - lastCooldown < cooldown) {
                return;
            }
            
            // Check max simultaneous weather
            const activeSeasons = await getActiveSeasonTypes();
            const activeWeatherCount = activeSeasons.filter(s => s !== 'WEEKEND').length;
            if (activeWeatherCount >= MAX_SIMULTANEOUS_WEATHER) {
                return;
            }
            
            const alreadyActive = await isSeasonActive(weatherType);
            if (alreadyActive) {
                return;
            }

            if (shouldTriggerWeather(weatherType)) {
                const duration = getWeatherDuration(weatherType);
                await startSeason(weatherType, duration);
                
                lastWeatherEventTime = Date.now();
                lastWeatherCooldowns.set(weatherType, Date.now());
                
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
    guaranteeCheckInterval = setInterval(async () => {
        try {
            const timeSinceLastWeather = Date.now() - lastWeatherEventTime;
            
            if (timeSinceLastWeather >= GUARANTEED_WEATHER_INTERVAL) {
                const activeSeasons = await getActiveSeasonTypes();
                
                const activeWeather = activeSeasons.filter(s => s !== 'WEEKEND');
                
                if (activeWeather.length === 0) {
                    await triggerGuaranteedWeather(client);
                } else {
                    lastWeatherEventTime = Date.now();
                }
            }
        } catch (error) {
            console.error('Error in guaranteed weather check:', error);
        }
    }, 600000);
    
    debugLog('SEASONS', 'Started guaranteed weather check (every 10 min)');
}

function startWeatherComboCheck(client) {
    setInterval(async () => {
        try {
            const activeSeasons = await getActiveSeasonTypes();
            const activeWeathers = activeSeasons.filter(s => s !== 'WEEKEND');
            
            // Need at least 2 weather events for a combo
            if (activeWeathers.length < 2) return;
            
            // Check for combo match
            const comboResult = checkForWeatherCombo(activeWeathers);
            
            if (comboResult.found) {
                const { comboKey, comboData } = comboResult;
                
                // Check if combo is already active
                const alreadyActive = await isSeasonActive(comboKey);
                if (alreadyActive) return;
                
                const duration = getComboDuration(comboKey);
                await startSeason(comboKey, duration);
                
                const description = getComboDescription(comboKey);
                console.log(`🌟 WEATHER COMBO TRIGGERED: ${comboKey}`);
                
                await logToDiscord(
                    client,
                    `🌟 **WEATHER COMBO ACTIVATED!**\n${description}\nDuration: ${Math.floor(duration / 60000)} minutes`,
                    null,
                    LogLevel.ACTIVITY
                );

                // End the individual weather events that formed the combo
                for (const weather of comboData.requiredWeathers) {
                    await endSeason(weather);
                }
            }
        } catch (error) {
            console.error('Error in weather combo check:', error);
        }
    }, COMBO_CHECK_INTERVAL);
    
    debugLog('SEASONS', 'Started weather combo check (every 1 min)');
}

async function triggerGuaranteedWeather(client) {
    // Pick from positive weathers for guaranteed event
    const positiveWeather = Object.entries(WEATHER_CONFIG)
        .filter(([_, config]) => config.type === 'positive' && config.tier !== 'DIVINE' && config.tier !== 'GLITCHED')
        .map(([key]) => key);
    
    if (positiveWeather.length === 0) {
        console.warn('No positive weather events configured for guaranteed weather');
        return;
    }
    
    const randomWeather = positiveWeather[Math.floor(Math.random() * positiveWeather.length)];
    const duration = getWeatherDuration(randomWeather);
    
    await startSeason(randomWeather, duration);
    lastWeatherEventTime = Date.now();
    lastWeatherCooldowns.set(randomWeather, Date.now());
    
    const description = getSeasonDescription(randomWeather);
    
    console.log(`🌟 GUARANTEED Weather Event: ${randomWeather}`);
    
    await logToDiscord(
        client,
        `🌟 **GUARANTEED Weather Event**\n` +
        `No weather for 2 hours, triggering guaranteed event!\n\n` +
        `${description}\n` +
        `Duration: ${Math.floor(duration / 60000)} minutes`,
        null,
        LogLevel.ACTIVITY
    );
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
    
    if (guaranteeCheckInterval) {
        clearInterval(guaranteeCheckInterval);
        guaranteeCheckInterval = null;
    }
}

async function getCurrentMultipliers() {
    await cleanExpiredSeasons();
    const activeSeasons = await getActiveSeasonTypes();
    
    const comboCheck = checkForWeatherCombo(activeSeasons);
    if (comboCheck.found) {
        const { getComboMultiplier } = require('../../../Configuration/weatherComboConfig');
        const comboMult = getComboMultiplier(comboCheck.comboKey);
        return {
            coinMultiplier: comboMult.coin,
            gemMultiplier: comboMult.gem,
            activeEvents: [comboCheck.comboKey]
        };
    }
    
    return calculateTotalMultipliers(activeSeasons);
}

async function getActiveSeasonsList() {
    const activeSeasons = await getActiveSeasonTypes();
    if (activeSeasons.length === 0) {
        return 'No active seasonal events';
    }
    
    const comboCheck = checkForWeatherCombo(activeSeasons);
    if (comboCheck.found) {
        return getComboDescription(comboCheck.comboKey);
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