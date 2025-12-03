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
    MULTIPLY_TIMER_BY_QUANTITY: true,
    
    TIMER_DURATION: {
        ITEM: {
            'ForgottenBook(C)': 600000,
            'FantasyBook(M)': 3000000,
            'Lumina(M)': 6000000,
            'AncientRelic(E)': 9000000,
            'MysteriousCube(M)': 12000000,
            'TimeClock(L)': 18000000,
            'MysteriousDice(M)': 24000000,
            'Nullified(?)': 36000000,
            'CrystalSigil(?)': 72000000,
            'VoidCrystal(?)': 108000000,
            'EternalEssence(?)': 144000000,
            'CosmicCore(?)': 180000000,
            'S!gil?(?)': 216000000
        },
        POTION: {
            'CoinPotionT2(R)': 120000,
            'CoinPotionT3(R)': 240000,
            'CoinPotionT4(L)': 480000,
            'CoinPotionT5(M)': 960000,
            'GemPotionT2(R)': 120000,
            'GemPotionT3(R)': 240000,
            'GemPotionT4(L)': 480000,
            'GemPotionT5(M)': 960000,
            'BoostPotionT1(L)': 180000,
            'BoostPotionT2(L)': 360000,
            'BoostPotionT3(L)': 720000,
            'BoostPotionT4(M)': 1440000,
            'BoostPotionT5(M)': 2880000
        },
        FUMO: 300000,
        BLESSING: 600000
    }
};

const CRAFT_CATEGORIES = {
    ITEM: {
        tiers: ['How to Craft', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5', 'Tier 6', 'Tier 7(MAX)'],
        icons: {
            '1': '[T1]',
            '2': '[T2]',
            '3': '[T3]',
            '4': '[T4]',
            '5': '[T5]',
            '6': '[T6]',
            '7': '[T7]'
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

function getCraftTimer(craftType, itemName, quantity = 1) {
    const timers = CRAFT_CONFIG.TIMER_DURATION[craftType.toUpperCase()];
    
    if (typeof timers === 'object') {
        const baseTimer = timers[itemName] || 0;
        return baseTimer * quantity;
    }
    
    return (timers || 0) * quantity;
}

function formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        const remainingHours = hours % 24;
        const remainingMinutes = minutes % 60;
        return `${days}d ${remainingHours}h ${remainingMinutes}m`;
    } else if (hours > 0) {
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