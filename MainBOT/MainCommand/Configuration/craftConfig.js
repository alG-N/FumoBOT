const CRAFT_TYPES = {
    ITEM: 'item',
    POTION: 'potion',
    FUMO: 'fumo',
    BLESSING: 'blessing'
};

const CRAFT_CONFIG = {
    HISTORY_LIMIT: 10,
    CONFIRM_TIMEOUT: 15000,
    MAX_CRAFT_AMOUNT: 1000,
    TIMER_DURATION: {
        ITEM: 0,
        POTION: 0,
        FUMO: 300000,
        BLESSING: 600000
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

module.exports = {
    CRAFT_TYPES,
    CRAFT_CONFIG,
    CRAFT_CATEGORIES
};