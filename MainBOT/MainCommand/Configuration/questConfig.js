/**
 * Quest Configuration
 * 
 * Note: The ACHIEVEMENTS array has been moved to unifiedAchievementConfig.js
 * for better maintainability. This file should only contain quest-related configs:
 * - QUEST_CONFIG, DAILY_QUEST_POOL, WEEKLY_QUEST_POOL
 * - DAILY_QUESTS, WEEKLY_QUESTS, QUEST_CATEGORIES
 * - getStreakBonus, QUEST_POOLS
 * 
 * For achievement-related imports, use: require('./unifiedAchievementConfig')
 */
const QUEST_CONFIG = {
    dailyQuestCount: 5,      // Number of random daily quests
    weeklyQuestCount: 4,     // Number of random weekly quests
    maxRerolls: 2,           // Max rerolls per day
    rerollCost: 100,         // Gems cost per reroll
    categoryDiversityLimit: 2 // Max quests from same category
};

// ═══════════════════════════════════════════════════════════════════
// DAILY QUEST POOL - Random selection each day
// Each quest has minGoal/maxGoal for dynamic requirements
// ═══════════════════════════════════════════════════════════════════
const DAILY_QUEST_POOL = [
    // ─── Gacha Quests ───
    { 
        templateId: 'daily_rolls_basic',
        descTemplate: 'Roll {goal} times',
        minGoal: 50, maxGoal: 500, baseGoal: 100,
        category: 'gacha', icon: '🎲', trackingType: 'rolls',
        baseReward: { coins: 5000, gems: 500, tickets: 2 }
    },
    { 
        templateId: 'daily_rolls_multi',
        descTemplate: 'Perform {goal} multi-rolls',
        minGoal: 5, maxGoal: 50, baseGoal: 10,
        category: 'gacha', icon: '🎰', trackingType: 'multi_rolls',
        baseReward: { coins: 8000, gems: 800, tickets: 3 }
    },
    { 
        templateId: 'daily_banner_variety',
        descTemplate: 'Roll on {goal} different banners',
        minGoal: 2, maxGoal: 5, baseGoal: 3,
        category: 'gacha', icon: '🎪', trackingType: 'banner_variety',
        baseReward: { coins: 6000, gems: 600, tickets: 2 }
    },

    // ─── Prayer Quests ───
    { 
        templateId: 'daily_prayers',
        descTemplate: 'Successfully pray {goal} times',
        minGoal: 3, maxGoal: 15, baseGoal: 5,
        category: 'prayer', icon: '🙏', trackingType: 'prays',
        baseReward: { coins: 10000, gems: 1000, tickets: 3 }
    },
    { 
        templateId: 'daily_pray_streak',
        descTemplate: 'Pray successfully {goal} times in a row',
        minGoal: 2, maxGoal: 5, baseGoal: 3,
        category: 'prayer', icon: '✨', trackingType: 'pray_streak',
        baseReward: { coins: 15000, gems: 1500, tickets: 4 }
    },

    // ─── Economy Quests ───
    { 
        templateId: 'daily_coins_earn',
        descTemplate: 'Earn {goal} coins',
        minGoal: 50000, maxGoal: 500000, baseGoal: 100000,
        category: 'economy', icon: '💰', trackingType: 'coins_earned',
        baseReward: { coins: 5000, gems: 500, tickets: 1 }
    },
    { 
        templateId: 'daily_coins_spend',
        descTemplate: 'Spend {goal} coins',
        minGoal: 25000, maxGoal: 250000, baseGoal: 50000,
        category: 'economy', icon: '💸', trackingType: 'coins_spent',
        baseReward: { coins: 3000, gems: 300, tickets: 1 }
    },
    { 
        templateId: 'daily_gems_earn',
        descTemplate: 'Earn {goal} gems',
        minGoal: 100, maxGoal: 1000, baseGoal: 250,
        category: 'economy', icon: '💎', trackingType: 'gems_earned',
        baseReward: { coins: 8000, gems: 200, tickets: 2 }
    },

    // ─── Crafting Quests ───
    { 
        templateId: 'daily_crafts',
        descTemplate: 'Craft {goal} items',
        minGoal: 1, maxGoal: 10, baseGoal: 3,
        category: 'crafting', icon: '🛠️', trackingType: 'crafts',
        baseReward: { coins: 8000, gems: 800, tickets: 2 }
    },
    { 
        templateId: 'daily_craft_rarity',
        descTemplate: 'Craft a rare+ item',
        minGoal: 1, maxGoal: 3, baseGoal: 1,
        category: 'crafting', icon: '⚗️', trackingType: 'craft_rare',
        baseReward: { coins: 12000, gems: 1200, tickets: 3 }
    },

    // ─── Gambling Quests ───
    { 
        templateId: 'daily_gambles',
        descTemplate: 'Use gamble commands {goal} times',
        minGoal: 5, maxGoal: 50, baseGoal: 10,
        category: 'gamble', icon: '🎰', trackingType: 'gambles',
        baseReward: { coins: 5000, gems: 500, tickets: 1 }
    },
    { 
        templateId: 'daily_gamble_wins',
        descTemplate: 'Win {goal} gambles',
        minGoal: 1, maxGoal: 10, baseGoal: 3,
        category: 'gamble', icon: '🏆', trackingType: 'gamble_wins',
        baseReward: { coins: 10000, gems: 1000, tickets: 2 }
    },
    { 
        templateId: 'daily_flip_streak',
        descTemplate: 'Win {goal} coin flips in a row',
        minGoal: 2, maxGoal: 5, baseGoal: 3,
        category: 'gamble', icon: '🪙', trackingType: 'flip_streak',
        baseReward: { coins: 15000, gems: 1500, tickets: 4 }
    },

    // ─── Pet Quests ───
    { 
        templateId: 'daily_pet_feeds',
        descTemplate: 'Feed your pet {goal} times',
        minGoal: 3, maxGoal: 15, baseGoal: 5,
        category: 'pets', icon: '🐾', trackingType: 'pet_feeds',
        baseReward: { coins: 3000, gems: 300, tickets: 1 }
    },
    { 
        templateId: 'daily_pet_play',
        descTemplate: 'Play with your pet {goal} times',
        minGoal: 2, maxGoal: 10, baseGoal: 3,
        category: 'pets', icon: '🎾', trackingType: 'pet_plays',
        baseReward: { coins: 4000, gems: 400, tickets: 1 }
    },

    // ─── Collection Quests ───
    { 
        templateId: 'daily_shinies',
        descTemplate: 'Obtain {goal} shiny fumo(s)',
        minGoal: 1, maxGoal: 5, baseGoal: 1,
        category: 'collection', icon: '✨', trackingType: 'shinies',
        baseReward: { coins: 15000, gems: 1500, tickets: 3 }
    },
    { 
        templateId: 'daily_new_fumos',
        descTemplate: 'Obtain {goal} new unique fumo(s)',
        minGoal: 1, maxGoal: 10, baseGoal: 3,
        category: 'collection', icon: '📚', trackingType: 'new_fumos',
        baseReward: { coins: 10000, gems: 1000, tickets: 2 }
    },

    // ─── Trading Quests ───
    { 
        templateId: 'daily_trades',
        descTemplate: 'Complete {goal} trade(s)',
        minGoal: 1, maxGoal: 5, baseGoal: 2,
        category: 'trading', icon: '🤝', trackingType: 'trades',
        baseReward: { coins: 5000, gems: 500, tickets: 1 }
    },

    // ─── Market Quests ───
    { 
        templateId: 'daily_market_sales',
        descTemplate: 'Sell {goal} item(s) on market',
        minGoal: 1, maxGoal: 5, baseGoal: 1,
        category: 'market', icon: '🏪', trackingType: 'market_sales',
        baseReward: { coins: 5000, gems: 500, tickets: 1 }
    },
    { 
        templateId: 'daily_market_buys',
        descTemplate: 'Buy {goal} item(s) from market',
        minGoal: 1, maxGoal: 5, baseGoal: 1,
        category: 'market', icon: '🛒', trackingType: 'market_buys',
        baseReward: { coins: 5000, gems: 500, tickets: 1 }
    },

    // ─── Social Quests ───
    { 
        templateId: 'daily_gifts',
        descTemplate: 'Send {goal} gift(s)',
        minGoal: 1, maxGoal: 5, baseGoal: 1,
        category: 'social', icon: '🎁', trackingType: 'gifts',
        baseReward: { coins: 3000, gems: 300, tickets: 1 }
    },

    // ─── Building Quests ───
    { 
        templateId: 'daily_building_collect',
        descTemplate: 'Collect from buildings {goal} times',
        minGoal: 1, maxGoal: 10, baseGoal: 3,
        category: 'buildings', icon: '🏠', trackingType: 'building_collects',
        baseReward: { coins: 4000, gems: 400, tickets: 1 }
    },

    // ─── General Quests ───
    { 
        templateId: 'daily_claim',
        descTemplate: 'Claim your daily reward',
        minGoal: 1, maxGoal: 1, baseGoal: 1,
        category: 'general', icon: '📅', trackingType: 'daily_claim',
        baseReward: { coins: 2000, gems: 200, tickets: 1 }
    },
    { 
        templateId: 'daily_commands',
        descTemplate: 'Use {goal} different commands',
        minGoal: 5, maxGoal: 20, baseGoal: 10,
        category: 'general', icon: '⌨️', trackingType: 'command_variety',
        baseReward: { coins: 5000, gems: 500, tickets: 2 }
    },

    // ─── Crate Quests ───
    { 
        templateId: 'daily_crates',
        descTemplate: 'Open {goal} mystery crate(s)',
        minGoal: 1, maxGoal: 5, baseGoal: 2,
        category: 'crates', icon: '📦', trackingType: 'crates_opened',
        baseReward: { coins: 6000, gems: 600, tickets: 2 }
    },

    // ─── Meta Quests ───
    { 
        templateId: 'daily_complete_quests',
        descTemplate: 'Complete {goal} other quest(s)',
        minGoal: 2, maxGoal: 4, baseGoal: 3,
        category: 'meta', icon: '📋', trackingType: 'quests_completed',
        baseReward: { coins: 10000, gems: 1000, tickets: 3 }
    }
];

// ═══════════════════════════════════════════════════════════════════
// WEEKLY QUEST POOL - Random selection each week
// ═══════════════════════════════════════════════════════════════════
const WEEKLY_QUEST_POOL = [
    // ─── Gacha Challenges ───
    { 
        templateId: 'weekly_rolls',
        descTemplate: 'Roll {goal} times',
        minGoal: 500, maxGoal: 5000, baseGoal: 1000,
        category: 'gacha', icon: '🎲', trackingType: 'rolls',
        baseReward: { coins: 50000, gems: 5000, tickets: 10 }
    },
    { 
        templateId: 'weekly_multi_rolls',
        descTemplate: 'Perform {goal} multi-rolls',
        minGoal: 25, maxGoal: 250, baseGoal: 50,
        category: 'gacha', icon: '🎰', trackingType: 'multi_rolls',
        baseReward: { coins: 60000, gems: 6000, tickets: 15 }
    },

    // ─── Prayer Mastery ───
    { 
        templateId: 'weekly_prayers',
        descTemplate: 'Successfully pray {goal} times',
        minGoal: 20, maxGoal: 100, baseGoal: 35,
        category: 'prayer', icon: '🙏', trackingType: 'prays',
        baseReward: { coins: 75000, gems: 7500, tickets: 20 }
    },

    // ─── Collection Goals ───
    { 
        templateId: 'weekly_shinies',
        descTemplate: 'Obtain {goal} shiny fumos',
        minGoal: 5, maxGoal: 25, baseGoal: 10,
        category: 'collection', icon: '✨', trackingType: 'shinies',
        baseReward: { coins: 100000, gems: 10000, tickets: 25 }
    },
    { 
        templateId: 'weekly_astral_plus',
        descTemplate: 'Get an ASTRAL+ rarity fumo',
        minGoal: 1, maxGoal: 3, baseGoal: 1,
        category: 'collection', icon: '🌌', trackingType: 'astral_plus',
        baseReward: { coins: 500000, gems: 50000, tickets: 100 }
    },
    { 
        templateId: 'weekly_unique_fumos',
        descTemplate: 'Obtain {goal} new unique fumos',
        minGoal: 10, maxGoal: 50, baseGoal: 20,
        category: 'collection', icon: '📚', trackingType: 'new_fumos',
        baseReward: { coins: 80000, gems: 8000, tickets: 20 }
    },

    // ─── Crafting Goals ───
    { 
        templateId: 'weekly_crafts',
        descTemplate: 'Craft {goal} items',
        minGoal: 10, maxGoal: 50, baseGoal: 15,
        category: 'crafting', icon: '🔧', trackingType: 'crafts',
        baseReward: { coins: 50000, gems: 5000, tickets: 15 }
    },

    // ─── Gambling Goals ───
    { 
        templateId: 'weekly_gambles',
        descTemplate: 'Use gamble commands {goal} times',
        minGoal: 25, maxGoal: 200, baseGoal: 50,
        category: 'gamble', icon: '🎰', trackingType: 'gambles',
        baseReward: { coins: 40000, gems: 4000, tickets: 10 }
    },
    { 
        templateId: 'weekly_gamble_profit',
        descTemplate: 'Win {goal} total from gambling',
        minGoal: 250000, maxGoal: 2500000, baseGoal: 500000,
        category: 'gamble', icon: '💵', trackingType: 'gamble_profit',
        baseReward: { coins: 100000, gems: 10000, tickets: 25 }
    },

    // ─── Economy Goals ───
    { 
        templateId: 'weekly_coins_earn',
        descTemplate: 'Earn {goal} coins total',
        minGoal: 500000, maxGoal: 5000000, baseGoal: 1000000,
        category: 'economy', icon: '💰', trackingType: 'coins_earned',
        baseReward: { coins: 100000, gems: 10000, tickets: 20 }
    },
    { 
        templateId: 'weekly_coins_spend',
        descTemplate: 'Spend {goal} coins total',
        minGoal: 250000, maxGoal: 2500000, baseGoal: 500000,
        category: 'economy', icon: '💸', trackingType: 'coins_spent',
        baseReward: { coins: 50000, gems: 5000, tickets: 10 }
    },

    // ─── Pet Goals ───
    { 
        templateId: 'weekly_pet_hatches',
        descTemplate: 'Hatch {goal} pet egg(s)',
        minGoal: 1, maxGoal: 10, baseGoal: 3,
        category: 'pets', icon: '🥚', trackingType: 'pet_hatches',
        baseReward: { coins: 75000, gems: 7500, tickets: 20 }
    },
    { 
        templateId: 'weekly_pet_level',
        descTemplate: 'Gain {goal} pet level(s)',
        minGoal: 3, maxGoal: 15, baseGoal: 5,
        category: 'pets', icon: '📈', trackingType: 'pet_levels',
        baseReward: { coins: 60000, gems: 6000, tickets: 15 }
    },

    // ─── Building Goals ───
    { 
        templateId: 'weekly_building_upgrades',
        descTemplate: 'Upgrade buildings {goal} times',
        minGoal: 3, maxGoal: 15, baseGoal: 5,
        category: 'buildings', icon: '🏗️', trackingType: 'building_upgrades',
        baseReward: { coins: 80000, gems: 8000, tickets: 20 }
    },

    // ─── Trading Goals ───
    { 
        templateId: 'weekly_trades',
        descTemplate: 'Complete {goal} trades',
        minGoal: 5, maxGoal: 25, baseGoal: 10,
        category: 'trading', icon: '🤝', trackingType: 'trades',
        baseReward: { coins: 60000, gems: 6000, tickets: 15 }
    },

    // ─── Market Goals ───
    { 
        templateId: 'weekly_market_sales',
        descTemplate: 'Sell {goal} items on market',
        minGoal: 3, maxGoal: 20, baseGoal: 5,
        category: 'market', icon: '🏪', trackingType: 'market_sales',
        baseReward: { coins: 40000, gems: 4000, tickets: 10 }
    },
    { 
        templateId: 'weekly_market_profit',
        descTemplate: 'Earn {goal} from market sales',
        minGoal: 100000, maxGoal: 1000000, baseGoal: 250000,
        category: 'market', icon: '📈', trackingType: 'market_profit',
        baseReward: { coins: 60000, gems: 6000, tickets: 15 }
    },

    // ─── Mystery Crate Goals ───
    { 
        templateId: 'weekly_crates',
        descTemplate: 'Open {goal} mystery crates',
        minGoal: 3, maxGoal: 20, baseGoal: 5,
        category: 'crates', icon: '📦', trackingType: 'crates_opened',
        baseReward: { coins: 60000, gems: 6000, tickets: 15 }
    },

    // ─── Social Goals ───
    { 
        templateId: 'weekly_gifts',
        descTemplate: 'Send {goal} gifts',
        minGoal: 3, maxGoal: 20, baseGoal: 7,
        category: 'social', icon: '🎁', trackingType: 'gifts',
        baseReward: { coins: 30000, gems: 3000, tickets: 8 }
    },

    // ─── Dedication Goals ───
    { 
        templateId: 'weekly_dailies_complete',
        descTemplate: 'Complete all daily quests {goal} days',
        minGoal: 3, maxGoal: 7, baseGoal: 5,
        category: 'dedication', icon: '🔥', trackingType: 'daily_completions',
        baseReward: { coins: 100000, gems: 10000, tickets: 30 }
    },
    { 
        templateId: 'weekly_login_streak',
        descTemplate: 'Maintain a {goal} day login streak',
        minGoal: 3, maxGoal: 7, baseGoal: 5,
        category: 'dedication', icon: '📅', trackingType: 'login_streak',
        baseReward: { coins: 75000, gems: 7500, tickets: 20 }
    }
];

// ═══════════════════════════════════════════════════════════════════
// ACHIEVEMENTS - Permanent milestones with tiered rewards
// ═══════════════════════════════════════════════════════════════════
const ACHIEVEMENTS = [
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
    },
    {
        id: 'total_limit_breaks',
        name: 'Limit Breaker',
        description: 'Total limit breaks performed',
        category: 'collection',
        icon: '💥',
        milestones: [
            { count: 10, reward: { coins: 25000, gems: 2500, tickets: 8 } },
            { count: 50, reward: { coins: 100000, gems: 10000, tickets: 25 } },
            { count: 100, reward: { coins: 250000, gems: 25000, tickets: 50, items: ['LimitBadge(E)'] } }
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
        quests: ['daily_rolls_basic', 'daily_prayers', 'daily_crafts'],
        prerequisites: null,
        bonusRewards: { coins: 50000, gems: 5000, tickets: 15, items: ['BeginnerBadge(C)'] },
        icon: '🌱'
    },
    {
        id: 'collector_journey',
        name: 'Collector\'s Journey',
        description: 'Start building your collection',
        quests: ['daily_shinies', 'weekly_rolls', 'weekly_shinies'],
        prerequisites: { chains: ['beginner_path'] },
        bonusRewards: { coins: 150000, gems: 15000, tickets: 40, items: ['CollectorBadge(R)'] },
        icon: '✨'
    },
    {
        id: 'pet_master',
        name: 'Pet Master\'s Trial',
        description: 'Master the art of pet raising',
        quests: ['daily_pet_feeds', 'weekly_pet_hatches'],
        prerequisites: { level: 25 },
        bonusRewards: { coins: 200000, gems: 20000, tickets: 50, items: ['PetMasterBadge(E)'] },
        icon: '🐾'
    },
    {
        id: 'economic_empire',
        name: 'Economic Empire',
        description: 'Build your wealth empire',
        quests: ['daily_coins_earn', 'weekly_coins_earn'],
        prerequisites: { rebirth: 1 },
        bonusRewards: { coins: 500000, gems: 50000, tickets: 100, items: ['EmpireBadge(L)'] },
        icon: '💰'
    },
    {
        id: 'ultimate_challenge',
        name: 'Ultimate Challenge',
        description: 'The final test for true masters',
        quests: ['weekly_rolls', 'weekly_astral_plus', 'weekly_shinies'],
        prerequisites: { rebirth: 3, level: 100, chains: ['collector_journey', 'economic_empire'] },
        bonusRewards: { coins: 2000000, gems: 200000, tickets: 250, items: ['ChampionBadge(M)', 'GoldenSigil(?)'] },
        icon: '👑'
    }
];

// ═══════════════════════════════════════════════════════════════════
// QUEST CATEGORIES
// ═══════════════════════════════════════════════════════════════════
const QUEST_CATEGORIES = {
    gacha: { name: 'Gacha Quests', icon: '🎲', color: '#FF6B6B', description: 'Roll and collect fumos' },
    prayer: { name: 'Prayer Quests', icon: '🙏', color: '#4ECDC4', description: 'Pray for rewards' },
    economy: { name: 'Economy Quests', icon: '💰', color: '#FFD93D', description: 'Earn coins and gems' },
    gamble: { name: 'Gambling Quests', icon: '🎰', color: '#6C5CE7', description: 'Test your luck' },
    crafting: { name: 'Crafting Quests', icon: '🛠️', color: '#A8E6CF', description: 'Create items' },
    collection: { name: 'Collection Quests', icon: '✨', color: '#DDA0DD', description: 'Collect rare fumos' },
    pets: { name: 'Pet Quests', icon: '🐾', color: '#FF9FF3', description: 'Raise pets' },
    buildings: { name: 'Building Quests', icon: '🏗️', color: '#54A0FF', description: 'Upgrade buildings' },
    trading: { name: 'Trading Quests', icon: '🤝', color: '#20BF6B', description: 'Trade with players' },
    market: { name: 'Market Quests', icon: '🏪', color: '#778CA3', description: 'Market activities' },
    crates: { name: 'Crate Quests', icon: '📦', color: '#F7B731', description: 'Open crates' },
    social: { name: 'Social Quests', icon: '🎁', color: '#EB3B5A', description: 'Interact with players' },
    general: { name: 'General Quests', icon: '📅', color: '#4B7BEC', description: 'Daily tasks' },
    meta: { name: 'Meta Quests', icon: '🗓️', color: '#00D2D3', description: 'Complete other quests' },
    dedication: { name: 'Dedication', icon: '🔥', color: '#FF6348', description: 'Show commitment' }
};

// ═══════════════════════════════════════════════════════════════════
// DIFFICULTY SETTINGS
// ═══════════════════════════════════════════════════════════════════
const DIFFICULTY_SETTINGS = {
    easy: { name: 'Easy', emoji: '🟢', multiplier: 1.0, color: '#2ECC71' },
    medium: { name: 'Medium', emoji: '🟡', multiplier: 1.5, color: '#F39C12' },
    hard: { name: 'Hard', emoji: '🔴', multiplier: 2.0, color: '#E74C3C' },
    legendary: { name: 'Legendary', emoji: '🟣', multiplier: 3.0, color: '#9B59B6' }
};

// ═══════════════════════════════════════════════════════════════════
// BONUS REWARDS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const BONUS_CONFIG = {
    ALL_DAILIES: { coins: 25000, gems: 2500, tickets: 10 },
    ALL_WEEKLIES: { coins: 250000, gems: 25000, tickets: 75, items: ['MysticOrb(M)'] },
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
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
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
    return QUEST_CATEGORIES[category] || QUEST_CATEGORIES.general;
}

function getQuestFromPool(templateId, pool = 'daily') {
    const questPool = pool === 'daily' ? DAILY_QUEST_POOL : WEEKLY_QUEST_POOL;
    return questPool.find(q => q.templateId === templateId);
}

function getAchievement(achievementId) {
    return ACHIEVEMENTS.find(a => a.id === achievementId);
}

function getQuestChain(chainId) {
    return QUEST_CHAINS.find(c => c.id === chainId);
}

// Aggregated pool for easier access
const QUEST_POOLS = {
    daily: DAILY_QUEST_POOL,
    weekly: WEEKLY_QUEST_POOL
};

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════
module.exports = {
    // Config
    QUEST_CONFIG,
    
    // Quest Pools
    QUEST_POOLS,
    DAILY_QUEST_POOL,
    WEEKLY_QUEST_POOL,
    
    // Other structures
    ACHIEVEMENTS,
    QUEST_CHAINS,
    QUEST_CATEGORIES,
    DIFFICULTY_SETTINGS,
    BONUS_CONFIG,
    
    // Helper functions
    getStreakBonus,
    getDifficultyInfo,
    getCategoryInfo,
    getQuestFromPool,
    getAchievement,
    getQuestChain
};
