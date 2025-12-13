const { validateBetAmount, isValidCurrency, isValidMode } = require('../../MainCommand/Configuration/diceDuelConfig');

function parseBetAmount(str) {
    if (!str) return NaN;
    
    const cleaned = str.replace(/,/g, '').toLowerCase();
    const match = cleaned.match(/^(\d+(\.\d+)?)([kmb])?$/);
    
    if (!match) return NaN;
    
    const multipliers = {
        k: 1000,
        m: 1000000,
        b: 1000000000
    };
    
    const value = parseFloat(match[1]);
    const multiplier = multipliers[match[3]] || 1;
    
    return Math.floor(value * multiplier);
}

function parseDiceDuelArgs(args) {
    if (args.length < 3) {
        return {
            valid: false,
            error: 'INSUFFICIENT_ARGS'
        };
    }

    const mode = args[0].toUpperCase();
    const betAmount = parseBetAmount(args[1]);
    const currency = (args[2] || '').toLowerCase();

    if (!isValidMode(mode)) {
        return {
            valid: false,
            error: 'INVALID_MODE',
            mode: args[0]
        };
    }

    if (!validateBetAmount(betAmount)) {
        return {
            valid: false,
            error: 'INVALID_BET_AMOUNT',
            betAmount: args[1]
        };
    }

    if (!isValidCurrency(currency)) {
        return {
            valid: false,
            error: 'INVALID_CURRENCY',
            currency
        };
    }

    return {
        valid: true,
        mode,
        betAmount,
        currency: currency === 'gems' ? 'gems' : 'coins'
    };
}

module.exports = {
    parseDiceDuelArgs,
    parseBetAmount
};