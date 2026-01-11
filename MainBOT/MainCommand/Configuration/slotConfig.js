const SLOT_CONFIG = {
    reels: ['🍒', '🍋', '🔔', '💎', '7️⃣', '🍉', '🪙'],
    
    minBets: { 
        coins: 100000, 
        gems: 10000 
    },
    
    payouts: {
        '7️⃣': { 
            multiplier: 10, 
            message: '🎉 JACKPOT! You hit 7️⃣ 7️⃣ 7️⃣! This is your lucky day! 🎉' 
        },
        '💎': { 
            multiplier: 5, 
            message: '💎 Amazing! You hit 💎 💎 💎! Your luck is shining bright! 💎' 
        },
        '🔔': { 
            multiplier: 3, 
            message: '🔔 Great! You hit 🔔 🔔 🔔! Keep up the good work! 🔔' 
        },
        '🍋': { 
            multiplier: 2, 
            message: '🍋 Not bad! You hit 🍋 🍋 🍋! Better luck next time! 🍋' 
        },
        '🍒': { 
            multiplier: 1.5, 
            message: '🍒 You hit 🍒 🍒 🍒! Keep spinning for bigger wins! 🍒' 
        },
        '🍉': { 
            multiplier: 1, 
            message: '🍉 Nice! You hit 🍉 🍉 🍉! Enjoy your win! 🍉' 
        },
        '🪙': { 
            multiplier: 0.5, 
            message: '🪙 You hit 🪙 🪙 🪙! Keep going for the big prize! 🪙' 
        }
    },
    
    twoMatch: { 
        multiplier: 0, 
        message: '🎯 Close call! You hit two in a row! Keep trying! 🎲' 
    },
    
    noMatch: { 
        multiplier: 0, 
        message: '🌈 Keep believing! Jackpots are won by those who don\'t quit. Keep spinning! 💫' 
    },
    
    cooldown: 2000,
    
    validCurrencies: ['coins', 'gems']
};

function isValidCurrency(currency) {
    return SLOT_CONFIG.validCurrencies.includes(currency?.toLowerCase());
}

function getMinBet(currency) {
    return SLOT_CONFIG.minBets[currency?.toLowerCase()] || 0;
}

function getPayoutInfo(symbol) {
    return SLOT_CONFIG.payouts[symbol] || null;
}

module.exports = {
    SLOT_CONFIG,
    
    isValidCurrency,
    getMinBet,
    getPayoutInfo
};