/**
 * Format Utility
 * Formatting helper functions
 */

/**
 * Format duration from milliseconds to readable string
 */
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format number with commas
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Parse duration string (mm:ss or hh:mm:ss) to milliseconds
 */
function parseDuration(durationStr) {
    if (typeof durationStr === 'number') return durationStr;
    if (!durationStr) return 0;

    const parts = durationStr.split(':').map(Number);
    
    if (parts.length === 2) {
        return (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
        return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    
    return 0;
}

/**
 * Format progress bar
 */
function formatProgressBar(current, total, length = 20) {
    const progress = Math.floor((current / total) * length);
    const empty = length - progress;
    
    const bar = '█'.repeat(progress) + '░'.repeat(empty);
    const percentage = Math.floor((current / total) * 100);
    
    return `${bar} ${percentage}%`;
}

module.exports = {
    formatDuration,
    formatNumber,
    formatTimestamp,
    truncate,
    parseDuration,
    formatProgressBar,
};