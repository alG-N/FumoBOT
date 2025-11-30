const CRATE_OUTCOMES = [
    { multiplier: 0.15, text: 'Lose 85% of your bet', emoji: '💔' },
    { multiplier: 2, text: 'x2 your bet', emoji: '💰' },
    { multiplier: 0, text: 'Lose all your bet', emoji: '💀' },
    { multiplier: 1.5, text: 'x1.5 your bet', emoji: '💵' },
    { multiplier: 1, text: 'Nothing', emoji: '😐' },
    { multiplier: 10, text: 'x10 your bet', emoji: '🎉' },
    { multiplier: 5, text: 'x5 your bet', emoji: '🎊' },
    { multiplier: 0.5, text: 'Lose 50% of your bet', emoji: '😢' },
    { multiplier: 20, text: 'x20 your bet', emoji: '🔥' },
    { multiplier: 0.75, text: 'Lose 25% of your bet', emoji: '😕' },
    { multiplier: 50, text: 'x50 your bet', emoji: '⭐' },
    { multiplier: -1, text: 'Mystery Crate Glitch: All your balance lost!', emoji: '💥' }
];

const CRATE_LIMITS = {
    MIN_CRATES: 1,
    MAX_CRATES: 8,
    MIN_BET: 1
};

const CRATE_TIMEOUTS = {
    SELECTION: 20000,
    PLAY_AGAIN: 15000
};

const CRATE_COOLDOWN = 3000;

const VALID_CURRENCIES = ['coins', 'gems'];

function getCrateOutcome() {
    return CRATE_OUTCOMES[Math.floor(Math.random() * CRATE_OUTCOMES.length)];
}

function isValidCurrency(currency) {
    return VALID_CURRENCIES.includes(currency?.toLowerCase());
}

function validateCrateCount(count) {
    return !isNaN(count) && count >= CRATE_LIMITS.MIN_CRATES && count <= CRATE_LIMITS.MAX_CRATES;
}

function validateBetAmount(amount) {
    return !isNaN(amount) && amount >= CRATE_LIMITS.MIN_BET;
}

function calculateReward(betAmount, multiplier, balance) {
    if (multiplier === -1) {
        return { reward: 0, netChange: -balance };
    }

    const reward = Math.floor(betAmount * multiplier);
    const netChange = reward - betAmount;
    
    return { reward, netChange };
}

module.exports = {
    CRATE_OUTCOMES,
    CRATE_LIMITS,
    CRATE_TIMEOUTS,
    CRATE_COOLDOWN,
    VALID_CURRENCIES,
    
    getCrateOutcome,
    isValidCurrency,
    validateCrateCount,
    validateBetAmount,
    calculateReward
};