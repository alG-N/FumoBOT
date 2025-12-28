const { RARITY_PRIORITY, compareFumos, isRarer } = require('../Configuration/rarity');

const SUFFIXES = [
    { value: 1e63, suffix: 'Vg' },  
    { value: 1e60, suffix: 'Nd' }, 
    { value: 1e57, suffix: 'Od' }, 
    { value: 1e54, suffix: 'Sd' }, 
    { value: 1e51, suffix: 'Sxd' }, 
    { value: 1e48, suffix: 'Qid' },  
    { value: 1e45, suffix: 'Qad' }, 
    { value: 1e42, suffix: 'Td' },   
    { value: 1e39, suffix: 'Dd' },  
    { value: 1e36, suffix: 'Ud' },  
    { value: 1e33, suffix: 'Dc' },  
    { value: 1e30, suffix: 'No' },   
    { value: 1e27, suffix: 'Oc' }, 
    { value: 1e24, suffix: 'Sp' }, 
    { value: 1e21, suffix: 'Sx' },  
    { value: 1e18, suffix: 'Qi' }, 
    { value: 1e15, suffix: 'Qa' }, 
    { value: 1e12, suffix: 'T' }, 
    { value: 1e9, suffix: 'B' },  
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' }    
];

const SUFFIX_MULTIPLIERS = {};
SUFFIXES.forEach(({ value, suffix }) => {
    SUFFIX_MULTIPLIERS[suffix.toLowerCase()] = value;
});

function formatNumber(number, useAbbreviation = true, decimals = 2) {
    if (number === undefined || number === null || isNaN(number)) {
        return '0';
    }
    
    const num = typeof number === 'string' ? parseFloat(number) : number;
    
    if (isNaN(num)) {
        return '0';
    }
    
    if (!useAbbreviation || Math.abs(num) < 1000) {
        return num.toLocaleString();
    }
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    for (const { value, suffix } of SUFFIXES) {
        if (absNum >= value) {
            const formatted = (absNum / value).toFixed(decimals);
            return sign + formatted + suffix;
        }
    }
    
    return num.toLocaleString();
}

function parseBet(str) {
    if (!str) return NaN;
    
    str = str.replace(/,/g, '').toLowerCase();
    
    for (const [suffix, multiplier] of Object.entries(SUFFIX_MULTIPLIERS)) {
        if (str.endsWith(suffix)) {
            const numPart = str.slice(0, -suffix.length);
            const num = parseFloat(numPart);
            return isNaN(num) ? NaN : Math.floor(num * multiplier);
        }
    }
    
    const match = str.match(/^(\d+(\.\d+)?)([kmb])?$/);
    if (!match) return NaN;
    const multipliers = { k: 1e3, m: 1e6, b: 1e9 };
    return Math.floor(parseFloat(match[1]) * (multipliers[match[3]] || 1));
}

function parseAmount(str, userBalance) {
    if (!str) return NaN;
    str = str.replace(/,/g, '').toLowerCase();
    if (str === 'all') return userBalance;
    
    for (const [suffix, multiplier] of Object.entries(SUFFIX_MULTIPLIERS)) {
        if (str.endsWith(suffix)) {
            const numPart = str.slice(0, -suffix.length);
            const num = parseFloat(numPart);
            return isNaN(num) ? NaN : Math.floor(num * multiplier);
        }
    }
    
    const multipliers = { 
        k: 1_000, 
        m: 1_000_000, 
        b: 1_000_000_000, 
        t: 1_000_000_000_000 
    };
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

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

function formatPercentage(value, decimals = 2) {
    return (value * 100).toFixed(decimals) + '%';
}

module.exports = {
    formatNumber,
    parseBet,
    parseAmount,
    obscureChance,
    compareFumos,
    isRarer,
    RARITY_PRIORITY,
    SUFFIXES,
    SUFFIX_MULTIPLIERS,
    formatDuration,
    formatPercentage
};