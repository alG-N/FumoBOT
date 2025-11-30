const { validateCrateCount, validateBetAmount, isValidCurrency } = require('../Configuration/mysteryCrateConfig');

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

function parseMysteryCrateArgs(args) {
    if (args.length < 3) {
        return {
            valid: false,
            error: 'INSUFFICIENT_ARGS'
        };
    }

    const numCrates = parseInt(args[0], 10);
    const betAmount = parseBetAmount(args[1]);
    const currency = (args[2] || '').toLowerCase();

    if (!validateCrateCount(numCrates)) {
        return {
            valid: false,
            error: 'INVALID_CRATE_COUNT',
            numCrates
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
        numCrates,
        betAmount,
        currency: currency === 'gems' ? 'gems' : 'coins'
    };
}

module.exports = {
    parseMysteryCrateArgs,
    parseBetAmount
};