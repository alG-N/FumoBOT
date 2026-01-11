/**
 * @deprecated This file is deprecated. Please use unifiedAchievementConfig.js instead.
 * The ACHIEVEMENTS array and ACHIEVEMENT_TIERS have been moved to unifiedAchievementConfig.js
 * for better maintainability and to avoid duplication with questConfig.js.
 * 
 * Migration: Import from '../Configuration/unifiedAchievementConfig' instead.
 * This file is kept for backward compatibility but will be removed in a future update.
 */
const ACHIEVEMENTS = [
    {
        id: 'total_rolls',
        name: '🎲 Roll Mastery',
        description: 'Master the art of rolling',
        unit: 100,
        threshold: 100,
        category: 'gacha',
        tier: 'bronze',
        points: 10,
        hidden: false,
        icon: '🎲',
        milestones: [100, 500, 1000, 5000, 10000, 50000, 100000]
    },
    {
        id: 'total_prays',
        name: '🙏 Pray Mastery',
        description: 'Devoted to prayer',
        unit: 10,
        threshold: 10,
        category: 'prayer',
        tier: 'bronze',
        points: 10,
        hidden: false,
        icon: '🙏',
        milestones: [10, 50, 100, 500, 1000]
    },
    {
        id: 'shiny_collector',
        name: '✨ Shiny Collector',
        description: 'Collect shiny fumos',
        unit: 10,
        threshold: 10,
        category: 'collection',
        tier: 'silver',
        points: 25,
        hidden: false,
        icon: '✨',
        milestones: [10, 50, 100, 250, 500]
    },
    {
        id: 'alg_hunter',
        name: '🌟 alG Hunter',
        description: 'Hunt for alG fumos',
        unit: 1,
        threshold: 1,
        category: 'collection',
        tier: 'gold',
        points: 50,
        hidden: false,
        icon: '🌟',
        milestones: [1, 5, 10, 25, 50]
    },
    {
        id: 'transcendent_owner',
        name: '🌈 Transcendent Owner',
        description: 'Own a TRANSCENDENT fumo',
        unit: 1,
        threshold: 1,
        category: 'collection',
        tier: 'platinum',
        points: 100,
        hidden: false,
        icon: '🌈'
    },
    {
        id: 'coin_billionaire',
        name: '💰 Coin Billionaire',
        description: 'Accumulate 1 billion coins',
        unit: 1,
        threshold: 1_000_000_000,
        category: 'economy',
        tier: 'gold',
        points: 75,
        hidden: false,
        icon: '💰'
    },
    {
        id: 'gem_master',
        name: '💎 Gem Master',
        description: 'Accumulate 100 million gems',
        unit: 1,
        threshold: 100_000_000,
        category: 'economy',
        tier: 'gold',
        points: 75,
        hidden: false,
        icon: '💎'
    },
    {
        id: 'daily_warrior',
        name: '🔥 Daily Warrior',
        description: 'Complete 100 daily quests',
        unit: 1,
        threshold: 100,
        category: 'quests',
        tier: 'silver',
        points: 30,
        hidden: false,
        icon: '🔥'
    },
    {
        id: 'weekly_champion',
        name: '📅 Weekly Champion',
        description: 'Complete 20 weekly quests',
        unit: 1,
        threshold: 20,
        category: 'quests',
        tier: 'silver',
        points: 40,
        hidden: false,
        icon: '📅'
    },
    {
        id: 'streak_master',
        name: '⚡ Streak Master',
        description: 'Maintain a 30-day streak',
        unit: 1,
        threshold: 30,
        category: 'dedication',
        tier: 'gold',
        points: 60,
        hidden: false,
        icon: '⚡'
    },
    {
        id: 'gambler_elite',
        name: '🎰 Gambler Elite',
        description: 'Win 1000 gambling games',
        unit: 1,
        threshold: 1000,
        category: 'gamble',
        tier: 'silver',
        points: 35,
        hidden: false,
        icon: '🎰'
    },
    {
        id: 'crafter_expert',
        name: '⚒️ Crafter Expert',
        description: 'Craft 500 items',
        unit: 1,
        threshold: 500,
        category: 'crafting',
        tier: 'silver',
        points: 30,
        hidden: false,
        icon: '⚒️'
    },
    {
        id: 'rebirth_legend',
        name: '🔄 Rebirth Legend',
        description: 'Complete 10 rebirths',
        unit: 1,
        threshold: 10,
        category: 'progression',
        tier: 'platinum',
        points: 100,
        hidden: false,
        icon: '🔄'
    },
    {
        id: 'library_complete',
        name: '📚 Library Complete',
        description: 'Collect all fumos in the library',
        unit: 1,
        threshold: 1,
        category: 'collection',
        tier: 'platinum',
        points: 150,
        hidden: false,
        icon: '📚'
    },
    {
        id: 'secret_finder',
        name: '🔍 Secret Finder',
        description: '???',
        unit: 1,
        threshold: 1,
        category: 'hidden',
        tier: 'platinum',
        points: 200,
        hidden: true,
        icon: '🔍'
    },
    {
        id: 'speed_roller',
        name: '⏱️ Speed Roller',
        description: 'Roll 1000 times in 1 hour',
        unit: 1,
        threshold: 1,
        category: 'challenge',
        tier: 'gold',
        points: 80,
        hidden: false,
        icon: '⏱️'
    },
    {
        id: 'lucky_charm',
        name: '🍀 Lucky Charm',
        description: 'Get 3 ASTRAL+ in a row',
        unit: 1,
        threshold: 1,
        category: 'challenge',
        tier: 'platinum',
        points: 120,
        hidden: false,
        icon: '🍀'
    },
    {
        id: 'trader_expert',
        name: '💱 Trader Expert',
        description: 'Complete 100 trades',
        unit: 1,
        threshold: 100,
        category: 'social',
        tier: 'silver',
        points: 30,
        hidden: false,
        icon: '💱'
    },
    {
        id: 'market_mogul',
        name: '🏪 Market Mogul',
        description: 'Sell 1000 items on market',
        unit: 1,
        threshold: 1000,
        category: 'economy',
        tier: 'gold',
        points: 50,
        hidden: false,
        icon: '🏪'
    },
    {
        id: 'pet_master',
        name: '🐾 Pet Master',
        description: 'Own 50 pets',
        unit: 1,
        threshold: 50,
        category: 'collection',
        tier: 'silver',
        points: 40,
        hidden: false,
        icon: '🐾'
    }
];

const ACHIEVEMENT_TIERS = {
    bronze: {
        name: 'Bronze',
        color: 0xCD7F32,
        icon: '🥉',
        multiplier: 1.0
    },
    silver: {
        name: 'Silver',
        color: 0xC0C0C0,
        icon: '🥈',
        multiplier: 1.5
    },
    gold: {
        name: 'Gold',
        color: 0xFFD700,
        icon: '🥇',
        multiplier: 2.0
    },
    platinum: {
        name: 'Platinum',
        color: 0xE5E4E2,
        icon: '💎',
        multiplier: 3.0
    }
};

const ACHIEVEMENT_CATEGORIES = {
    gacha: {
        name: 'Gacha',
        icon: '🎲',
        description: 'Rolling achievements'
    },
    prayer: {
        name: 'Prayer',
        icon: '🙏',
        description: 'Prayer achievements'
    },
    collection: {
        name: 'Collection',
        icon: '✨',
        description: 'Collection achievements'
    },
    economy: {
        name: 'Economy',
        icon: '💰',
        description: 'Wealth achievements'
    },
    quests: {
        name: 'Quests',
        icon: '🗓️',
        description: 'Quest completion achievements'
    },
    dedication: {
        name: 'Dedication',
        icon: '🔥',
        description: 'Consistency achievements'
    },
    gamble: {
        name: 'Gambling',
        icon: '🎰',
        description: 'Gambling achievements'
    },
    crafting: {
        name: 'Crafting',
        icon: '⚒️',
        description: 'Crafting achievements'
    },
    progression: {
        name: 'Progression',
        icon: '📈',
        description: 'Level and rebirth achievements'
    },
    challenge: {
        name: 'Challenge',
        icon: '⚡',
        description: 'Difficult challenge achievements'
    },
    social: {
        name: 'Social',
        icon: '👥',
        description: 'Trading and social achievements'
    },
    hidden: {
        name: 'Hidden',
        icon: '🔒',
        description: 'Secret achievements'
    }
};

function getAchievementsByTier(tier) {
    return ACHIEVEMENTS.filter(a => a.tier === tier);
}

function getAchievementsByCategory(category) {
    return ACHIEVEMENTS.filter(a => a.category === category);
}

function getAchievementById(achievementId) {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
}

function getTierInfo(tier) {
    return ACHIEVEMENT_TIERS[tier];
}

module.exports = {
    ACHIEVEMENTS,
    ACHIEVEMENT_TIERS,
    ACHIEVEMENT_CATEGORIES,
    getAchievementsByTier,
    getAchievementsByCategory,
    getAchievementById,
    getTierInfo
};