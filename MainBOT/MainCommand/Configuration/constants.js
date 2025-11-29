module.exports = {
    // Gacha costs and rates
    GACHA_COST: 100,
    GACHA_COOLDOWN: 4000,
    
    // Rarity thresholds (used in crategacha.js)
    RARITY_THRESHOLDS: {
        TRANSCENDENT: 0.0000667,
        ETERNAL: 0.0002667,
        INFINITE: 0.0007667,
        CELESTIAL: 0.0018777,
        ASTRAL: 0.0052107,
        QUESTION: 0.0118767,
        EXCLUSIVE: 0.0318767,
        MYTHICAL: 0.1318767,
        LEGENDARY: 0.5318767,
        OTHERWORLDLY: 1.5318767,
        EPIC: 7.5318767,
        RARE: 17.5318767,
        UNCOMMON: 42.5318767
    },

    // Pity system
    PITY: {
        TRANSCENDENT: 1_500_000,
        ETERNAL: 500_000,
        INFINITE: 200_000,
        CELESTIAL: 90_000,
        ASTRAL: 30_000
    },

    // Boost system
    BOOST_CHARGE_MAX: 1000,
    BOOST_ACTIVE_ROLLS: 250,
    BOOST_MULTIPLIER: 25,
    BONUS_ROLL_MULTIPLIER: 2,

    // Passive income (every 5 seconds)
    PASSIVE_COINS: 150,
    PASSIVE_GEMS: 50,
    INCOME_INTERVAL: 5000,

    // Selling rewards
    SELL_REWARDS: {
        'Common': 20,
        'UNCOMMON': 50,
        'RARE': 70,
        'EPIC': 150,
        'OTHERWORLDLY': 300,
        'LEGENDARY': 1300,
        'MYTHICAL': 7000
    },

    // Shiny chances
    SHINY_BASE_CHANCE: 0.01,
    SHINY_LUCK_BONUS: 0.02,
    ALG_BASE_CHANCE: 0.00001,
    ALG_LUCK_BONUS: 0.00009,

    // Event gacha
    EVENT_ROLL_LIMIT: 50000,
    EVENT_WINDOW_MS: 30 * 60 * 1000,
    EVENT_MYTHICAL_PITY: 1000,
    EVENT_QUESTION_PITY: 10000,

    // Gambling
    SLOT_MIN_COINS: 100_000,
    SLOT_MIN_GEMS: 10_000,

    // System
    LOG_CHANNEL_ID: '1411386632589807719',
    BACKUP_CHANNEL_ID: '1367500981809447054'
};