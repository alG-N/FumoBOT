const { THRESHOLDS, DESCRIPTIONS } = require('../Configuration/balanceConfig');
const { formatNumber } = require('./formatting');

function getCoinDescription(coins) {
    const { COIN } = DESCRIPTIONS;
    const { COINS } = THRESHOLDS;
    
    if (coins >= COINS.EMPEROR) return COIN.EMPEROR;
    if (coins >= COINS.RAIN) return COIN.RAIN;
    if (coins >= COINS.VAULT) return COIN.VAULT;
    if (coins >= COINS.JOURNEY) return COIN.JOURNEY;
    return COIN.DEFAULT;
}

function getGemDescription(gems) {
    const { GEM } = DESCRIPTIONS;
    const { GEMS } = THRESHOLDS;
    
    if (gems >= GEMS.EMPEROR) return GEM.EMPEROR;
    if (gems >= GEMS.SPARKLE) return GEM.SPARKLE;
    if (gems >= GEMS.DAZZLING) return GEM.DAZZLING;
    if (gems >= GEMS.JOURNEY) return GEM.JOURNEY;
    return GEM.DEFAULT;
}

function getCrateDescription(crates) {
    const { CRATE } = DESCRIPTIONS;
    const { CRATES } = THRESHOLDS;
    
    if (crates >= CRATES.LEGEND) return CRATE.LEGEND;
    if (crates >= CRATES.ENTHUSIAST) return CRATE.ENTHUSIAST;
    return CRATE.DEFAULT;
}

function getStreakDescription(streak) {
    const { STREAK } = DESCRIPTIONS;
    const { STREAK: LIMITS } = THRESHOLDS;
    
    if (streak >= LIMITS.HOT) return STREAK.HOT;
    if (streak >= LIMITS.GOOD) return STREAK.GOOD;
    if (streak >= LIMITS.NICE) return STREAK.NICE;
    return STREAK.DEFAULT;
}

function formatProgressBar(current, max, length = 10) {
    const filled = Math.floor((current / max) * length);
    const empty = length - filled;
    const percentage = Math.round((current / max) * 100);
    
    return `[${'▰'.repeat(filled)}${'▱'.repeat(empty)}] ${percentage}%`;
}

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

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours % 24 > 0) parts.push(`${hours % 24}h`);
    if (minutes % 60 > 0) parts.push(`${minutes % 60}m`);
    
    return parts.join(' ') || '0m';
}

function formatRatio(wins, losses) {
    const total = wins + losses;
    if (total === 0) return 'N/A';
    
    const winrate = ((wins / total) * 100).toFixed(1);
    return `${winrate}% (${wins}W/${losses}L)`;
}

function formatCompactNumber(number) {
    if (number >= 1e12) return (number / 1e12).toFixed(2) + 'T';
    if (number >= 1e9) return (number / 1e9).toFixed(2) + 'B';
    if (number >= 1e6) return (number / 1e6).toFixed(2) + 'M';
    if (number >= 1e3) return (number / 1e3).toFixed(1) + 'K';
    return number.toString();
}

function getWinLossEmoji(wins, losses) {
    const total = wins + losses;
    if (total === 0) return '➖';
    
    const winrate = (wins / total) * 100;
    if (winrate >= 70) return '🔥';
    if (winrate >= 55) return '✅';
    if (winrate >= 45) return '⚖️';
    if (winrate >= 30) return '⚠️';
    return '❌';
}

function getTierEmoji(value, thresholds) {
    for (const [tier, threshold] of Object.entries(thresholds).reverse()) {
        if (value >= threshold) {
            return getTierEmojiMap()[tier] || '⭐';
        }
    }
    return '📍';
}

function getTierEmojiMap() {
    return {
        EMPEROR: '👑',
        RAIN: '🌧️',
        VAULT: '🏦',
        SPARKLE: '✨',
        DAZZLING: '💎',
        LEGEND: '🏆',
        ENTHUSIAST: '📦',
        HOT: '🔥',
        GOOD: '👍',
        NICE: '😄'
    };
}

module.exports = {
    getCoinDescription,
    getGemDescription,
    getCrateDescription,
    getStreakDescription,
    formatProgressBar,
    formatTimeAgo,
    formatDuration,
    formatRatio,
    formatCompactNumber,
    getWinLossEmoji,
    getTierEmoji
};