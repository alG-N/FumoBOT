const CRAFT_TYPES = {
    ITEM: 'item',
    POTION: 'potion',
    FUMO: 'fumo',
    BLESSING: 'blessing'
};

const CRAFT_CONFIG = {
    HISTORY_LIMIT: 10,
    INTERACTION_TIMEOUT: 60000,
    MAX_CRAFT_AMOUNT: 1000,
    MAX_QUEUE_SLOTS: 5,
    
    // Timer durations in milliseconds
    TIMER_DURATION: {
        ITEM: {
            'ForgottenBook(C)': 60000,           // 1 minute
            'FantasyBook(M)': 300000,            // 5 minutes
            'Lumina(M)': 600000,                 // 10 minutes
            'AncientRelic(E)': 900000,           // 15 minutes
            'MysteriousCube(M)': 1200000,        // 20 minutes
            'TimeClock(L)': 1800000,             // 30 minutes
            'MysteriousDice(M)': 2400000,        // 40 minutes
            'Nullified(?)': 3600000,             // 1 hour
            'S!gil?(?)': 7200000                 // 2 hours
        },
        POTION: {
            'CoinPotionT2(R)': 120000,           // 2 minutes
            'CoinPotionT3(R)': 240000,           // 4 minutes
            'CoinPotionT4(L)': 480000,           // 8 minutes
            'CoinPotionT5(M)': 960000,           // 16 minutes
            'GemPotionT2(R)': 120000,            // 2 minutes
            'GemPotionT3(R)': 240000,            // 4 minutes
            'GemPotionT4(L)': 480000,            // 8 minutes
            'GemPotionT5(M)': 960000,            // 16 minutes
            'BoostPotionT1(L)': 180000,          // 3 minutes
            'BoostPotionT2(L)': 360000,          // 6 minutes
            'BoostPotionT3(L)': 720000,          // 12 minutes
            'BoostPotionT4(M)': 1440000,         // 24 minutes
            'BoostPotionT5(M)': 2880000          // 48 minutes
        },
        FUMO: 300000,     // 5 minutes default
        BLESSING: 600000  // 10 minutes default
    }
};

const CRAFT_CATEGORIES = {
    ITEM: {
        tiers: ['How to Craft', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Tier 6(MAX)'],
        icons: {
            '1': '[T1]',
            '2': '[T2]',
            '3': '[T3]',
            '4': '[T4]',
            '5': '[T5]',
            '6': '[T6]'
        }
    },
    POTION: {
        categories: ['How to Craft', 'Coins Potion', 'Gems Potion', 'Other Potion', 'Craft History'],
        tierIcons: {
            '1': '[T1 • L]',
            '2': '[T2 • R]',
            '3': '[T3 • R]',
            '4': '[T4 • L]',
            '5': '[T5 • M]'
        }
    }
};

function getCraftTimer(craftType, itemName) {
    const timers = CRAFT_CONFIG.TIMER_DURATION[craftType.toUpperCase()];
    
    if (typeof timers === 'object') {
        return timers[itemName] || 0;
    }
    
    return timers || 0;
}

function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${seconds}s`;
    }
}

module.exports = {
    CRAFT_TYPES,
    CRAFT_CONFIG,
    CRAFT_CATEGORIES,
    getCraftTimer,
    formatTime
};