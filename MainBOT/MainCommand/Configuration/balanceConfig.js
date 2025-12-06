module.exports = {
    CACHE_TTL: 30000,
    
    INTERACTION_TIMEOUT: 120000,
    
    PAGES: {
        OVERVIEW: 0,
        PRAYER: 1,
        STATS: 2,
        ACHIEVEMENTS: 3,
        PROGRESSION: 4,
        ACTIVITY: 5
    },
    
    COLORS: {
        DEFAULT: 0xffcc00,
        SUCCESS: 0x2ecc71,
        WARNING: 0xf39c12,
        ERROR: 0xe74c3c,
        INFO: 0x3498db
    },
    
    THRESHOLDS: {
        COINS: {
            EMPEROR: 1e15,
            RAIN: 1e9,
            VAULT: 1e6,
            JOURNEY: 1e3
        },
        GEMS: {
            EMPEROR: 1e15,
            SPARKLE: 1e9,
            DAZZLING: 1e6,
            JOURNEY: 1e3
        },
        CRATES: {
            LEGEND: 1e6,
            ENTHUSIAST: 1e3
        },
        STREAK: {
            HOT: 7,
            GOOD: 5,
            NICE: 3
        }
    },
    
    ACHIEVEMENTS: [
        {
            id: 'billionaire',
            name: '💸 Billionaire',
            check: (row) => row.coins >= 1e12
        },
        {
            id: 'gem_master',
            name: '💎 Gem Master',
            check: (row) => row.gems >= 1e9
        },
        {
            id: 'weekly_warrior',
            name: '🔥 Weekly Warrior',
            check: (row) => row.dailyStreak >= 7
        },
        {
            id: 'dedicated',
            name: '🎯 Dedicated Player',
            check: (row) => row.dailyStreak >= 30
        },
        {
            id: 'crate_opener',
            name: '📦 Crate Opener',
            check: (row) => row.totalRolls >= 1000
        },
        {
            id: 'yukari_blessed',
            name: '🌀 Yukari Blessed',
            check: (row) => row.yukariMark >= 10
        },
        {
            id: 'rebirth_master',
            name: '🔄 Rebirth Master',
            check: (row) => row.rebirth >= 1
        },
        {
            id: 'high_level',
            name: '📈 High Level',
            check: (row) => row.level >= 50
        }
    ],
    
    DESCRIPTIONS: {
        COIN: {
            EMPEROR: '👑💰 You are the Emperor of Coins! 💰👑',
            RAIN: '🌧️💰 Coins rain down around you! 💰🌧️',
            VAULT: '🏦💰 Your coin vault is overflowing! 💰🏦',
            JOURNEY: '🌟💰 Your coin journey has just begun! 💰🌟',
            DEFAULT: '💰 Every coin brings you closer to fortune! 💰'
        },
        GEM: {
            EMPEROR: '👑💎 You are the Emperor of Gems! 💎👑',
            SPARKLE: '✨💎 Gems sparkle in your presence! 💎✨',
            DAZZLING: '💎✨ Your gem collection is dazzling! ✨💎',
            JOURNEY: '🌟💎 Your gem journey has just begun! 💎🌟',
            DEFAULT: '💎 Every gem brings you closer to sparkle! 💎'
        },
        CRATE: {
            LEGEND: '📦🌟 You are a crate-opening legend! 📦🌟',
            ENTHUSIAST: '📦 You are a crate-opening enthusiast! 📦',
            DEFAULT: '📦 Keep opening those crates! 📦'
        },
        STREAK: {
            HOT: '🔥 You are on a hot streak! 🔥',
            GOOD: '👍 Keep up the good work! 👍',
            NICE: '😄 Nice streak, keep it going! 😄',
            DEFAULT: '📅 Every day counts towards your streak! 📅'
        }
    }
};