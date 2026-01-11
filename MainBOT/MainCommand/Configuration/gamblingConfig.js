// SHARED CONSTANTS
const VALID_CURRENCIES = ['coins', 'gems'];

const SHARED_MIN_BET = {
    coins: 100,
    gems: 10
};

// FLIP (Coin Flip) CONFIGURATION

const FLIP = {
    MULTIPLIERS: {
        2: { win: 2, loss: 1 },
        3: { win: 3, loss: 1.5 },
        5: { win: 5, loss: 4 },
        10: { win: 10, loss: 7.5 },
        100: { win: 100, loss: 95 }
    },
    VALID_CHOICES: ['heads', 'tails'],
    MIN_BET: { coins: 100, gems: 10 },
    MAX_BET: { coins: null, gems: null },
    COOLDOWN: 2000,
    WIN_PROBABILITY: 0.5
};

// SLOT MACHINE CONFIGURATION

const SLOT = {
    REELS: ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍉', '🪙'],
    MIN_BET: { coins: 100000, gems: 10000 },
    PAYOUTS: {
        '7️⃣': { multiplier: 10, message: '🎉 JACKPOT! You hit 7️⃣ 7️⃣ 7️⃣! This is your lucky day! 🎉' },
        '💎': { multiplier: 5, message: '💎 Amazing! You hit 💎 💎 💎! Your luck is shining bright! 💎' },
        '🔔': { multiplier: 3, message: '🔔 Great! You hit 🔔 🔔 🔔! Keep up the good work! 🔔' },
        '🍋': { multiplier: 2, message: '🍋 Not bad! You hit 🍋 🍋 🍋! Better luck next time! 🍋' },
        '🍒': { multiplier: 1.5, message: '🍒 You hit 🍒 🍒 🍒! Keep spinning for bigger wins! 🍒' },
        '🍉': { multiplier: 1, message: '🍉 Nice! You hit 🍉 🍉 🍉! Enjoy your win! 🍉' },
        '🪙': { multiplier: 0.5, message: '🪙 You hit 🪙 🪙 🪙! Keep going for the big prize! 🪙' }
    },
    TWO_MATCH: { multiplier: 0, message: '🎯 Close call! You hit two in a row! Keep trying! 🎲' },
    NO_MATCH: { multiplier: 0, message: '🌈 Keep believing! Jackpots are won by those who don\'t quit. Keep spinning! 💫' },
    COOLDOWN: 2000
};

// DICE DUEL CONFIGURATION

const DICE = {
    MODES: {
        EASY: {
            name: 'Easy',
            playerDice: 2,
            houseDice: 1,
            winMultiplier: 1.5,
            emoji: '🎲',
            description: 'Roll 2 dice vs house\'s 1 die'
        },
        MEDIUM: {
            name: 'Medium',
            playerDice: 2,
            houseDice: 2,
            winMultiplier: 2.5,
            emoji: '🎲🎲',
            description: 'Roll 2 dice vs house\'s 2 dice'
        },
        HARD: {
            name: 'Hard',
            playerDice: 3,
            houseDice: 3,
            winMultiplier: 4,
            emoji: '🎲🎲🎲',
            description: 'Roll 3 dice vs house\'s 3 dice'
        },
        EXTREME: {
            name: 'Extreme',
            playerDice: 1,
            houseDice: 3,
            winMultiplier: 8,
            emoji: '💀',
            description: 'Roll 1 die vs house\'s 3 dice - HIGH RISK!'
        },
        LEGEND: {
            name: 'Legend',
            playerDice: 5,
            houseDice: 5,
            winMultiplier: 6,
            emoji: '👑',
            description: 'Epic 5v5 dice battle'
        }
    },
    LIMITS: { MIN_BET: 1, MAX_MODES: 5 },
    TIMEOUTS: { SELECTION: 30000, PLAY_AGAIN: 15000 },
    COOLDOWN: 3000,
    EMOJIS: ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
};

// GAMBLE (Card Game) CONFIGURATION

const GAMBLE = {
    CARDS: [
        { id: 1, name: 'ReimuFumo', emoji: '⛩️' },
        { id: 2, name: 'SanaeFumo', emoji: '🐸' },
        { id: 3, name: 'MarisaFumo', emoji: '⭐' },
        { id: 4, name: 'FlandreFumo', emoji: '🦇' },
        { id: 5, name: 'SakuyaFumo', emoji: '⏰' },
        { id: 6, name: 'AliceFumo', emoji: '🎀' },
        { id: 7, name: 'YoumuFumo', emoji: '⚔️' },
        { id: 8, name: 'CirnoFumo', emoji: '❄️' },
        { id: 9, name: 'RemiliaFumo', emoji: '🌙' },
        { id: 10, name: 'YukariFumo', emoji: '👁️' }
    ],
    COUNTERS: {
        1: [2, 3, 5, 7],
        2: [3, 4, 6, 8],
        3: [4, 5, 7, 9],
        4: [5, 6, 8, 10],
        5: [6, 7, 9, 1],
        6: [7, 8, 10, 2],
        7: [8, 9, 1, 3],
        8: [9, 10, 2, 4],
        9: [10, 1, 3, 5],
        10: [1, 2, 4, 6]
    },
    CONFIG: {
        INVITATION_TIMEOUT: 20000,
        GUIDE_DURATION: 10000,
        SELECTION_DURATION: 15000,
        RESULT_DISPLAY_DURATION: 15000,
        COOLDOWN: 3000,
        MIN_BET: { coins: 100, gems: 10 },
        SAME_CARD_PENALTY: 0.5
    }
};

// SHARED HELPER FUNCTIONS

function isValidCurrency(currency) {
    return VALID_CURRENCIES.includes(currency?.toLowerCase());
}

function validateBet(currency, amount, minBetConfig = SHARED_MIN_BET) {
    const minBet = minBetConfig[currency?.toLowerCase()];
    if (!minBet) return { valid: false, error: 'INVALID_CURRENCY' };
    if (amount < minBet) return { valid: false, error: 'BELOW_MINIMUM', minBet };
    return { valid: true };
}

// FLIP HELPERS

function isValidMultiplier(mult) {
    return Object.keys(FLIP.MULTIPLIERS).map(Number).includes(mult);
}

function isValidChoice(choice) {
    return FLIP.VALID_CHOICES.includes(choice?.toLowerCase());
}

function getMultiplierConfig(mult) {
    return FLIP.MULTIPLIERS[mult] || null;
}

function getFlipMinBet(currency) {
    return FLIP.MIN_BET[currency?.toLowerCase()] || 100;
}

function getFlipMaxBet(currency) {
    return FLIP.MAX_BET[currency?.toLowerCase()] || null;
}

// SLOT HELPERS

function getSlotMinBet(currency) {
    return SLOT.MIN_BET[currency?.toLowerCase()] || 0;
}

function getPayoutInfo(symbol) {
    return SLOT.PAYOUTS[symbol] || null;
}

// DICE HELPERS
function rollDice(count) {
    const rolls = [];
    for (let i = 0; i < count; i++) {
        rolls.push(Math.floor(Math.random() * 6) + 1);
    }
    return rolls;
}

function calculateTotal(rolls) {
    return rolls.reduce((sum, roll) => sum + roll, 0);
}

function getDiceResult(mode, betAmount) {
    const modeConfig = DICE.MODES[mode];
    const playerRolls = rollDice(modeConfig.playerDice);
    const houseRolls = rollDice(modeConfig.houseDice);
    const playerTotal = calculateTotal(playerRolls);
    const houseTotal = calculateTotal(houseRolls);

    let outcome, netChange;
    if (playerTotal > houseTotal) {
        outcome = 'WIN';
        netChange = Math.floor(betAmount * (modeConfig.winMultiplier - 1));
    } else if (playerTotal < houseTotal) {
        outcome = 'LOSS';
        netChange = -betAmount;
    } else {
        outcome = 'TIE';
        netChange = 0;
    }

    return { playerRolls, houseRolls, playerTotal, houseTotal, outcome, netChange, multiplier: modeConfig.winMultiplier };
}

function formatDiceRolls(rolls) {
    return rolls.map(r => DICE.EMOJIS[r - 1]).join(' ');
}

function isValidMode(mode) {
    return Object.keys(DICE.MODES).includes(mode?.toUpperCase());
}

function validateBetAmount(amount) {
    return !isNaN(amount) && amount >= DICE.LIMITS.MIN_BET;
}

// GAMBLE (Card) HELPERS

function getCard(cardId) {
    return GAMBLE.CARDS.find(card => card.id === cardId) || null;
}

function getAllCards() {
    return [...GAMBLE.CARDS];
}

function doesCounter(card1Id, card2Id) {
    return GAMBLE.COUNTERS[card1Id]?.includes(card2Id) || false;
}

function getCounteredBy(cardId) {
    return GAMBLE.COUNTERS[cardId] || [];
}

function getCounters(cardId) {
    const result = [];
    for (const [id, counters] of Object.entries(GAMBLE.COUNTERS)) {
        if (counters.includes(cardId)) {
            result.push(parseInt(id));
        }
    }
    return result;
}

// EXPORTS

module.exports = {
    // Configs
    FLIP,
    SLOT,
    DICE,
    GAMBLE,
    VALID_CURRENCIES,
    SHARED_MIN_BET,

    // Shared helpers
    isValidCurrency,
    validateBet,

    // Flip helpers
    isValidMultiplier,
    isValidChoice,
    getMultiplierConfig,
    getFlipMinBet,
    getFlipMaxBet,

    // Slot helpers
    getSlotMinBet,
    getPayoutInfo,

    // Dice helpers
    rollDice,
    calculateTotal,
    getDiceResult,
    formatDiceRolls,
    isValidMode,
    validateBetAmount,

    // Gamble helpers
    getCard,
    getAllCards,
    doesCounter,
    getCounteredBy,
    getCounters,

    // Legacy exports for backward compatibility
    SLOT_CONFIG: SLOT,
    DICE_MODES: DICE.MODES,
    DICE_LIMITS: DICE.LIMITS,
    DICE_TIMEOUTS: DICE.TIMEOUTS,
    DICE_COOLDOWN: DICE.COOLDOWN,
    DICE_EMOJIS: DICE.EMOJIS,
    CARDS: GAMBLE.CARDS,
    COUNTERS: GAMBLE.COUNTERS,
    GAMBLE_CONFIG: GAMBLE.CONFIG,
    MULTIPLIERS: FLIP.MULTIPLIERS,
    VALID_CHOICES: FLIP.VALID_CHOICES,
    MIN_BET: FLIP.MIN_BET,
    MAX_BET: FLIP.MAX_BET,
    FLIP_COOLDOWN: FLIP.COOLDOWN,
    WIN_PROBABILITY: FLIP.WIN_PROBABILITY,
    getMinBet: getFlipMinBet,
    getMaxBet: getFlipMaxBet
};
