const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../Data/eventTimer.json');

function loadEventConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load event config:', error);
    }
    
    const defaultConfig = {
        startTime: Date.now(),
        duration: 24 * 60 * 60 * 1000,
        endTime: Date.now() + (24 * 60 * 60 * 1000)
    };
    
    saveEventConfig(defaultConfig);
    return defaultConfig;
}

function saveEventConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save event config:', error);
    }
}

const eventConfig = loadEventConfig();

const EVENT_START_TIME = new Date(eventConfig.startTime);
const EVENT_DURATION = eventConfig.duration;
const EVENT_END_TIME = new Date(eventConfig.endTime);

const EVENT_ROLL_LIMIT = 50000;
const EVENT_WINDOW_DURATION = 30 * 60 * 1000;

const EVENT_COST_PER_ROLL = 100;

const EVENT_COOLDOWN_BASE = 3000;

const EVENT_AUTO_ROLL_INTERVAL = 30000; 
const EVENT_AUTO_ROLL_INTERVAL_BOOSTED = 15000; 
const EVENT_AUTO_ROLL_BATCH_SIZE = 100; 

function isEventActive() {
    return Date.now() < EVENT_END_TIME.getTime();
}

function getRemainingTime() {
    const remaining = EVENT_END_TIME.getTime() - Date.now();
    if (remaining <= 0) return 'Event has ended';
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${days}d ${hours}h ${minutes}m`;
}

function isWindowExpired(lastRollTime) {
    return !lastRollTime || Date.now() - lastRollTime > EVENT_WINDOW_DURATION;
}

function getRollResetTime(lastRollTime) {
    const now = Date.now();
    const windowStart = lastRollTime 
        ? Math.floor(lastRollTime / EVENT_WINDOW_DURATION) * EVENT_WINDOW_DURATION 
        : now;
    const timeLeft = Math.max(0, (windowStart + EVENT_WINDOW_DURATION) - now);
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
}

function setEventStartTime(startTime) {
    const config = {
        startTime: startTime.getTime(),
        duration: EVENT_DURATION,
        endTime: startTime.getTime() + EVENT_DURATION
    };
    saveEventConfig(config);
    module.exports.EVENT_START_TIME = startTime;
    module.exports.EVENT_END_TIME = new Date(config.endTime);
}

function setEventDuration(durationMs) {
    const config = loadEventConfig();
    config.duration = durationMs;
    config.endTime = config.startTime + durationMs;
    saveEventConfig(config);
    module.exports.EVENT_DURATION = durationMs;
    module.exports.EVENT_END_TIME = new Date(config.endTime);
}

module.exports = {
    EVENT_START_TIME,
    EVENT_DURATION,
    EVENT_END_TIME,
    EVENT_ROLL_LIMIT,
    EVENT_WINDOW_DURATION,
    EVENT_COST_PER_ROLL,
    EVENT_COOLDOWN_BASE,
    EVENT_AUTO_ROLL_INTERVAL,
    EVENT_AUTO_ROLL_INTERVAL_BOOSTED,
    EVENT_AUTO_ROLL_BATCH_SIZE,
    
    isEventActive,
    getRemainingTime,
    isWindowExpired,
    getRollResetTime,
    setEventStartTime,
    setEventDuration,
    loadEventConfig,
    saveEventConfig
};