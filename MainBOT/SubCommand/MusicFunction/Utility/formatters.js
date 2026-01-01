function fmtDur(sec) {
    sec = Number(sec) || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
}

function parseDuration(durationStr) {
    if (typeof durationStr === 'number') return durationStr;
    if (!durationStr) return 0;

    const parts = durationStr.toString().split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

function formatViewCount(views) {
    if (!views) return 'N/A';
    
    if (views >= 1000000000) {
        return (views / 1000000000).toFixed(1) + 'B';
    }
    if (views >= 1000000) {
        return (views / 1000000).toFixed(1) + 'M';
    }
    if (views >= 1000) {
        return (views / 1000).toFixed(1) + 'K';
    }
    return views.toString();
}

function formatTimestamp(ms) {
    const date = new Date(ms);
    return date.toLocaleString("en-US", { hour12: false });
}

function formatNumber(num) {
    if (!num) return '0';
    return num.toLocaleString();
}

function truncateText(text, maxLength = 50) {
    if (!text) return 'Unknown';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
}

function createProgressBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = {
    fmtDur,
    parseDuration,
    formatViewCount,
    formatTimestamp,
    formatNumber,
    truncateText,
    timeAgo,
    createProgressBar,
    formatBytes
};