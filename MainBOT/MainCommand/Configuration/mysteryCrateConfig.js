const CRATE_TIERS = {
    WOODEN: {
        name: 'Wooden Crate',
        emoji: '📦',
        minBet: 100,
        color: 0x8B4513,
        outcomes: [
            { weight: 35, multiplier: 0, text: 'Empty crate...', emoji: '💨' },
            { weight: 30, multiplier: 0.5, text: 'Half refund', emoji: '😐' },
            { weight: 20, multiplier: 1.5, text: 'Small profit!', emoji: '💵' },
            { weight: 10, multiplier: 2.5, text: 'Good find!', emoji: '💰' },
            { weight: 4, multiplier: 5, text: 'Great treasure!', emoji: '🎊' },
            { weight: 1, multiplier: 10, text: 'Jackpot!', emoji: '🎉' }
        ]
    },
    IRON: {
        name: 'Iron Crate',
        emoji: '⚙️',
        minBet: 10000,
        color: 0x808080,
        outcomes: [
            { weight: 25, multiplier: 0, text: 'Rusted lock...', emoji: '🔒' },
            { weight: 25, multiplier: 0.75, text: 'Partial refund', emoji: '😕' },
            { weight: 25, multiplier: 2, text: 'Double up!', emoji: '💰' },
            { weight: 15, multiplier: 4, text: 'Big win!', emoji: '🎊' },
            { weight: 7, multiplier: 8, text: 'Huge payout!', emoji: '💎' },
            { weight: 2, multiplier: 15, text: 'Iron fortune!', emoji: '⚡' },
            { weight: 1, multiplier: 25, text: 'MEGA WIN!', emoji: '🔥' }
        ]
    },
    GOLD: {
        name: 'Golden Crate',
        emoji: '🏆',
        minBet: 1000000,
        color: 0xFFD700,
        outcomes: [
            { weight: 20, multiplier: 0.25, text: 'Cursed gold...', emoji: '☠️' },
            { weight: 20, multiplier: 1, text: 'Break even', emoji: '➖' },
            { weight: 25, multiplier: 3, text: 'Triple profit!', emoji: '💰' },
            { weight: 20, multiplier: 6, text: 'Golden haul!', emoji: '🌟' },
            { weight: 10, multiplier: 12, text: 'Incredible!', emoji: '✨' },
            { weight: 4, multiplier: 25, text: 'LEGENDARY!', emoji: '👑' },
            { weight: 1, multiplier: 50, text: 'DIVINE FORTUNE!', emoji: '🌈' }
        ]
    },
    DIAMOND: {
        name: 'Diamond Crate',
        emoji: '💎',
        minBet: 100000000,
        color: 0x00FFFF,
        outcomes: [
            { weight: 15, multiplier: 0.5, text: 'Fake diamonds...', emoji: '💔' },
            { weight: 20, multiplier: 2, text: 'Solid return', emoji: '💵' },
            { weight: 25, multiplier: 5, text: 'Diamond shine!', emoji: '💎' },
            { weight: 20, multiplier: 10, text: 'Brilliant!', emoji: '⭐' },
            { weight: 12, multiplier: 20, text: 'SPECTACULAR!', emoji: '✨' },
            { weight: 6, multiplier: 50, text: 'TRANSCENDENT!', emoji: '🌟' },
            { weight: 2, multiplier: 100, text: 'ULTIMATE JACKPOT!', emoji: '🎰' }
        ]
    },
    MYSTERY: {
        name: 'Mystery Crate',
        emoji: '❓',
        minBet: 1,
        color: 0x9932CC,
        outcomes: [
            { weight: 20, multiplier: 0, text: 'Vanished!', emoji: '🌫️' },
            { weight: 15, multiplier: 0.1, text: 'Nearly nothing...', emoji: '😢' },
            { weight: 15, multiplier: 1, text: 'Mysterious balance', emoji: '🔮' },
            { weight: 15, multiplier: 3, text: 'Enigmatic profit', emoji: '🎭' },
            { weight: 12, multiplier: 7, text: 'Cryptic fortune!', emoji: '🌙' },
            { weight: 10, multiplier: 15, text: 'Arcane treasure!', emoji: '🔯' },
            { weight: 7, multiplier: 30, text: 'MYSTICAL!', emoji: '✨' },
            { weight: 4, multiplier: 75, text: 'OTHERWORLDLY!', emoji: '👁️' },
            { weight: 1.5, multiplier: 150, text: 'COSMIC ANOMALY!', emoji: '🌌' },
            { weight: 0.5, multiplier: 500, text: 'REALITY BREACH!', emoji: '⚡' }
        ]
    }
};

const SPECIAL_EVENTS = {
    DOUBLE_TROUBLE: {
        name: 'Double Trouble',
        chance: 0.05,
        effect: 'open_twice',
        description: 'Open the crate twice!',
        emoji: '🎲🎲'
    },
    LUCKY_STREAK: {
        name: 'Lucky Streak',
        chance: 0.03,
        effect: 'reroll_on_loss',
        description: 'Reroll if you lose!',
        emoji: '🍀'
    },
    MIRROR_CRATE: {
        name: 'Mirror Crate',
        chance: 0.02,
        effect: 'show_all',
        description: 'See all outcomes!',
        emoji: '🪞'
    },
    GOLDEN_TOUCH: {
        name: 'Golden Touch',
        chance: 0.01,
        effect: 'multiply_win',
        multiplier: 2,
        description: 'Double your winnings!',
        emoji: '👑'
    },
    CURSED_CRATE: {
        name: 'Cursed Crate',
        chance: 0.04,
        effect: 'lose_all_on_zero',
        description: 'Lose everything if you get 0x!',
        emoji: '💀'
    }
};

const COMBO_BONUSES = {
    THREE_WINS: {
        threshold: 3,
        bonus: 0.1,
        description: '+10% on next bet',
        emoji: '🔥'
    },
    FIVE_WINS: {
        threshold: 5,
        bonus: 0.25,
        description: '+25% on next bet',
        emoji: '⚡'
    },
    TEN_WINS: {
        threshold: 10,
        bonus: 0.5,
        description: '+50% on next bet',
        emoji: '💫'
    }
};

const CRATE_LIMITS = {
    MIN_BET: 1,
    MAX_BET: null,
    MIN_CRATES: 3,
    MAX_CRATES: 5,
    MAX_SESSION_GAMES: 50,
    SESSION_TIMEOUT: 300000
};

const CRATE_TIMEOUTS = {
    SELECTION: 30000,
    RESULT_DISPLAY: 15000,
    NEXT_GAME: 20000
};

const CRATE_COOLDOWN = 2000;
const VALID_CURRENCIES = ['coins', 'gems'];

function getTierByBet(betAmount, currency) {
    const tiers = Object.entries(CRATE_TIERS).sort((a, b) => b[1].minBet - a[1].minBet);
    
    for (const [key, tier] of tiers) {
        if (betAmount >= tier.minBet) {
            return { key, ...tier };
        }
    }
    
    return { key: 'WOODEN', ...CRATE_TIERS.WOODEN };
}

function rollCrateOutcome(tier) {
    const outcomes = tier.outcomes;
    const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * totalWeight;
    
    for (const outcome of outcomes) {
        roll -= outcome.weight;
        if (roll <= 0) {
            return outcome;
        }
    }
    
    return outcomes[outcomes.length - 1];
}

function checkSpecialEvent() {
    const roll = Math.random();
    let cumulative = 0;
    
    for (const [key, event] of Object.entries(SPECIAL_EVENTS)) {
        cumulative += event.chance;
        if (roll <= cumulative) {
            return { triggered: true, event: key, ...event };
        }
    }
    
    return { triggered: false };
}

function calculateReward(betAmount, outcome, specialEvent = null, comboMultiplier = 1) {
    let baseReward = Math.floor(betAmount * outcome.multiplier);
    
    if (specialEvent?.effect === 'multiply_win' && outcome.multiplier > 0) {
        baseReward *= specialEvent.multiplier;
    }
    
    if (comboMultiplier > 1 && outcome.multiplier > 0) {
        baseReward = Math.floor(baseReward * comboMultiplier);
    }
    
    const netChange = baseReward - betAmount;
    
    return {
        baseReward,
        netChange,
        finalAmount: baseReward
    };
}

function getComboBonus(winStreak) {
    const bonuses = Object.values(COMBO_BONUSES).sort((a, b) => b.threshold - a.threshold);
    
    for (const bonus of bonuses) {
        if (winStreak >= bonus.threshold) {
            return { active: true, multiplier: 1 + bonus.bonus, ...bonus };
        }
    }
    
    return { active: false, multiplier: 1 };
}

function isValidCurrency(currency) {
    return VALID_CURRENCIES.includes(currency?.toLowerCase());
}

function validateBetAmount(amount, tier) {
    if (isNaN(amount) || amount < tier.minBet) {
        return { valid: false, minBet: tier.minBet };
    }
    
    return { valid: true };
}

function validateCrateCount(count) {
    return !isNaN(count) && count >= CRATE_LIMITS.MIN_CRATES && count <= CRATE_LIMITS.MAX_CRATES;
}

module.exports = {
    CRATE_TIERS,
    SPECIAL_EVENTS,
    COMBO_BONUSES,
    CRATE_LIMITS,
    CRATE_TIMEOUTS,
    CRATE_COOLDOWN,
    VALID_CURRENCIES,
    
    getTierByBet,
    rollCrateOutcome,
    checkSpecialEvent,
    calculateReward,
    getComboBonus,
    isValidCurrency,
    validateBetAmount,
    validateCrateCount
};