const MULTIPLIERS = {
    2: { win: 2, loss: 1 },
    3: { win: 3, loss: 1.5 },
    5: { win: 5, loss: 4 },
    10: { win: 10, loss: 7.5 },
    100: { win: 100, loss: 95 }
};

const VALID_CHOICES = ['heads', 'tails'];

const VALID_CURRENCIES = ['coins', 'gems'];

const MIN_BET = {
    coins: 100,
    gems: 10
};

const MAX_BET = {
    coins: null,
    gems: null
};

const FLIP_COOLDOWN = 2000;

const WIN_PROBABILITY = 0.5;

function isValidMultiplier(mult) {
    return Object.keys(MULTIPLIERS).map(Number).includes(mult);
}

function isValidChoice(choice) {
    return VALID_CHOICES.includes(choice?.toLowerCase());
}

function isValidCurrency(currency) {
    return VALID_CURRENCIES.includes(currency?.toLowerCase());
}

function getMultiplierConfig(mult) {
    return MULTIPLIERS[mult] || null;
}

function getMinBet(currency) {
    return MIN_BET[currency?.toLowerCase()] || 100;
}

function getMaxBet(currency) {
    return MAX_BET[currency?.toLowerCase()] || null;
}

module.exports = {
    MULTIPLIERS,
    VALID_CHOICES,
    VALID_CURRENCIES,
    MIN_BET,
    MAX_BET,
    FLIP_COOLDOWN,
    WIN_PROBABILITY,
    
    isValidMultiplier,
    isValidChoice,
    isValidCurrency,
    getMultiplierConfig,
    getMinBet,
    getMaxBet
};