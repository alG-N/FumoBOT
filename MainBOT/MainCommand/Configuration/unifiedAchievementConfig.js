/**
 * ═══════════════════════════════════════════════════════════════════
 * UNIFIED ACHIEVEMENT CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════
 * 
 * This file consolidates all achievement-related configurations into
 * a single, maintainable source of truth. It combines:
 * - Achievement definitions with milestone-based rewards
 * - Tier system for visual display
 * - Category organization
 * - Badge rewards at specific milestones
 * 
 * All services should import from this file instead of the legacy
 * achievementConfig.js or questConfig.js ACHIEVEMENTS.
 */

// BADGE TIER DEFINITIONS
const BADGE_TIERS = {
    C: { name: 'Common', color: 0x808080, emoji: '🥉', priority: 5 },
    R: { name: 'Rare', color: 0x0099FF, emoji: '🥈', priority: 4 },
    E: { name: 'Epic', color: 0x9933FF, emoji: '🥇', priority: 3 },
    L: { name: 'Legendary', color: 0xFFAA00, emoji: '💎', priority: 2 },
    M: { name: 'Mythical', color: 0xFF0000, emoji: '🌟', priority: 1 },
    T: { name: 'Transcendent', color: 0xFFFF66, emoji: '✨', priority: 0 },
    '?': { name: 'Unknown', color: 0xFF00FF, emoji: '❓', priority: -1 }
};

// ACHIEVEMENT DISPLAY TIERS (for UI grouping)
const ACHIEVEMENT_TIERS = {
    bronze: {
        name: 'Bronze',
        color: 0xCD7F32,
        icon: '🥉',
        multiplier: 1.0,
        description: 'Entry-level achievements'
    },
    silver: {
        name: 'Silver',
        color: 0xC0C0C0,
        icon: '🥈',
        multiplier: 1.5,
        description: 'Intermediate achievements'
    },
    gold: {
        name: 'Gold',
        color: 0xFFD700,
        icon: '🥇',
        multiplier: 2.0,
        description: 'Advanced achievements'
    },
    platinum: {
        name: 'Platinum',
        color: 0xE5E4E2,
        icon: '💎',
        multiplier: 3.0,
        description: 'Elite achievements'
    },
    transcendent: {
        name: 'Transcendent',
        color: 0xFFFF66,
        icon: '✨',
        multiplier: 5.0,
        description: 'Ultimate achievements'
    }
};

// ACHIEVEMENT CATEGORIES
const ACHIEVEMENT_CATEGORIES = {
    gacha: {
        name: 'Gacha',
        icon: '🎲',
        color: '#FF6B6B',
        description: 'Rolling and pulling achievements'
    },
    prayer: {
        name: 'Prayer',
        icon: '🙏',
        color: '#4ECDC4',
        description: 'Prayer and blessing achievements'
    },
    collection: {
        name: 'Collection',
        icon: '✨',
        color: '#DDA0DD',
        description: 'Collection and library achievements'
    },
    economy: {
        name: 'Economy',
        icon: '💰',
        color: '#FFD93D',
        description: 'Wealth and currency achievements'
    },
    crafting: {
        name: 'Crafting',
        icon: '🛠️',
        color: '#A8E6CF',
        description: 'Item creation achievements'
    },
    pets: {
        name: 'Pets',
        icon: '🐾',
        color: '#FF9FF3',
        description: 'Pet raising achievements'
    },
    buildings: {
        name: 'Buildings',
        icon: '🏗️',
        color: '#54A0FF',
        description: 'Building upgrade achievements'
    },
    gamble: {
        name: 'Gambling',
        icon: '🎰',
        color: '#6C5CE7',
        description: 'Gambling achievements'
    },
    trading: {
        name: 'Trading',
        icon: '🤝',
        color: '#20BF6B',
        description: 'Trade and market achievements'
    },
    quests: {
        name: 'Quests',
        icon: '📜',
        color: '#4B7BEC',
        description: 'Quest completion achievements'
    },
    dedication: {
        name: 'Dedication',
        icon: '🔥',
        color: '#FF6348',
        description: 'Streak and consistency achievements'
    },
    progression: {
        name: 'Progression',
        icon: '📈',
        color: '#00D2D3',
        description: 'Level and rebirth achievements'
    },
    challenge: {
        name: 'Challenge',
        icon: '⚡',
        color: '#E74C3C',
        description: 'Difficult challenge achievements'
    },
    social: {
        name: 'Social',
        icon: '👥',
        color: '#EB3B5A',
        description: 'Social interaction achievements'
    },
    hidden: {
        name: 'Hidden',
        icon: '🔒',
        color: '#2C3E50',
        description: 'Secret achievements'
    }
};

// UNIFIED ACHIEVEMENTS
// Combines milestone rewards with display metadata
const ACHIEVEMENTS = [
    // GACHA ACHIEVEMENTS
    {
        id: 'total_rolls',
        name: 'Roll Master',
        displayName: '🎲 Roll Mastery',
        description: 'Master the art of rolling',
        category: 'gacha',
        tier: 'bronze',
        icon: '🎲',
        points: 10,
        hidden: false,
        trackingField: 'totalRolls', // Field in userCoins table
        milestones: [
            { count: 100, reward: { coins: 5000, gems: 500, tickets: 2 } },
            { count: 500, reward: { coins: 8000, gems: 800, tickets: 3 } },
            { count: 1000, reward: { coins: 10000, gems: 1000, tickets: 5 } },
            { count: 5000, reward: { coins: 25000, gems: 2500, tickets: 10 } },
            { count: 10000, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 50000, reward: { coins: 200000, gems: 20000, tickets: 50 } },
            { count: 100000, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['RollBadge(L)'] } },
            { count: 500000, reward: { coins: 2000000, gems: 200000, tickets: 300, items: ['RollBadge(M)'] } },
            { count: 1000000, reward: { coins: 5000000, gems: 500000, tickets: 500, items: ['RollBadge(T)'] } }
        ],
        infiniteScaling: true, // Allows generating milestones beyond the base
        scalingConfig: {
            baseFactor: 2,      // Each new milestone is 2x the previous
            rewardFactor: 1.5,  // Rewards scale by 1.5x
            badgeInterval: 3    // Award badge every 3 milestones
        }
    },
    {
        id: 'total_shinies',
        name: 'Shiny Hunter',
        displayName: '✨ Shiny Collector',
        description: 'Collect shiny fumos',
        category: 'collection',
        tier: 'silver',
        icon: '✨',
        points: 25,
        hidden: false,
        trackingField: null, // Custom tracking
        milestones: [
            { count: 10, reward: { coins: 10000, gems: 1000, tickets: 5 } },
            { count: 25, reward: { coins: 20000, gems: 2000, tickets: 8 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 80000, gems: 8000, tickets: 25 } },
            { count: 250, reward: { coins: 200000, gems: 20000, tickets: 50 } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['ShinyBadge(L)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'astral_plus_collector',
        name: 'Astral Seeker',
        displayName: '🌟 Astral Hunter',
        description: 'Collect ASTRAL+ rarity fumos',
        category: 'collection',
        tier: 'gold',
        icon: '🌟',
        points: 50,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 25000, gems: 2500, tickets: 10 } },
            { count: 5, reward: { coins: 75000, gems: 7500, tickets: 25 } },
            { count: 10, reward: { coins: 150000, gems: 15000, tickets: 50, items: ['AstralBadge(E)'] } },
            { count: 25, reward: { coins: 400000, gems: 40000, tickets: 100, items: ['AstralBadge(L)'] } },
            { count: 50, reward: { coins: 1000000, gems: 100000, tickets: 200, items: ['AstralBadge(M)'] } }
        ],
        infiniteScaling: true
    },

    // PRAYER ACHIEVEMENTS
    {
        id: 'total_prays',
        name: 'Devout Follower',
        displayName: '🙏 Prayer Mastery',
        description: 'Successful prayers completed',
        category: 'prayer',
        tier: 'bronze',
        icon: '🙏',
        points: 10,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 5000, gems: 500, tickets: 3 } },
            { count: 50, reward: { coins: 25000, gems: 2500, tickets: 10 } },
            { count: 100, reward: { coins: 75000, gems: 7500, tickets: 25 } },
            { count: 250, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['PrayerBadge(E)'] } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['PrayerBadge(L)'] } },
            { count: 1000, reward: { coins: 1000000, gems: 100000, tickets: 200, items: ['PrayerBadge(M)'] } }
        ],
        infiniteScaling: true
    },

    // ECONOMY ACHIEVEMENTS
    {
        id: 'lifetime_coins',
        name: 'Wealth Accumulator',
        displayName: '💰 Coin Billionaire',
        description: 'Total coins earned lifetime',
        category: 'economy',
        tier: 'gold',
        icon: '💰',
        points: 75,
        hidden: false,
        trackingField: 'yukariCoins', // Tracks lifetime coins
        milestones: [
            { count: 1000000, reward: { gems: 1000, tickets: 3 } },
            { count: 10000000, reward: { gems: 5000, tickets: 10 } },
            { count: 100000000, reward: { gems: 25000, tickets: 30 } },
            { count: 1000000000, reward: { gems: 100000, tickets: 75, items: ['WealthBadge(E)'] } },
            { count: 10000000000, reward: { gems: 500000, tickets: 150, items: ['WealthBadge(L)'] } },
            { count: 100000000000, reward: { gems: 2000000, tickets: 500, items: ['WealthBadge(M)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'lifetime_gems',
        name: 'Gem Master',
        displayName: '💎 Gem Master',
        description: 'Total gems earned lifetime',
        category: 'economy',
        tier: 'gold',
        icon: '💎',
        points: 75,
        hidden: false,
        trackingField: 'yukariGems',
        milestones: [
            { count: 100000, reward: { coins: 50000, tickets: 5 } },
            { count: 1000000, reward: { coins: 250000, tickets: 15 } },
            { count: 10000000, reward: { coins: 1000000, tickets: 50, items: ['GemBadge(E)'] } },
            { count: 100000000, reward: { coins: 5000000, tickets: 150, items: ['GemBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // CRAFTING ACHIEVEMENTS
    {
        id: 'total_crafts',
        name: 'Master Crafter',
        displayName: '⚒️ Crafter Expert',
        description: 'Total items crafted',
        category: 'crafting',
        tier: 'silver',
        icon: '🛠️',
        points: 30,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 15000, gems: 1500, tickets: 5 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 30 } },
            { count: 250, reward: { coins: 250000, gems: 25000, tickets: 60, items: ['CraftBadge(E)'] } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['CraftBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // PET ACHIEVEMENTS
    {
        id: 'total_pet_hatches',
        name: 'Pet Breeder',
        displayName: '🐾 Pet Master',
        description: 'Total eggs hatched',
        category: 'pets',
        tier: 'silver',
        icon: '🥚',
        points: 40,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 5, reward: { coins: 20000, gems: 2000, tickets: 5 } },
            { count: 25, reward: { coins: 75000, gems: 7500, tickets: 20 } },
            { count: 50, reward: { coins: 150000, gems: 15000, tickets: 40, items: ['PetBadge(E)'] } },
            { count: 100, reward: { coins: 300000, gems: 30000, tickets: 75, items: ['PetBadge(L)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'pet_collection',
        name: 'Pet Collector',
        displayName: '🐾 Pet Collector',
        description: 'Total unique pets owned',
        category: 'pets',
        tier: 'silver',
        icon: '🐾',
        points: 40,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 30000, gems: 3000, tickets: 8 } },
            { count: 25, reward: { coins: 80000, gems: 8000, tickets: 20 } },
            { count: 50, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['PetCollectorBadge(E)'] } }
        ],
        infiniteScaling: false
    },

    // BUILDING ACHIEVEMENTS
    {
        id: 'total_building_upgrades',
        name: 'Architect',
        displayName: '🏗️ Architect',
        description: 'Total building upgrades',
        category: 'buildings',
        tier: 'silver',
        icon: '🏗️',
        points: 30,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 25, reward: { coins: 30000, gems: 3000, tickets: 8 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 25 } },
            { count: 200, reward: { coins: 250000, gems: 25000, tickets: 50, items: ['BuilderBadge(E)'] } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['BuilderBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // GAMBLING ACHIEVEMENTS
    {
        id: 'total_gambles',
        name: 'Lucky Gambler',
        displayName: '🎰 Gambler Elite',
        description: 'Total gambles made',
        category: 'gamble',
        tier: 'silver',
        icon: '🎰',
        points: 35,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 50, reward: { coins: 25000, gems: 2500, tickets: 8 } },
            { count: 200, reward: { coins: 75000, gems: 7500, tickets: 20 } },
            { count: 500, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['GambleBadge(E)'] } },
            { count: 1000, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['GambleBadge(L)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'gamble_wins',
        name: 'Winner',
        displayName: '🏆 Winning Streak',
        description: 'Total gambling wins',
        category: 'gamble',
        tier: 'gold',
        icon: '🏆',
        points: 50,
        hidden: false,
        trackingField: 'wins',
        milestones: [
            { count: 100, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 500, reward: { coins: 200000, gems: 20000, tickets: 50 } },
            { count: 1000, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['WinnerBadge(E)'] } }
        ],
        infiniteScaling: true
    },

    // TRADING ACHIEVEMENTS
    {
        id: 'total_trades',
        name: 'Trader',
        displayName: '💱 Trader Expert',
        description: 'Total trades completed',
        category: 'trading',
        tier: 'silver',
        icon: '🤝',
        points: 30,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 15000, gems: 1500, tickets: 5 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 30, items: ['TradeBadge(E)'] } },
            { count: 250, reward: { coins: 250000, gems: 25000, tickets: 60, items: ['TradeBadge(L)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'market_sales',
        name: 'Market Mogul',
        displayName: '🏪 Market Mogul',
        description: 'Items sold on market',
        category: 'trading',
        tier: 'gold',
        icon: '🏪',
        points: 50,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 50, reward: { coins: 30000, gems: 3000, tickets: 10 } },
            { count: 200, reward: { coins: 100000, gems: 10000, tickets: 30 } },
            { count: 500, reward: { coins: 300000, gems: 30000, tickets: 75, items: ['MarketBadge(E)'] } },
            { count: 1000, reward: { coins: 750000, gems: 75000, tickets: 150, items: ['MarketBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // QUEST ACHIEVEMENTS
    {
        id: 'daily_warrior',
        name: 'Daily Warrior',
        displayName: '🔥 Daily Warrior',
        description: 'Complete daily quests',
        category: 'quests',
        tier: 'silver',
        icon: '🔥',
        points: 30,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 15000, gems: 1500, tickets: 5 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 150000, gems: 15000, tickets: 40, items: ['DailyBadge(E)'] } },
            { count: 365, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['DailyBadge(L)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'weekly_champion',
        name: 'Weekly Champion',
        displayName: '📅 Weekly Champion',
        description: 'Complete weekly quests',
        category: 'quests',
        tier: 'silver',
        icon: '📅',
        points: 40,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 5, reward: { coins: 20000, gems: 2000, tickets: 8 } },
            { count: 20, reward: { coins: 80000, gems: 8000, tickets: 25 } },
            { count: 52, reward: { coins: 300000, gems: 30000, tickets: 75, items: ['WeeklyBadge(E)'] } }
        ],
        infiniteScaling: true
    },

    // DEDICATION ACHIEVEMENTS
    {
        id: 'streak_master',
        name: 'Streak Master',
        displayName: '⚡ Streak Master',
        description: 'Maintain daily streak',
        category: 'dedication',
        tier: 'gold',
        icon: '⚡',
        points: 60,
        hidden: false,
        trackingField: 'dailyStreak',
        milestones: [
            { count: 7, reward: { coins: 10000, gems: 1000, tickets: 5 } },
            { count: 14, reward: { coins: 30000, gems: 3000, tickets: 10 } },
            { count: 30, reward: { coins: 100000, gems: 10000, tickets: 30, items: ['StreakBadge(E)'] } },
            { count: 60, reward: { coins: 250000, gems: 25000, tickets: 60, items: ['StreakBadge(L)'] } },
            { count: 100, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['StreakBadge(M)'] } },
            { count: 365, reward: { coins: 2000000, gems: 200000, tickets: 500, items: ['StreakBadge(T)'] } }
        ],
        infiniteScaling: false // Streak has natural limits
    },

    // PROGRESSION ACHIEVEMENTS
    {
        id: 'rebirth_legend',
        name: 'Rebirth Legend',
        displayName: '🔄 Rebirth Legend',
        description: 'Complete rebirths',
        category: 'progression',
        tier: 'platinum',
        icon: '🔄',
        points: 100,
        hidden: false,
        trackingField: 'rebirth',
        milestones: [
            { count: 1, reward: { coins: 100000, gems: 10000, tickets: 25 } },
            { count: 3, reward: { coins: 300000, gems: 30000, tickets: 75, items: ['RebirthBadge(E)'] } },
            { count: 5, reward: { coins: 500000, gems: 50000, tickets: 125, items: ['RebirthBadge(L)'] } },
            { count: 10, reward: { coins: 1000000, gems: 100000, tickets: 250, items: ['RebirthBadge(M)'] } }
        ],
        infiniteScaling: true
    },
    {
        id: 'level_master',
        name: 'Level Master',
        displayName: '📈 Level Master',
        description: 'Reach high levels',
        category: 'progression',
        tier: 'gold',
        icon: '📈',
        points: 50,
        hidden: false,
        trackingField: 'level',
        milestones: [
            { count: 25, reward: { coins: 25000, gems: 2500, tickets: 10 } },
            { count: 50, reward: { coins: 75000, gems: 7500, tickets: 25 } },
            { count: 100, reward: { coins: 200000, gems: 20000, tickets: 60, items: ['LevelBadge(E)'] } },
            { count: 200, reward: { coins: 500000, gems: 50000, tickets: 125, items: ['LevelBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // COLLECTION ACHIEVEMENTS
    {
        id: 'transcendent_owner',
        name: 'Transcendent Owner',
        displayName: '🌈 Transcendent Owner',
        description: 'Own TRANSCENDENT rarity fumos',
        category: 'collection',
        tier: 'platinum',
        icon: '🌈',
        points: 100,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['TranscendentBadge(L)'] } },
            { count: 5, reward: { coins: 2000000, gems: 200000, tickets: 300, items: ['TranscendentBadge(M)'] } },
            { count: 10, reward: { coins: 5000000, gems: 500000, tickets: 500, items: ['TranscendentBadge(T)'] } }
        ],
        infiniteScaling: false
    },
    {
        id: 'library_complete',
        name: 'Library Complete',
        displayName: '📚 Library Complete',
        description: 'Collect all fumos in the library',
        category: 'collection',
        tier: 'transcendent',
        icon: '📚',
        points: 150,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 10000000, gems: 1000000, tickets: 1000, items: ['LibraryBadge(T)', 'GoldenSigil(?)'] } }
        ],
        infiniteScaling: false
    },
    {
        id: 'total_limit_breaks',
        name: 'Limit Breaker',
        displayName: '💥 Limit Breaker',
        description: 'Perform limit breaks',
        category: 'collection',
        tier: 'gold',
        icon: '💥',
        points: 50,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 10, reward: { coins: 25000, gems: 2500, tickets: 8 } },
            { count: 50, reward: { coins: 100000, gems: 10000, tickets: 25 } },
            { count: 100, reward: { coins: 250000, gems: 25000, tickets: 50, items: ['LimitBadge(E)'] } },
            { count: 250, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['LimitBadge(L)'] } }
        ],
        infiniteScaling: true
    },

    // CHALLENGE ACHIEVEMENTS
    {
        id: 'speed_roller',
        name: 'Speed Roller',
        displayName: '⏱️ Speed Roller',
        description: 'Roll 1000 times in 1 hour',
        category: 'challenge',
        tier: 'gold',
        icon: '⏱️',
        points: 80,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['SpeedBadge(E)'] } },
            { count: 5, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['SpeedBadge(L)'] } }
        ],
        infiniteScaling: false
    },
    {
        id: 'lucky_charm',
        name: 'Lucky Charm',
        displayName: '🍀 Lucky Charm',
        description: 'Get 3 ASTRAL+ in a row',
        category: 'challenge',
        tier: 'platinum',
        icon: '🍀',
        points: 120,
        hidden: false,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['LuckyBadge(L)'] } },
            { count: 3, reward: { coins: 1000000, gems: 100000, tickets: 200, items: ['LuckyBadge(M)'] } }
        ],
        infiniteScaling: false
    },

    // HIDDEN ACHIEVEMENTS
    {
        id: 'secret_finder',
        name: 'Secret Finder',
        displayName: '🔍 Secret Finder',
        description: '???',
        category: 'hidden',
        tier: 'platinum',
        icon: '🔍',
        points: 200,
        hidden: true,
        trackingField: null,
        milestones: [
            { count: 1, reward: { coins: 1000000, gems: 100000, tickets: 250, items: ['SecretBadge(?)'] } }
        ],
        infiniteScaling: false
    }
];

// HELPER FUNCTIONS

/**
 * Get achievement by ID
 */
function getAchievementById(achievementId) {
    return ACHIEVEMENTS.find(a => a.id === achievementId) || null;
}

/**
 * Get achievements by category
 */
function getAchievementsByCategory(category) {
    return ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Get achievements by tier
 */
function getAchievementsByTier(tier) {
    return ACHIEVEMENTS.filter(a => a.tier === tier);
}

/**
 * Get visible (non-hidden) achievements
 */
function getVisibleAchievements() {
    return ACHIEVEMENTS.filter(a => !a.hidden);
}

/**
 * Get hidden achievements
 */
function getHiddenAchievements() {
    return ACHIEVEMENTS.filter(a => a.hidden);
}

/**
 * Get tier info
 */
function getTierInfo(tier) {
    return ACHIEVEMENT_TIERS[tier] || null;
}

/**
 * Get category info
 */
function getCategoryInfo(category) {
    return ACHIEVEMENT_CATEGORIES[category] || null;
}

/**
 * Get badge tier info
 */
function getBadgeTierInfo(tierCode) {
    return BADGE_TIERS[tierCode] || BADGE_TIERS['?'];
}

/**
 * Generate scaled milestones for infinite achievements
 */
function getScaledMilestones(achievement, claimedCount) {
    if (!achievement.infiniteScaling) {
        return achievement.milestones;
    }
    
    const baseMilestones = achievement.milestones;
    
    // If haven't claimed all base milestones, return base
    if (claimedCount < baseMilestones.length) {
        return baseMilestones;
    }
    
    // Generate additional milestones
    const result = [...baseMilestones];
    const lastBase = baseMilestones[baseMilestones.length - 1];
    const config = achievement.scalingConfig || { baseFactor: 2, rewardFactor: 1.5, badgeInterval: 3 };
    const scalingLevels = claimedCount - baseMilestones.length + 3;
    
    for (let i = 0; i < scalingLevels; i++) {
        const tier = baseMilestones.length + i;
        const scaleFactor = Math.pow(config.baseFactor, i + 1);
        const rewardScale = Math.pow(config.rewardFactor, i + 1);
        
        const newCount = Math.floor(lastBase.count * scaleFactor);
        const newReward = {
            coins: Math.floor((lastBase.reward.coins || 0) * rewardScale),
            gems: Math.floor((lastBase.reward.gems || 0) * rewardScale),
            tickets: Math.floor((lastBase.reward.tickets || 0) * rewardScale)
        };
        
        // Award badge at intervals
        if ((tier + 1) % config.badgeInterval === 0) {
            const badgeTier = getBadgeTierForMilestone(tier);
            const badgeName = achievement.name.replace(/\s+/g, '') + `Badge(${badgeTier})`;
            newReward.items = [badgeName];
        }
        
        result.push({ count: newCount, reward: newReward });
    }
    
    return result;
}

/**
 * Get badge tier code based on milestone tier
 */
function getBadgeTierForMilestone(tier) {
    if (tier >= 15) return '?';
    if (tier >= 12) return 'T';
    if (tier >= 9) return 'M';
    if (tier >= 6) return 'L';
    return 'E';
}

/**
 * Calculate total achievement points for a user
 */
function calculateAchievementPoints(completedAchievements) {
    let total = 0;
    for (const achId of completedAchievements) {
        const achievement = getAchievementById(achId);
        if (achievement) {
            total += achievement.points;
        }
    }
    return total;
}

/**
 * Get all categories with counts
 */
function getCategoriesWithCounts() {
    const counts = {};
    for (const category of Object.keys(ACHIEVEMENT_CATEGORIES)) {
        counts[category] = getAchievementsByCategory(category).length;
    }
    return counts;
}

// EXPORTS
module.exports = {
    // Data
    ACHIEVEMENTS,
    ACHIEVEMENT_TIERS,
    ACHIEVEMENT_CATEGORIES,
    BADGE_TIERS,
    
    // Getters
    getAchievementById,
    getAchievementsByCategory,
    getAchievementsByTier,
    getVisibleAchievements,
    getHiddenAchievements,
    getTierInfo,
    getCategoryInfo,
    getBadgeTierInfo,
    
    // Utilities
    getScaledMilestones,
    getBadgeTierForMilestone,
    calculateAchievementPoints,
    getCategoriesWithCounts
};
