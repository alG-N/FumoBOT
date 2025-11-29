const { 
    isValidChoice, 
    isValidCurrency, 
    isValidMultiplier 
} = require('../Configuration/flipConfig');

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

function parseMultiplier(str) {
    if (!str) return 2;
    
    const cleaned = str.toLowerCase().replace(/[^0-9]/g, '');
    const value = parseInt(cleaned, 10);
    
    return isNaN(value) ? 2 : value;
}

function parseFlipCommand(args) {
    if (args.length < 3) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_ARGS',
            message: 'Usage: `.flip (heads/tails) (coins/gems) (bet) (x?)`'
        };
    }
    
    const [choiceStr, currencyStr, betStr, multStr] = args;
    
    const choice = choiceStr?.toLowerCase();
    if (!isValidChoice(choice)) {
        return { 
            valid: false, 
            error: 'INVALID_CHOICE',
            choice 
        };
    }
    
    const currency = currencyStr?.toLowerCase();
    if (!isValidCurrency(currency)) {
        return { 
            valid: false, 
            error: 'INVALID_CURRENCY',
            currency 
        };
    }
    
    const bet = parseBetAmount(betStr);
    if (isNaN(bet) || bet <= 0) {
        return { 
            valid: false, 
            error: 'INVALID_BET',
            betStr 
        };
    }
    
    const multiplier = parseMultiplier(multStr);
    if (!isValidMultiplier(multiplier)) {
        return { 
            valid: false, 
            error: 'INVALID_MULTIPLIER',
            multiplier 
        };
    }
    
    return {
        valid: true,
        choice,
        currency,
        bet,
        multiplier
    };
}

function parseLeaderboardCommand(args) {
    const validTypes = ['coins', 'gems', 'wins', 'winrate', 'games'];
    const defaultType = 'coins';
    
    if (args.length === 0) {
        return { 
            valid: true, 
            type: defaultType 
        };
    }
    
    const type = args[0]?.toLowerCase();
    
    if (!validTypes.includes(type)) {
        return { 
            valid: false, 
            error: 'INVALID_TYPE',
            message: `Valid types: ${validTypes.join(', ')}`
        };
    }
    
    return { 
        valid: true, 
        type 
    };
}

function parseBatchFlipCommand(args) {
    if (args.length < 4) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_ARGS',
            message: 'Usage: `.flipbatch (heads/tails) (coins/gems) (bet) (x?) (count)`'
        };
    }
    
    const flipParse = parseFlipCommand(args.slice(0, 4));
    if (!flipParse.valid) {
        return flipParse;
    }
    
    const countStr = args[4];
    const count = parseInt(countStr, 10);
    
    if (isNaN(count) || count < 1 || count > 100) {
        return { 
            valid: false, 
            error: 'INVALID_COUNT',
            message: 'Count must be between 1 and 100.'
        };
    }
    
    return {
        valid: true,
        choice: flipParse.choice,
        currency: flipParse.currency,
        bet: flipParse.bet,
        multiplier: flipParse.multiplier,
        count
    };
}

function validateFlipInput(choice, currency, bet, multiplier) {
    if (!isValidChoice(choice)) {
        return { valid: false, error: 'INVALID_CHOICE' };
    }
    
    if (!isValidCurrency(currency)) {
        return { valid: false, error: 'INVALID_CURRENCY' };
    }
    
    if (isNaN(bet) || bet <= 0) {
        return { valid: false, error: 'INVALID_BET' };
    }
    
    if (!isValidMultiplier(multiplier)) {
        return { valid: false, error: 'INVALID_MULTIPLIER' };
    }
    
    return { valid: true };
}

module.exports = {
    parseBetAmount,
    parseMultiplier,
    parseFlipCommand,
    parseLeaderboardCommand,
    parseBatchFlipCommand,
    validateFlipInput
};