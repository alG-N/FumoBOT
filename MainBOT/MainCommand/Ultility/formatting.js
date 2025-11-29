const { RARITY_PRIORITY, compareFumos, isRarer } = require('../Configuration/rarity');

function formatNumber(number) {
    return number.toLocaleString();
}

/**
 * Parse bet string (e.g., "100k" -> 100000)
 * @param {string} str - Bet string
 * @returns {number} Parsed number or NaN
 */
function parseBet(str) {
    if (!str) return NaN;
    const match = str.replace(/,/g, '').toLowerCase().match(/^(\d+(\.\d+)?)([kmb])?$/);
    if (!match) return NaN;
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    return Math.floor(parseFloat(match[1]) * (multipliers[match[3]] || 1));
}

/**
 * Obscure very small percentages as "???"
 * @param {number} boostedChance - Boosted chance percentage
 * @returns {string|null} Obscured string or null if not obscured
 */
function obscureChance(boostedChance) {
    if (boostedChance >= 0.1) return null;
    const zeros = boostedChance.toExponential().split('e-')[1];
    const level = parseInt(zeros) || 2;
    return '?'.repeat(level) + '%';
}

module.exports = {
    formatNumber,
    parseBet,
    obscureChance,
    // Export rarity utilities for convenience
    compareFumos,
    isRarer,
    RARITY_PRIORITY
};