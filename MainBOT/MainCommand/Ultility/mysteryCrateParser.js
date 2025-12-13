const { isValidCurrency, validateCrateCount } = require('../Configuration/mysteryCrateConfig');

function parseBetAmount(str) {
    if (!str) return NaN;
    
    const cleaned = str.replace(/,/g, '').toLowerCase();
    
    const suffixMultipliers = {
        'k': 1e3,
        'm': 1e6,
        'b': 1e9,
        't': 1e12,
        'qa': 1e15,
        'qi': 1e18,
        'sx': 1e21,
        'sp': 1e24,
        'oc': 1e27,
        'no': 1e30
    };
    
    for (const [suffix, multiplier] of Object.entries(suffixMultipliers)) {
        if (cleaned.endsWith(suffix)) {
            const numPart = cleaned.slice(0, -suffix.length);
            const num = parseFloat(numPart);
            return isNaN(num) ? NaN : Math.floor(num * multiplier);
        }
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? NaN : Math.floor(num);
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

    if (!Number.isFinite(betAmount) || betAmount < 1) {
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

function parseSessionCommand(args) {
    if (!args || args.length === 0) {
        return {
            action: 'start',
            valid: true
        };
    }

    const command = args[0].toLowerCase();

    switch (command) {
        case 'stats':
        case 's':
            return {
                action: 'stats',
                valid: true
            };

        case 'history':
        case 'h':
            return {
                action: 'history',
                valid: true,
                limit: parseInt(args[1]) || 10
            };

        case 'tiers':
        case 't':
            return {
                action: 'tiers',
                valid: true
            };

        case 'quit':
        case 'q':
        case 'end':
            return {
                action: 'quit',
                valid: true
            };

        default:
            return {
                action: 'start',
                valid: true
            };
    }
}

function validateBetInput(numCrates, betAmount, minBet, currency) {
    if (!validateCrateCount(numCrates)) {
        return {
            valid: false,
            error: 'INVALID_CRATE_COUNT'
        };
    }

    if (isNaN(betAmount) || betAmount < 1) {
        return {
            valid: false,
            error: 'INVALID_BET_AMOUNT'
        };
    }

    if (betAmount < minBet) {
        return {
            valid: false,
            error: 'BELOW_MINIMUM',
            minBet
        };
    }

    if (!isValidCurrency(currency)) {
        return {
            valid: false,
            error: 'INVALID_CURRENCY'
        };
    }

    return { valid: true };
}

module.exports = {
    parseMysteryCrateArgs,
    parseBetAmount,
    parseSessionCommand,
    validateBetInput
};