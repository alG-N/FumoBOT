const DICE_MODES = {
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
};

const DICE_LIMITS = {
    MIN_BET: 1,
    MAX_MODES: 5
};

const DICE_TIMEOUTS = {
    SELECTION: 30000,
    PLAY_AGAIN: 15000
};

const DICE_COOLDOWN = 3000;

const VALID_CURRENCIES = ['coins', 'gems'];

const DICE_EMOJIS = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

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
    const modeConfig = DICE_MODES[mode];
    
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
    
    return {
        playerRolls,
        houseRolls,
        playerTotal,
        houseTotal,
        outcome,
        netChange,
        multiplier: modeConfig.winMultiplier
    };
}

function formatDiceRolls(rolls) {
    return rolls.map(r => DICE_EMOJIS[r - 1]).join(' ');
}

function isValidCurrency(currency) {
    return VALID_CURRENCIES.includes(currency?.toLowerCase());
}

function isValidMode(mode) {
    return Object.keys(DICE_MODES).includes(mode?.toUpperCase());
}

function validateBetAmount(amount) {
    return !isNaN(amount) && amount >= DICE_LIMITS.MIN_BET;
}

module.exports = {
    DICE_MODES,
    DICE_LIMITS,
    DICE_TIMEOUTS,
    DICE_COOLDOWN,
    VALID_CURRENCIES,
    DICE_EMOJIS,
    rollDice,
    calculateTotal,
    getDiceResult,
    formatDiceRolls,
    isValidCurrency,
    isValidMode,
    validateBetAmount
};