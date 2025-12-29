/**
 * Admin Utilities
 * Shared utility functions for admin operations
 */

const { AMOUNT_SUFFIXES, BAN_DURATION_MULTIPLIERS } = require('../Config/adminConfig');

// ═══════════════════════════════════════════════════════════════
// AMOUNT PARSING
// ═══════════════════════════════════════════════════════════════

/**
 * Parse amount string with suffixes (K, M, B, T, etc.)
 * @param {string} input - Input string like "1.5M" or "500K"
 * @param {number} max - Maximum allowed value (default: Infinity)
 * @returns {number} - Parsed number or NaN if invalid
 */
function parseAmount(input, max = Infinity) {
    const match = input.toLowerCase().trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
    if (!match) return NaN;

    const [, numStr, suffix] = match;
    let num = parseFloat(numStr);

    if (suffix && AMOUNT_SUFFIXES[suffix]) {
        num *= AMOUNT_SUFFIXES[suffix];
    } else if (suffix) {
        return NaN; // Invalid suffix
    }

    return Math.min(num, max);
}

/**
 * Format a large number with appropriate suffix
 * @param {number} num - Number to format
 * @returns {string} - Formatted string with suffix
 */
function formatAmount(num) {
    const suffixEntries = Object.entries(AMOUNT_SUFFIXES).sort((a, b) => b[1] - a[1]);
    
    for (const [suffix, multiplier] of suffixEntries) {
        if (num >= multiplier) {
            const value = num / multiplier;
            return `${value.toFixed(value % 1 === 0 ? 0 : 2)}${suffix.toUpperCase()}`;
        }
    }
    
    return num.toLocaleString();
}

// ═══════════════════════════════════════════════════════════════
// DURATION PARSING
// ═══════════════════════════════════════════════════════════════

/**
 * Parse duration string (e.g., "1d", "2h", "30m")
 * @param {string} durationStr - Duration string
 * @returns {number|null} - Duration in milliseconds or null if invalid
 */
function parseDuration(durationStr) {
    const regex = /^(\d+)([smhdwy])$/i;
    const match = durationStr.match(regex);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    return num * (BAN_DURATION_MULTIPLIERS[unit] || 0);
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} - Human-readable duration
 */
function formatDuration(ms) {
    if (!ms) return 'Permanent';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''}`;
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''}`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
}

// ═══════════════════════════════════════════════════════════════
// TIME UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate age from a date
 * @param {Date} date - Date to calculate age from
 * @returns {Object} - Age object with formatted string and breakdown
 */
function getAge(date) {
    const ageMs = Date.now() - date.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageYears = Math.floor(ageDays / 365);
    const ageMonths = Math.floor((ageDays % 365) / 30);
    
    const parts = [];
    if (ageYears > 0) parts.push(`${ageYears}y`);
    if (ageMonths > 0) parts.push(`${ageMonths}m`);
    if (parts.length === 0) parts.push(`${ageDays}d`);
    
    return {
        timestamp: date.getTime(),
        days: ageDays,
        years: ageYears,
        months: ageMonths,
        formatted: parts.join(' '),
        fullDate: date.toLocaleDateString()
    };
}

// ═══════════════════════════════════════════════════════════════
// STRING UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Truncate string to max length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated string
 */
function truncate(str, maxLength = 1024) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format file size in bytes to human-readable
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
function formatSize(bytes) {
    const megabytes = bytes / 1024 / 1024;
    return `${megabytes.toFixed(2)} MB`;
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Validate Discord user ID format
 * @param {string} userId - User ID to validate
 * @returns {boolean}
 */
function isValidUserId(userId) {
    return /^\d{17,19}$/.test(userId);
}

/**
 * Validate positive integer
 * @param {number} num - Number to validate
 * @returns {boolean}
 */
function isPositiveInteger(num) {
    return Number.isInteger(num) && num > 0;
}

module.exports = {
    // Amount utilities
    parseAmount,
    formatAmount,
    
    // Duration utilities
    parseDuration,
    formatDuration,
    
    // Time utilities
    getAge,
    
    // String utilities
    truncate,
    formatSize,
    
    // Validation utilities
    isValidUserId,
    isPositiveInteger
};
