const DAILY_QUESTS = [
    { 
        id: 'roll_1000', 
        desc: '🎲 Roll 1000 times', 
        goal: 1000,
        category: 'gacha',
        scalable: true,
        icon: '🎲'
    },
    { 
        id: 'pray_5', 
        desc: '🙏 Pray 5 times successfully', 
        goal: 5,
        category: 'prayer',
        icon: '🙏'
    },
    { 
        id: 'coins_1m', 
        desc: '💰 Obtain 1M coins passively', 
        goal: 1_000_000,
        category: 'economy',
        scalable: true,
        icon: '💰'
    },
    { 
        id: 'gamble_10', 
        desc: '🎰 Use any gamble command 10 times', 
        goal: 10,
        category: 'gamble',
        icon: '🎰'
    },
    { 
        id: 'craft_1', 
        desc: '🛠️ Craft a random item', 
        goal: 1,
        category: 'crafting',
        icon: '🛠️'
    },
];

const WEEKLY_QUESTS = [
    { 
        id: 'roll_15000', 
        desc: '🎲 Roll 15,000 times', 
        goal: 15000,
        category: 'gacha',
        scalable: true,
        icon: '🎲'
    },
    { 
        id: 'pray_success_25', 
        desc: '🙏 Successfully pray 25 times', 
        goal: 25,
        category: 'prayer',
        icon: '🙏'
    },
    { 
        id: 'shiny_25', 
        desc: '✨ Obtain 25 shiny fumos', 
        goal: 25,
        category: 'collection',
        icon: '✨'
    },
    { 
        id: 'craft_15', 
        desc: '🔧 Craft 15 random items', 
        goal: 15,
        category: 'crafting',
        icon: '🔧'
    },
    { 
        id: 'gamble_25', 
        desc: '🎰 Use any gamble command 25 times', 
        goal: 25,
        category: 'gamble',
        icon: '🎰'
    },
    { 
        id: 'astral_plus', 
        desc: '🌌 Get an ASTRAL+ fumo', 
        goal: 1,
        category: 'collection',
        icon: '🌌'
    },
    { 
        id: 'complete_dailies', 
        desc: '🗓️ Complete 7 daily quests', 
        goal: 7,
        category: 'meta',
        icon: '🗓️'
    },
];

const QUEST_CHAINS = [
    {
        id: 'basic_chain',
        name: 'Beginner\'s Path',
        quests: ['roll_1000', 'pray_5', 'craft_1'],
        bonusRewards: {
            coins: 50000,
            gems: 5000
        },
        icon: '🌱'
    },
    {
        id: 'advanced_chain',
        name: 'Veteran\'s Journey',
        quests: ['roll_15000', 'pray_success_25', 'gamble_25'],
        prerequisites: {
            level: 50
        },
        bonusRewards: {
            coins: 200000,
            gems: 20000,
            items: ['MysticOrb(M)']
        },
        icon: '⚔️'
    },
    {
        id: 'master_chain',
        name: 'Master\'s Challenge',
        quests: ['shiny_25', 'astral_plus', 'complete_dailies'],
        prerequisites: {
            rebirth: 1,
            achievements: ['total_rolls']
        },
        bonusRewards: {
            coins: 1000000,
            gems: 100000,
            items: ['GoldenSigil(?)', 'TimeClock(L)']
        },
        icon: '👑'
    }
];

const QUEST_CATEGORIES = {
    gacha: {
        name: 'Gacha Quests',
        icon: '🎲',
        description: 'Roll and collect fumos'
    },
    prayer: {
        name: 'Prayer Quests',
        icon: '🙏',
        description: 'Pray to characters for rewards'
    },
    economy: {
        name: 'Economy Quests',
        icon: '💰',
        description: 'Earn coins and gems'
    },
    gamble: {
        name: 'Gambling Quests',
        icon: '🎰',
        description: 'Test your luck'
    },
    crafting: {
        name: 'Crafting Quests',
        icon: '🛠️',
        description: 'Create items and equipment'
    },
    collection: {
        name: 'Collection Quests',
        icon: '✨',
        description: 'Collect rare fumos'
    },
    meta: {
        name: 'Meta Quests',
        icon: '🗓️',
        description: 'Complete other quests'
    }
};

const QUEST_DIFFICULTY_MULTIPLIERS = {
    EASY: 0.5,
    NORMAL: 1.0,
    HARD: 1.5,
    EXPERT: 2.0,
    MASTER: 3.0
};

const REROLL_CONFIG = {
    DAILY_LIMIT: 3,
    GEM_COST: 1000,
    COOLDOWN: 3600000
};

const NOTIFICATION_SETTINGS = {
    NEAR_COMPLETION_THRESHOLD: 0.9,
    RESET_WARNING_TIME: 3600000,
    STREAK_MILESTONES: [3, 7, 14, 30, 60, 100],
    ENABLE_COMPLETION: true,
    ENABLE_ACHIEVEMENT: true,
    ENABLE_STREAK: true,
    ENABLE_RESET_WARNING: true
};

const QUEST_REWARDS_MULTIPLIER = {
    STREAK_3: 1.1,
    STREAK_7: 1.25,
    STREAK_14: 1.5,
    STREAK_30: 2.0,
    REBIRTH: 0.25
};

function getQuestByCategory(category) {
    const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    return allQuests.filter(q => q.category === category);
}

function getQuestById(questId) {
    const allQuests = [...DAILY_QUESTS, ...WEEKLY_QUESTS];
    return allQuests.find(q => q.id === questId);
}

function getQuestChain(chainId) {
    return QUEST_CHAINS.find(c => c.id === chainId);
}

function calculateScaledGoal(baseGoal, userLevel, userRebirth) {
    let multiplier = 1;
    multiplier += userRebirth * 0.5;
    multiplier += Math.floor(userLevel / 10) * 0.1;
    return Math.floor(baseGoal * multiplier);
}

module.exports = {
    DAILY_QUESTS,
    WEEKLY_QUESTS,
    QUEST_CHAINS,
    QUEST_CATEGORIES,
    QUEST_DIFFICULTY_MULTIPLIERS,
    REROLL_CONFIG,
    NOTIFICATION_SETTINGS,
    QUEST_REWARDS_MULTIPLIER,
    getQuestByCategory,
    getQuestById,
    getQuestChain,
    calculateScaledGoal
};