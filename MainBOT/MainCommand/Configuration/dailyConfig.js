/**
 * Daily Reward System Configuration
 * Reworked with milestone system, streak protection, and better scaling
 */
const DAILY_CONFIG = {
    // Timing
    COOLDOWN: 24 * 60 * 60 * 1000,           // 24 hours
    STREAK_GRACE_PERIOD: 48 * 60 * 60 * 1000, // 48 hours before streak resets
    
    // Base rewards (before multipliers)
    BASE_REWARDS: {
        coins: 2000,
        gems: 200,
        spiritTokens: 1
    },
    
    // Streak multiplier: reward * (1 + streakBonus * min(streak, maxEffectiveStreak))
    STREAK_SCALING: {
        bonusPerDay: 0.05,      // 5% increase per day
        maxEffectiveStreak: 30, // Cap scaling at 30 days (150% max bonus)
        maxMultiplier: 2.5      // Maximum 2.5x rewards
    },
    
    // Milestones give special bonuses
    MILESTONES: {
        7: {
            name: 'Week Warrior',
            emoji: '🔥',
            bonusCoins: 5000,
            bonusGems: 500,
            bonusItem: { name: 'PrayTicket(B)', quantity: 50 },
            message: 'A full week of dedication!'
        },
        14: {
            name: 'Fortnight Fighter',
            emoji: '⭐',
            bonusCoins: 15000,
            bonusGems: 1500,
            bonusItem: { name: 'MysteriousDice(M)', quantity: 10 },
            message: 'Two weeks strong!'
        },
        30: {
            name: 'Monthly Master',
            emoji: '👑',
            bonusCoins: 50000,
            bonusGems: 5000,
            bonusItem: { name: 'Nullified(?)', quantity: 10 },
            message: 'A whole month! Incredible dedication!'
        },
        60: {
            name: 'Devoted Collector',
            emoji: '💎',
            bonusCoins: 150000,
            bonusGems: 15000,
            bonusItem: { name: 'LuckyCharm(?)', quantity: 1 },
            message: 'Two months of unwavering commitment!'
        },
        100: {
            name: 'Legendary Streak',
            emoji: '🏆',
            bonusCoins: 500000,
            bonusGems: 50000,
            bonusItem: { name: 'alGShard(P)', quantity: 5 },
            message: 'THE LEGENDARY 100 DAY STREAK!'
        }
    },
    
    // Lucky bonus chance (extra rewards)
    LUCKY_BONUS: {
        chance: 0.1, // 10% chance
        multiplier: 2, // Double rewards
        message: '🍀 **LUCKY BONUS!** Your rewards were doubled!'
    },
    
    // Weekend bonus
    WEEKEND_BONUS: {
        enabled: true,
        multiplier: 1.5,
        message: '🎉 **Weekend Bonus!** 1.5x rewards!'
    },
    
    // Display settings
    MESSAGE_TIMEOUT: 30000,
    MAX_STREAK_DISPLAY: 7,
    
    DEFAULT_THUMBNAIL: 'https://www.meme-arsenal.com/memes/64de2341d1ed532a646cc011ac582e1b.jpg',
    
    COOLDOWN_FOOTER: {
        text: 'Come back tomorrow for even better rewards!',
        icon: 'https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/edbbe96e-e6e4-4343-981d-7eaf881a1964/dg6bym4-429fca4d-11e6-4205-a749-5da24e2bf47f.png'
    }
};

module.exports = { DAILY_CONFIG };