const LEADERBOARD_CONFIG = {
    CACHE_TTL: 120000,
    
    INTERACTION_TIMEOUT: 180000,
    
    TOP_DISPLAY_COUNT: 10,
    
    REFRESH_INTERVAL: 300000,
    
    CATEGORIES: {
        COINS: {
            id: 'coins',
            name: '💰 Richest Users',
            emoji: '💰',
            description: 'Users with the most coins',
            order: 1
        },
        GEMS: {
            id: 'gems',
            name: '💎 Gem Collectors',
            emoji: '💎',
            description: 'Users with the most gems',
            order: 2
        },
        FUMOS: {
            id: 'fumos',
            name: '🧸 Fumo Hoarders',
            emoji: '🧸',
            description: 'Users with the most fumos',
            order: 3
        },
        RARITY: {
            id: 'rarity',
            name: '🌟 Rarity Masters',
            emoji: '🌟',
            description: 'Users with the highest rarity fumos',
            order: 4
        },
        LEVEL: {
            id: 'level',
            name: '📊 Top Levels',
            emoji: '📊',
            description: 'Highest level users',
            order: 5
        },
        REBIRTH: {
            id: 'rebirth',
            name: '🔄 Rebirth Champions',
            emoji: '🔄',
            description: 'Most rebirths completed',
            order: 6
        },
        TOTAL_ROLLS: {
            id: 'totalRolls',
            name: '🎲 Roll Enthusiasts',
            emoji: '🎲',
            description: 'Most total rolls performed',
            order: 7
        },
        STREAK: {
            id: 'streak',
            name: '🔥 Daily Streaks',
            emoji: '🔥',
            description: 'Longest daily login streaks',
            order: 8
        },
        YUKARI_MARK: {
            id: 'yukariMark',
            name: '🌀 Yukari Blessed',
            emoji: '🌀',
            description: 'Most Yukari marks earned',
            order: 9
        },
        SPIRIT_TOKENS: {
            id: 'spiritTokens',
            name: '👻 Spirit Collectors',
            emoji: '👻',
            description: 'Most spirit tokens collected',
            order: 10
        },
        NET_WORTH: {
            id: 'netWorth',
            name: '🏆 Net Worth',
            emoji: '🏆',
            description: 'Total coins + gems value',
            order: 11
        },
        SHINY: {
            id: 'shiny',
            name: '✨ Shiny Collectors',
            emoji: '✨',
            description: 'Users with most shiny fumos',
            order: 12
        },
        ALG: {
            id: 'alg',
            name: '🌟 alG Collectors',
            emoji: '🌟',
            description: 'Users with most alG fumos',
            order: 13
        },
        PETS: {
            id: 'pets',
            name: '🐾 Pet Masters',
            emoji: '🐾',
            description: 'Users with most pets',
            order: 14
        },
        ITEMS: {
            id: 'items',
            name: '🎒 Item Collectors',
            emoji: '🎒',
            description: 'Users with most items',
            order: 15
        },
        CRAFTS: {
            id: 'crafts',
            name: '⚒️ Master Crafters',
            emoji: '⚒️',
            description: 'Most items crafted',
            order: 16
        },
        GAMBLE_WINS: {
            id: 'gambleWins',
            name: '🎰 Lucky Gamblers',
            emoji: '🎰',
            description: 'Most gambling wins',
            order: 17
        },
        GLOBAL: {
            id: 'global',
            name: '🌍 Global Rankings',
            emoji: '🌍',
            description: 'All categories overview',
            order: 0
        }
    },
    
    COLORS: {
        DEFAULT: 0xFFD700,
        GOLD: 0xFFD700,
        SILVER: 0xC0C0C0,
        BRONZE: 0xCD7F32,
        COINS: 0xFFD700,
        GEMS: 0x00FFFF,
        FUMOS: 0xFF69B4,
        RARITY: 0x9933FF,
        LEVEL: 0x3498DB,
        REBIRTH: 0xFF6347,
        STREAK: 0xFF4500,
        YUKARI: 0x9932CC,
        SPIRIT: 0x8A2BE2,
        NET_WORTH: 0x32CD32
    },
    
    RANK_MEDALS: {
        1: '🥇',
        2: '🥈',
        3: '🥉'
    },
    
    PAGINATION: {
        ITEMS_PER_PAGE: 10,
        MAX_PAGES: 10
    },
    
    RARITY_LEVELS: {
        'Common': 1,
        'UNCOMMON': 2,
        'RARE': 3,
        'EPIC': 4,
        'OTHERWORLDLY': 5,
        'LEGENDARY': 6,
        'MYTHICAL': 7,
        'EXCLUSIVE': 8,
        '???': 9,
        'ASTRAL': 10,
        'CELESTIAL': 11,
        'INFINITE': 12,
        'ETERNAL': 13,
        'TRANSCENDENT': 14
    },
    
    MIN_DISPLAY_VALUE: {
        coins: 1000,
        gems: 100,
        fumos: 5,
        level: 1,
        totalRolls: 10
    }
};

module.exports = LEADERBOARD_CONFIG;