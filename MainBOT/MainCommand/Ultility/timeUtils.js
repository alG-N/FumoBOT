/**
 * Unified Time Utilities
 * Consolidates all time/duration formatting functions across the project
 */

// ============================================================================
// DATE/WEEK IDENTIFIERS
// ============================================================================

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

// ============================================================================
// RESET TIMERS
// ============================================================================

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

// ============================================================================
// DAY/WEEK CHECKS
// ============================================================================

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

function isWithinTimeWindow(timestamp, windowMs) {
    const now = Date.now();
    return (now - timestamp) <= windowMs;
}

// ============================================================================
// DATE BOUNDARIES
// ============================================================================

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

// ============================================================================
// DURATION FORMATTING (Unified from multiple files)
// ============================================================================

/**
 * Format milliseconds to human-readable duration (primary function)
 * @param {number} ms - Milliseconds
 * @param {object} options - { showSeconds: true, compact: false }
 * @returns {string} Formatted duration
 */
function formatDuration(ms, options = {}) {
    const { showSeconds = true, compact = false } = options;
    
    if (!ms || ms <= 0 || !isFinite(ms)) return showSeconds ? '0s' : '0m';
    
    // Cap at 1 year
    const MAX_MS = 365 * 24 * 60 * 60 * 1000;
    ms = Math.min(ms, MAX_MS);
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    if (showSeconds && seconds % 60 > 0 && days === 0) parts.push(`${seconds % 60}s`);
    
    if (compact && parts.length > 2) {
        return parts.slice(0, 2).join(' ');
    }
    
    return parts.join(' ') || (showSeconds ? '0s' : '0m');
}

/**
 * Format time remaining with smart display
 * @param {number} milliseconds - Time remaining in ms
 * @returns {string} Formatted time string
 */
function formatTimeRemaining(milliseconds) {
    if (!milliseconds || milliseconds <= 0 || !isFinite(milliseconds)) {
        return '0s';
    }
    
    const MAX_MS = 365 * 24 * 60 * 60 * 1000;
    milliseconds = Math.min(milliseconds, MAX_MS);
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        const remainingHours = hours % 24;
        return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    } else if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
}

/**
 * Format timestamp to "X ago" format
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted "ago" string
 */
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}

/**
 * Format timestamp to locale string with various formats
 * @param {number} timestamp - Unix timestamp
 * @param {string} format - 'full', 'short', 'date', 'time'
 * @returns {string} Formatted date string
 */
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

/**
 * Simple time format for music/media players (MM:SS or HH:MM:SS)
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time
 */
function formatTime(ms) {
    if (!ms || ms < 0) return '0:00';
    
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Promise-based delay function for async/await usage
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Date/Week identifiers
    getWeekIdentifier,
    getCurrentDate,
    
    // Reset timers
    getTimeUntilDailyReset,
    getTimeUntilWeeklyReset,
    getNextResetTime,
    shouldSendResetWarning,
    
    // Day/Week checks
    isNewDay,
    isNewWeek,
    getDaysSince,
    getHoursSince,
    isWithinTimeWindow,
    
    // Date boundaries
    getStartOfDay,
    getStartOfWeek,
    getEndOfDay,
    getEndOfWeek,
    
    // Duration formatting
    formatDuration,
    formatTimeRemaining,
    formatTimeAgo,
    formatTimestamp,
    formatTime,
    
    // Utility
    delay
};