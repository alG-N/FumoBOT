/**
 * ═══════════════════════════════════════════════════════════════════
 * FUMOBOT QUEST SYSTEM v2.0 - Complete Rework
 * ═══════════════════════════════════════════════════════════════════
 * 
 * New Features:
 * - Daily quests with varied difficulty tiers
 * - Weekly challenges with bonus rewards
 * - Seasonal/Event quests
 * - Quest chains with progression rewards
 * - Pet, Building, Market, and Weather-related quests
 * - Milestone achievements with tiered rewards
 * - Bonus objectives for extra rewards
 */

// ═══════════════════════════════════════════════════════════════════
// DAILY QUESTS - Reset at 00:00 UTC
// IDs must match what's tracked in questMiddleware.js
// ═══════════════════════════════════════════════════════════════════
const DAILY_QUESTS = [
    // ─── Gacha Quests ───
    { 
        id: 'daily_rolls', 
        desc: 'Roll 100 times', 
        goal: 100,
        category: 'gacha',
        difficulty: 'easy',
        icon: '🎲',
        reward: { coins: 5000, gems: 500, tickets: 2 }
    },
    
    // ─── Prayer Quests ───
    { 
        id: 'daily_prayers', 
        desc: 'Successfully pray 5 times', 
        goal: 5,
        category: 'prayer',
        difficulty: 'medium',
        icon: '🙏',
        reward: { coins: 10000, gems: 1000, tickets: 3 }
    },
    
    // ─── Economy Quests ───
    { 
        id: 'daily_coins_earn', 
        desc: 'Earn 100K coins', 
        goal: 100000,
        category: 'economy',
        difficulty: 'easy',
        icon: '💰',
        reward: { coins: 5000, gems: 500, tickets: 1 }
    },
    { 
        id: 'daily_coins_spend', 
        desc: 'Spend 50K coins', 
        goal: 50000,
        category: 'economy',
        difficulty: 'easy',
        icon: '💸',
        reward: { coins: 3000, gems: 300, tickets: 1 }
    },
    
    // ─── Crafting Quests ───
    { 
        id: 'daily_crafts', 
        desc: 'Craft 3 items', 
        goal: 3,
        category: 'crafting',
        difficulty: 'medium',
        icon: '🛠️',
        reward: { coins: 8000, gems: 800, tickets: 2 }
    },
    
    // ─── Gambling Quests ───
    { 
        id: 'daily_gambles', 
        desc: 'Use gamble commands 10 times', 
        goal: 10,
        category: 'gamble',
        difficulty: 'easy',
        icon: '🎰',
        reward: { coins: 5000, gems: 500, tickets: 1 }
    },
    { 
        id: 'daily_gamble_wins', 
        desc: 'Win 3 gambles', 
        goal: 3,
        category: 'gamble',
        difficulty: 'medium',
        icon: '🏆',
        reward: { coins: 10000, gems: 1000, tickets: 2 }
    },
    
    // ─── Pet Quests ───
    { 
        id: 'daily_pet_feeds', 
        desc: 'Feed your pet 5 times', 
        goal: 5,
        category: 'pets',
        difficulty: 'easy',
        icon: '🐾',
        reward: { coins: 3000, gems: 300, tickets: 1 }
    },
    
    // ─── Collection Quests ───
    { 
        id: 'daily_shinies', 
        desc: 'Obtain a shiny fumo', 
        goal: 1,
        category: 'collection',
        difficulty: 'medium',
        icon: '✨',
        reward: { coins: 15000, gems: 1500, tickets: 3 }
    },
    
    // ─── Trading Quests ───
    { 
        id: 'daily_trades', 
        desc: 'Complete 2 trades', 
        goal: 2,
        category: 'trading',
        difficulty: 'easy',
        icon: '🤝',
        reward: { coins: 5000, gems: 500, tickets: 1 }
    },
    
    // ─── Market Quests ───
    { 
        id: 'daily_market_sales', 
        desc: 'Sell an item on the market', 
        goal: 1,
        category: 'market',
        difficulty: 'easy',
        icon: '🏪',
        reward: { coins: 5000, gems: 500, tickets: 1 }
    },
    
    // ─── Gift Quests ───
    { 
        id: 'daily_gifts', 
        desc: 'Send a gift to someone', 
        goal: 1,
        category: 'social',
        difficulty: 'easy',
        icon: '🎁',
        reward: { coins: 3000, gems: 300, tickets: 1 }
    },
    
    // ─── Daily Claim ───
    { 
        id: 'daily_claim', 
        desc: 'Claim your daily reward', 
        goal: 1,
        category: 'general',
        difficulty: 'easy',
        icon: '📅',
        reward: { coins: 2000, gems: 200, tickets: 1 }
    }
];

// ═══════════════════════════════════════════════════════════════════
// WEEKLY QUESTS - Reset every Monday 00:00 UTC
// IDs must match what's tracked in questMiddleware.js
// ═══════════════════════════════════════════════════════════════════
const WEEKLY_QUESTS = [
    // ─── Gacha Challenges ───
    { 
        id: 'weekly_rolls', 
        desc: 'Roll 1,000 times', 
        goal: 1000,
        category: 'gacha',
        difficulty: 'easy',
        icon: '🎲',
        reward: { coins: 50000, gems: 5000, tickets: 10 }
    },
    
    // ─── Prayer Mastery ───
    { 
        id: 'weekly_prayers', 
        desc: 'Successfully pray 35 times', 
        goal: 35,
        category: 'prayer',
        difficulty: 'medium',
        icon: '🙏',
        reward: { coins: 75000, gems: 7500, tickets: 20 }
    },
    
    // ─── Collection Goals ───
    { 
        id: 'weekly_shinies', 
        desc: 'Obtain 10 shiny fumos', 
        goal: 10,
        category: 'collection',
        difficulty: 'medium',
        icon: '✨',
        reward: { coins: 100000, gems: 10000, tickets: 25 }
    },
    { 
        id: 'weekly_astral_plus', 
        desc: 'Get an ASTRAL+ rarity fumo', 
        goal: 1,
        category: 'collection',
        difficulty: 'legendary',
        icon: '🌌',
        reward: { coins: 500000, gems: 50000, tickets: 100 }
    },
    
    // ─── Crafting Goals ───
    { 
        id: 'weekly_crafts', 
        desc: 'Craft 15 items', 
        goal: 15,
        category: 'crafting',
        difficulty: 'medium',
        icon: '🔧',
        reward: { coins: 50000, gems: 5000, tickets: 15 }
    },
    
    // ─── Gambling Goals ───
    { 
        id: 'weekly_gambles', 
        desc: 'Use gamble commands 50 times', 
        goal: 50,
        category: 'gamble',
        difficulty: 'easy',
        icon: '🎰',
        reward: { coins: 40000, gems: 4000, tickets: 10 }
    },
    { 
        id: 'weekly_gamble_profit', 
        desc: 'Win 500K total from gambling', 
        goal: 500000,
        category: 'gamble',
        difficulty: 'hard',
        icon: '💵',
        reward: { coins: 100000, gems: 10000, tickets: 25 }
    },
    
    // ─── Economy Goals ───
    { 
        id: 'weekly_coins_earn', 
        desc: 'Earn 1M coins total', 
        goal: 1000000,
        category: 'economy',
        difficulty: 'medium',
        icon: '💰',
        reward: { coins: 100000, gems: 10000, tickets: 20 }
    },
    { 
        id: 'weekly_coins_spend', 
        desc: 'Spend 500K coins total', 
        goal: 500000,
        category: 'economy',
        difficulty: 'medium',
        icon: '💸',
        reward: { coins: 50000, gems: 5000, tickets: 10 }
    },
    
    // ─── Pet Goals ───
    { 
        id: 'weekly_pet_hatches', 
        desc: 'Hatch 3 pet eggs', 
        goal: 3,
        category: 'pets',
        difficulty: 'hard',
        icon: '🥚',
        reward: { coins: 75000, gems: 7500, tickets: 20 }
    },
    
    // ─── Building Goals ───
    { 
        id: 'weekly_building_upgrades', 
        desc: 'Upgrade buildings 5 times', 
        goal: 5,
        category: 'buildings',
        difficulty: 'medium',
        icon: '🏗️',
        reward: { coins: 80000, gems: 8000, tickets: 20 }
    },
    
    // ─── Trading Goals ───
    { 
        id: 'weekly_trades', 
        desc: 'Complete 10 trades', 
        goal: 10,
        category: 'trading',
        difficulty: 'medium',
        icon: '🤝',
        reward: { coins: 60000, gems: 6000, tickets: 15 }
    },
    
    // ─── Market Goals ───
    { 
        id: 'weekly_market_sales', 
        desc: 'Sell 5 items on the market', 
        goal: 5,
        category: 'market',
        difficulty: 'easy',
        icon: '🏪',
        reward: { coins: 40000, gems: 4000, tickets: 10 }
    },
    
    // ─── Mystery Crate Goals ───
    { 
        id: 'weekly_crates', 
        desc: 'Open 5 mystery crates', 
        goal: 5,
        category: 'crates',
        difficulty: 'medium',
        icon: '📦',
        reward: { coins: 60000, gems: 6000, tickets: 15 }
    },
    
    // ─── Gift Goals ───
    { 
        id: 'weekly_gifts', 
        desc: 'Send 7 gifts', 
        goal: 7,
        category: 'social',
        difficulty: 'easy',
        icon: '🎁',
        reward: { coins: 30000, gems: 3000, tickets: 8 }
    }
];

// ═══════════════════════════════════════════════════════════════════
// ACHIEVEMENTS - Permanent milestones with tiered rewards
// IDs must match what's tracked in questMiddleware.js
// ═══════════════════════════════════════════════════════════════════
const ACHIEVEMENTS = [
    // ─── Roll Milestones ───
    {
        id: 'total_rolls',
        name: 'Roll Master',
        description: 'Total rolls made',
        category: 'gacha',
        icon: '🎲',
        milestones: [
            { count: 1000, reward: { coins: 10000, gems: 1000, tickets: 5 } },
            { count: 10000, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 50000, reward: { coins: 200000, gems: 20000, tickets: 50 } },
            { count: 100000, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['RollBadge(L)'] } },
            { count: 500000, reward: { coins: 2000000, gems: 200000, tickets: 300, items: ['RollBadge(M)'] } },
            { count: 1000000, reward: { coins: 5000000, gems: 500000, tickets: 500, items: ['RollBadge(T)'] } }
        ]
    },
    
    // ─── Prayer Milestones ───
    {
        id: 'total_prays',
        name: 'Devout Follower',
        description: 'Successful prayers',
        category: 'prayer',
        icon: '🙏',
        milestones: [
            { count: 10, reward: { coins: 5000, gems: 500, tickets: 3 } },
            { count: 50, reward: { coins: 25000, gems: 2500, tickets: 10 } },
            { count: 100, reward: { coins: 75000, gems: 7500, tickets: 25 } },
            { count: 250, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['PrayerBadge(E)'] } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['PrayerBadge(L)'] } }
        ]
    },
    
    // ─── Collection Milestones ───
    {
        id: 'total_shinies',
        name: 'Shiny Hunter',
        description: 'Shiny fumos collected',
        category: 'collection',
        icon: '✨',
        milestones: [
            { count: 25, reward: { coins: 20000, gems: 2000, tickets: 8 } },
            { count: 100, reward: { coins: 80000, gems: 8000, tickets: 25 } },
            { count: 250, reward: { coins: 200000, gems: 20000, tickets: 50 } },
            { count: 500, reward: { coins: 500000, gems: 50000, tickets: 100, items: ['ShinyBadge(L)'] } }
        ]
    },
    
    // ─── Wealth Milestones ───
    {
        id: 'lifetime_coins',
        name: 'Wealth Accumulator',
        description: 'Total coins earned',
        category: 'economy',
        icon: '💰',
        milestones: [
            { count: 10000000, reward: { gems: 5000, tickets: 10 } },
            { count: 100000000, reward: { gems: 25000, tickets: 30 } },
            { count: 1000000000, reward: { gems: 100000, tickets: 75, items: ['WealthBadge(E)'] } },
            { count: 10000000000, reward: { gems: 500000, tickets: 150, items: ['WealthBadge(L)'] } }
        ]
    },
    
    // ─── Crafting Milestones ───
    {
        id: 'total_crafts',
        name: 'Master Crafter',
        description: 'Items crafted',
        category: 'crafting',
        icon: '🛠️',
        milestones: [
            { count: 10, reward: { coins: 15000, gems: 1500, tickets: 5 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 30 } },
            { count: 250, reward: { coins: 250000, gems: 25000, tickets: 60, items: ['CraftBadge(E)'] } }
        ]
    },
    
    // ─── Pet Milestones ───
    {
        id: 'total_pet_hatches',
        name: 'Pet Breeder',
        description: 'Eggs hatched',
        category: 'pets',
        icon: '🥚',
        milestones: [
            { count: 5, reward: { coins: 20000, gems: 2000, tickets: 5 } },
            { count: 25, reward: { coins: 75000, gems: 7500, tickets: 20 } },
            { count: 50, reward: { coins: 150000, gems: 15000, tickets: 40, items: ['PetBadge(E)'] } },
            { count: 100, reward: { coins: 300000, gems: 30000, tickets: 75, items: ['PetBadge(L)'] } }
        ]
    },
    
    // ─── Building Milestones ───
    {
        id: 'total_building_upgrades',
        name: 'Architect',
        description: 'Total building upgrades',
        category: 'buildings',
        icon: '🏗️',
        milestones: [
            { count: 25, reward: { coins: 30000, gems: 3000, tickets: 8 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 25 } },
            { count: 200, reward: { coins: 250000, gems: 25000, tickets: 50, items: ['BuilderBadge(E)'] } }
        ]
    },
    
    // ─── Gambling Milestones ───
    {
        id: 'total_gambles',
        name: 'Lucky Gambler',
        description: 'Total gambles',
        category: 'gamble',
        icon: '🎰',
        milestones: [
            { count: 50, reward: { coins: 25000, gems: 2500, tickets: 8 } },
            { count: 200, reward: { coins: 75000, gems: 7500, tickets: 20 } },
            { count: 500, reward: { coins: 200000, gems: 20000, tickets: 50, items: ['GambleBadge(E)'] } }
        ]
    },
    
    // ─── Trading Milestones ───
    {
        id: 'total_trades',
        name: 'Trader',
        description: 'Total trades completed',
        category: 'trading',
        icon: '🤝',
        milestones: [
            { count: 10, reward: { coins: 15000, gems: 1500, tickets: 5 } },
            { count: 50, reward: { coins: 50000, gems: 5000, tickets: 15 } },
            { count: 100, reward: { coins: 100000, gems: 10000, tickets: 30, items: ['TradeBadge(E)'] } }
        ]
    }
];

// ═══════════════════════════════════════════════════════════════════
// QUEST CHAINS - Multi-quest story progressions
// ═══════════════════════════════════════════════════════════════════
const QUEST_CHAINS = [
    {
        id: 'beginner_path',
        name: 'Beginner\'s Path',
        description: 'Learn the basics of FumoBOT',
        quests: ['daily_rolls', 'daily_prayers', 'daily_crafts'],
        prerequisites: null,
        bonusRewards: {
            coins: 50000,
            gems: 5000,
            tickets: 15,
            items: ['BeginnerBadge(C)']
        },
        icon: '🌱'
    },
    {
        id: 'collector_journey',
        name: 'Collector\'s Journey',
        description: 'Start building your collection',
        quests: ['daily_shinies', 'weekly_rolls', 'weekly_shinies'],
        prerequisites: { chains: ['beginner_path'] },
        bonusRewards: {
            coins: 150000,
            gems: 15000,
            tickets: 40,
            items: ['CollectorBadge(R)']
        },
        icon: '✨'
    },
    {
        id: 'pet_master',
        name: 'Pet Master\'s Trial',
        description: 'Master the art of pet raising',
        quests: ['daily_pet_feeds', 'weekly_pet_hatches'],
        prerequisites: { level: 25 },
        bonusRewards: {
            coins: 200000,
            gems: 20000,
            tickets: 50,
            items: ['PetMasterBadge(E)']
        },
        icon: '🐾'
    },
    {
        id: 'economic_empire',
        name: 'Economic Empire',
        description: 'Build your wealth empire',
        quests: ['daily_coins_earn', 'weekly_coins_earn'],
        prerequisites: { rebirth: 1 },
        bonusRewards: {
            coins: 500000,
            gems: 50000,
            tickets: 100,
            items: ['EmpireBadge(L)']
        },
        icon: '💰'
    },
    {
        id: 'ultimate_challenge',
        name: 'Ultimate Challenge',
        description: 'The final test for true masters',
        quests: ['weekly_rolls', 'weekly_astral_plus', 'weekly_shinies'],
        prerequisites: { rebirth: 3, level: 100, chains: ['collector_journey', 'economic_empire'] },
        bonusRewards: {
            coins: 2000000,
            gems: 200000,
            tickets: 250,
            items: ['ChampionBadge(M)', 'GoldenSigil(?)']
        },
        icon: '👑'
    }
];

// ═══════════════════════════════════════════════════════════════════
// QUEST CATEGORIES
// ═══════════════════════════════════════════════════════════════════
const QUEST_CATEGORIES = {
    gacha: {
        name: 'Gacha Quests',
        icon: '🎲',
        color: '#FF6B6B',
        description: 'Roll and collect fumos'
    },
    prayer: {
        name: 'Prayer Quests',
        icon: '🙏',
        color: '#4ECDC4',
        description: 'Pray to characters for rewards'
    },
    economy: {
        name: 'Economy Quests',
        icon: '💰',
        color: '#FFD93D',
        description: 'Earn coins and gems'
    },
    gamble: {
        name: 'Gambling Quests',
        icon: '🎰',
        color: '#6C5CE7',
        description: 'Test your luck'
    },
    crafting: {
        name: 'Crafting Quests',
        icon: '🛠️',
        color: '#A8E6CF',
        description: 'Create items and equipment'
    },
    collection: {
        name: 'Collection Quests',
        icon: '✨',
        color: '#DDA0DD',
        description: 'Collect rare fumos'
    },
    pets: {
        name: 'Pet Quests',
        icon: '🐾',
        color: '#FF9FF3',
        description: 'Raise and care for pets'
    },
    buildings: {
        name: 'Building Quests',
        icon: '🏗️',
        color: '#54A0FF',
        description: 'Upgrade your buildings'
    },
    trading: {
        name: 'Trading Quests',
        icon: '🤝',
        color: '#20BF6B',
        description: 'Trade with other players'
    },
    market: {
        name: 'Market Quests',
        icon: '🏪',
        color: '#778CA3',
        description: 'Buy and sell on the market'
    },
    crates: {
        name: 'Crate Quests',
        icon: '📦',
        color: '#F7B731',
        description: 'Open mystery crates'
    },
    social: {
        name: 'Social Quests',
        icon: '🎁',
        color: '#EB3B5A',
        description: 'Interact with other players'
    },
    general: {
        name: 'General Quests',
        icon: '📅',
        color: '#4B7BEC',
        description: 'Daily tasks'
    },
    meta: {
        name: 'Meta Quests',
        icon: '🗓️',
        color: '#00D2D3',
        description: 'Complete other quests'
    },
    dedication: {
        name: 'Dedication',
        icon: '🔥',
        color: '#FF6348',
        description: 'Show your commitment'
    }
};

// ═══════════════════════════════════════════════════════════════════
// DIFFICULTY SETTINGS
// ═══════════════════════════════════════════════════════════════════
const DIFFICULTY_SETTINGS = {
    easy: {
        name: 'Easy',
        emoji: '🟢',
        multiplier: 1.0,
        color: '#2ECC71'
    },
    medium: {
        name: 'Medium',
        emoji: '🟡',
        multiplier: 1.5,
        color: '#F39C12'
    },
    hard: {
        name: 'Hard',
        emoji: '🔴',
        multiplier: 2.0,
        color: '#E74C3C'
    },
    legendary: {
        name: 'Legendary',
        emoji: '🟣',
        multiplier: 3.0,
        color: '#9B59B6'
    }
};

// ═══════════════════════════════════════════════════════════════════
// BONUS REWARDS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const BONUS_CONFIG = {
    // All dailies completed bonus
    ALL_DAILIES: {
        coins: 25000,
        gems: 2500,
        tickets: 10
    },
    // All weeklies completed bonus
    ALL_WEEKLIES: {
        coins: 250000,
        gems: 25000,
        tickets: 75,
        items: ['MysticOrb(M)']
    },
    // Streak bonuses
    STREAK_MILESTONES: {
        3: { multiplier: 1.1, bonus: { tickets: 2 } },
        7: { multiplier: 1.25, bonus: { tickets: 5 } },
        14: { multiplier: 1.5, bonus: { tickets: 10, items: ['FumoTrait(R)'] } },
        30: { multiplier: 2.0, bonus: { tickets: 25, items: ['MysticOrb(M)'] } },
        60: { multiplier: 2.5, bonus: { tickets: 50, items: ['GoldenSigil(?)'] } },
        100: { multiplier: 3.0, bonus: { tickets: 100, items: ['TranscendentEssence(?)'] } }
    }
};

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION SETTINGS
// ═══════════════════════════════════════════════════════════════════
const NOTIFICATION_SETTINGS = {
    NEAR_COMPLETION_THRESHOLD: 0.9,
    RESET_WARNING_TIME: 3600000, // 1 hour
    STREAK_MILESTONES: [3, 7, 14, 30, 60, 100],
    ENABLE_COMPLETION: true,
    ENABLE_ACHIEVEMENT: true,
    ENABLE_STREAK: true,
    ENABLE_RESET_WARNING: true,
    ENABLE_CHAIN_COMPLETION: true
};

// ═══════════════════════════════════════════════════════════════════
// REROLL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const REROLL_CONFIG = {
    DAILY_LIMIT: 3,
    GEM_COST: 500,
    COOLDOWN: 1800000 // 30 minutes
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
function getQuestByCategory(category) {
    const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    return allQuests.filter(q => q.category === category);
}

function getQuestById(questId) {
    const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    return allQuests.find(q => q.id === questId);
}

function getDailyQuestById(questId) {
    return DAILY_QUESTS.find(q => q.id === questId);
}

function getWeeklyQuestById(questId) {
    return WEEKLY_QUESTS.find(q => q.id === questId);
}

function getQuestChain(chainId) {
    return QUEST_CHAINS.find(c => c.id === chainId);
}

function getAchievement(achievementId) {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
}

function getAchievementMilestone(achievementId, progress) {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return null;
    
    return achievement.milestones.find(m => progress >= m.count);
}

function calculateScaledGoal(baseGoal, userLevel, userRebirth) {
    let multiplier = 1;
    multiplier += userRebirth * 0.25;
    multiplier += Math.floor(userLevel / 20) * 0.1;
    return Math.floor(baseGoal * multiplier);
}

function getStreakBonus(streak) {
    const milestones = Object.keys(BONUS_CONFIG.STREAK_MILESTONES)
        .map(Number)
        .sort((a, b) => b - a);
    
    for (const milestone of milestones) {
        if (streak >= milestone) {
            return BONUS_CONFIG.STREAK_MILESTONES[milestone];
        }
    }
    return { multiplier: 1.0, bonus: {} };
}

function getDifficultyInfo(difficulty) {
    return DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;
}

function getCategoryInfo(category) {
    return QUEST_CATEGORIES[category] || QUEST_CATEGORIES.meta;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
module.exports = {
    DAILY_QUESTS,
    WEEKLY_QUESTS,
    ACHIEVEMENTS,
    QUEST_CHAINS,
    QUEST_CATEGORIES,
    DIFFICULTY_SETTINGS,
    BONUS_CONFIG,
    NOTIFICATION_SETTINGS,
    REROLL_CONFIG,
    
    // Helper functions
    getQuestByCategory,
    getQuestById,
    getDailyQuestById,
    getWeeklyQuestById,
    getQuestChain,
    getAchievement,
    getAchievementMilestone,
    calculateScaledGoal,
    getStreakBonus,
    getDifficultyInfo,
    getCategoryInfo
};
