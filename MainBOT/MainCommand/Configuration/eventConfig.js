/**
 * Event Gacha Configuration
 * All event-specific constants and settings
 */

// Event timing
const EVENT_START_TIME = new Date();
const EVENT_DURATION = 11 * 24 * 60 * 60 * 1000; // 11 days
const EVENT_END_TIME = new Date(EVENT_START_TIME.getTime() + EVENT_DURATION);

// Roll limits
const EVENT_ROLL_LIMIT = 50000;
const EVENT_WINDOW_DURATION = 30 * 60 * 1000; // 30 minutes

// Costs
const EVENT_COST_PER_ROLL = 100; // gems

// Cooldowns
const EVENT_COOLDOWN_BASE = 3000; // 3 seconds

// Auto-roll settings - NEW
const EVENT_AUTO_ROLL_INTERVAL = 30000; // 30 seconds
const EVENT_AUTO_ROLL_INTERVAL_BOOSTED = 15000; // 15 seconds with boost
const EVENT_AUTO_ROLL_BATCH_SIZE = 100; // Roll 100 at a time

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
    module.exports.EVENT_START_TIME = startTime;
    module.exports.EVENT_END_TIME = new Date(startTime.getTime() + EVENT_DURATION);
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
    setEventStartTime
};