const { RARITY_PRIORITY, compareFumos, isRarer } = require('../Configuration/rarity');

function formatNumber(number) {
    if (number === undefined || number === null || isNaN(number)) {
        return '0';
    }
    
    const num = typeof number === 'string' ? parseFloat(number) : number;
    
    if (isNaN(num)) {
        return '0';
    }
    
    return num.toLocaleString();
}

function parseBet(str) {
    if (!str) return NaN;
    const match = str.replace(/,/g, '').toLowerCase().match(/^(\d+(\.\d+)?)([kmb])?$/);
    if (!match) return NaN;
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    return Math.floor(parseFloat(match[1]) * (multipliers[match[3]] || 1));
}

function parseAmount(str, userBalance) {
    if (!str) return NaN;
    str = str.replace(/,/g, '').toLowerCase();
    if (str === 'all') return userBalance;
    
    const multipliers = { k: 1_000, m: 1_000_000, b: 1_000_000_000, t:1_000_000_000_000 };
    const suffix = str.slice(-1);
    const multiplier = multipliers[suffix] || 1;
    const num = parseFloat(multiplier > 1 ? str.slice(0, -1) : str);
    
    return isNaN(num) ? NaN : Math.floor(num * multiplier);
}

function obscureChance(boostedChance) {
    if (boostedChance >= 0.1) return null;
    const zeros = boostedChance.toExponential().split('e-')[1];
    const level = parseInt(zeros) || 2;
    return '?'.repeat(level) + '%';
}

module.exports = {
    formatNumber,
    parseBet,
    parseAmount,
    obscureChance,
    compareFumos,
    isRarer,
    RARITY_PRIORITY
};