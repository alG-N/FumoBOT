function getWeekIdentifier() {
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber}`;
}

function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
}

function getTimeUntilDailyReset() {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);

    const diffMs = nextReset - now;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return {
        milliseconds: diffMs,
        hours,
        minutes,
        seconds,
        formatted: `${hours}h ${minutes}m ${seconds}s`
    };
}

function getTimeUntilWeeklyReset() {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = (8 - day) % 7 || 7;

    const nextReset = new Date(now);
    nextReset.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextReset.setUTCHours(0, 0, 0, 0);

    const diffMs = nextReset - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);

    return {
        milliseconds: diffMs,
        days,
        hours,
        minutes,
        formatted: `${days}d ${hours}h ${minutes}m`
    };
}

function isNewDay(lastTimestamp) {
    if (!lastTimestamp) return true;

    const lastDate = new Date(lastTimestamp).toISOString().slice(0, 10);
    const currentDate = getCurrentDate();

    return lastDate !== currentDate;
}

function isNewWeek(lastWeek) {
    if (!lastWeek) return true;

    const currentWeek = getWeekIdentifier();
    return lastWeek !== currentWeek;
}

function getDaysSince(timestamp) {
    if (!timestamp) return 0;

    const now = Date.now();
    const diffMs = now - timestamp;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getHoursSince(timestamp) {
    if (!timestamp) return 0;

    const now = Date.now();
    const diffMs = now - timestamp;
    return Math.floor(diffMs / (1000 * 60 * 60));
}

function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const parts = [];

    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);

    return parts.join(' ') || '0s';
}
function formatTimestamp(timestamp, format = 'full') {
    const date = new Date(timestamp);
    switch (format) {
        case 'date':
            return date.toLocaleDateString();
        case 'time':
            return date.toLocaleTimeString();
        case 'short':
            return date.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        case 'full':
        default:
            return date.toLocaleString();
    }
}
function getStartOfDay(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}
function getStartOfWeek(date = new Date()) {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    return start;
}
function getEndOfDay(date = new Date()) {
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return end;
}
function getEndOfWeek(date = new Date()) {
    const end = new Date(date);
    const day = end.getDay();
    const diff = end.getDate() + (day === 0 ? 0 : 7 - day);
    end.setDate(diff);
    end.setHours(23, 59, 59, 999);
    return end;
}
function isWithinTimeWindow(timestamp, windowMs) {
    const now = Date.now();
    return (now - timestamp) <= windowMs;
}
function getNextResetTime(type = 'daily') {
    if (type === 'daily') {
        const next = new Date();
        next.setUTCHours(24, 0, 0, 0);
        return next.getTime();
    } else {
        const now = new Date();
        const day = now.getUTCDay();
        const daysUntilMonday = (8 - day) % 7 || 7;
        const next = new Date(now);
        next.setUTCDate(now.getUTCDate() + daysUntilMonday);
        next.setUTCHours(0, 0, 0, 0);
        return next.getTime();
    }
}
function shouldSendResetWarning(type = 'daily', warningTimeMs = 3600000) {
    const nextReset = getNextResetTime(type);
    const now = Date.now();
    const timeUntilReset = nextReset - now;
    return timeUntilReset <= warningTimeMs && timeUntilReset > 0;
}

/**
 * Promise-based delay function for async/await usage
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    getWeekIdentifier,
    getCurrentDate,
    getTimeUntilDailyReset,
    getTimeUntilWeeklyReset,
    isNewDay,
    isNewWeek,
    getDaysSince,
    getHoursSince,
    formatDuration,
    formatTimestamp,
    getStartOfDay,
    getStartOfWeek,
    getEndOfDay,
    getEndOfWeek,
    isWithinTimeWindow,
    getNextResetTime,
    shouldSendResetWarning,
    delay
};