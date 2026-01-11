const { THRESHOLDS, DESCRIPTIONS } = require('../Configuration/balanceConfig');
const { formatNumber } = require('./formatting');
const { formatTimeAgo, formatDuration } = require('./timeUtils');

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
    // Clamp values to prevent negative or invalid counts
    const safeCurrent = Math.max(0, current || 0);
    const safeMax = Math.max(1, max || 1);
    const ratio = Math.min(1, safeCurrent / safeMax);
    const filled = Math.max(0, Math.min(length, Math.floor(ratio * length)));
    const empty = Math.max(0, length - filled);
    const percentage = Math.min(100, Math.round(ratio * 100));
    
    return `[${'▰'.repeat(filled)}${'▱'.repeat(empty)}] ${percentage}%`;
}

// formatTimeAgo and formatDuration are now imported from timeUtils

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