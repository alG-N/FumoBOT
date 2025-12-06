const DAILY_REWARDS = {
    BASE_COINS: 25000,
    BASE_GEMS: 3500,
    BASE_ITEMS: [
        { name: 'PrayTicket(R)', quantity: 5 },
        { name: 'FumoTrait(R)', quantity: 15 },
        { name: 'DailyTicket(C)', quantity: 1 }
    ],
    BONUS_CHANCE: 0.15,
    BONUS_ITEMS: [
        { name: 'PrayTicket(R)', quantityRange: [3, 8] },
        { name: 'FumoTrait(R)', quantityRange: [3, 8] }
    ]
};

const WEEKLY_REWARDS = {
    BASE_COINS: 500000,
    BASE_GEMS: 100000,
    BASE_ITEMS: [
        { name: 'MysticOrb(M)', quantity: 1 },
        { name: 'PrayTicket(R)', quantity: 35 },
        { name: 'FumoTrait(R)', quantity: 50 }
    ],
    STREAK_BONUS: {
        threshold: 7,
        item: 'StreakBadge(7W)'
    }
};

const ACHIEVEMENT_REWARDS = {
    total_rolls: {
        type: 'milestone',
        perMilestone: {
            coins: 5000,
            gems: 1000
        },
        bonusMilestones: {
            500: [{ name: 'PrayTicket(R)', quantity: 1 }],
            1000: [{ name: 'FumoChangeToken(E)', quantity: 1 }],
            5000: [{ name: 'GoldenSigil(?)', quantity: 1 }]
        }
    },
    total_prays: {
        type: 'milestone',
        perMilestone: {
            items: [{ name: 'FumoTrait(R)', quantity: 20 }]
        },
        bonusMilestones: {
            50: [{ name: 'SFumoTrait(L)', quantity: 5 }],
            100: [{ name: 'MysticOrb(M)', quantity: 1 }]
        }
    },
    shiny_collector: {
        type: 'threshold',
        rewards: {
            coins: 100000,
            gems: 10000,
            items: [{ name: 'ShinyShard(?)', quantity: 1 }]
        }
    },
    alg_hunter: {
        type: 'threshold',
        rewards: {
            coins: 1000000,
            gems: 100000,
            items: [{ name: 'alGShard(P)', quantity: 1 }]
        }
    },
    transcendent_owner: {
        type: 'threshold',
        rewards: {
            coins: 10000000,
            gems: 1000000,
            items: [
                { name: 'EternalEssence(?)', quantity: 1 },
                { name: 'TranscendentBadge(T)', quantity: 1 }
            ]
        }
    },
    coin_billionaire: {
        type: 'threshold',
        rewards: {
            gems: 500000,
            items: [{ name: 'GoldenCrown(L)', quantity: 1 }]
        }
    },
    gem_master: {
        type: 'threshold',
        rewards: {
            coins: 5000000,
            items: [{ name: 'DiamondCrown(L)', quantity: 1 }]
        }
    },
    daily_warrior: {
        type: 'threshold',
        rewards: {
            coins: 250000,
            gems: 25000,
            items: [{ name: 'WarriorBadge(E)', quantity: 1 }]
        }
    },
    weekly_champion: {
        type: 'threshold',
        rewards: {
            coins: 1000000,
            gems: 100000,
            items: [{ name: 'ChampionBadge(M)', quantity: 1 }]
        }
    },
    streak_master: {
        type: 'threshold',
        rewards: {
            coins: 2000000,
            gems: 200000,
            items: [
                { name: 'StreakMasterBadge(M)', quantity: 1 },
                { name: 'TimeClock(L)', quantity: 1 }
            ]
        }
    },
    gambler_elite: {
        type: 'threshold',
        rewards: {
            coins: 500000,
            gems: 50000,
            items: [{ name: 'GamblersCoin(L)', quantity: 1 }]
        }
    },
    crafter_expert: {
        type: 'threshold',
        rewards: {
            coins: 300000,
            gems: 30000,
            items: [{ name: 'MasterCrafterHammer(E)', quantity: 1 }]
        }
    },
    rebirth_legend: {
        type: 'threshold',
        rewards: {
            coins: 50000000,
            gems: 5000000,
            items: [
                { name: 'RebirthCrown(M)', quantity: 1 },
                { name: 'S!gil?(?)', quantity: 1 }
            ]
        }
    },
    library_complete: {
        type: 'threshold',
        rewards: {
            coins: 100000000,
            gems: 10000000,
            items: [
                { name: 'LibraryMasterBadge(?)', quantity: 1 },
                { name: 'EternalEssence(?)', quantity: 5 }
            ]
        }
    },
    secret_finder: {
        type: 'threshold',
        rewards: {
            coins: 500000000,
            gems: 50000000,
            items: [
                { name: 'SecretKey(?)', quantity: 1 },
                { name: 'VoidCrystal(?)', quantity: 1 }
            ]
        }
    },
    speed_roller: {
        type: 'threshold',
        rewards: {
            coins: 1000000,
            gems: 100000,
            items: [{ name: 'SpeedBadge(E)', quantity: 1 }]
        }
    },
    lucky_charm: {
        type: 'threshold',
        rewards: {
            coins: 5000000,
            gems: 500000,
            items: [
                { name: 'LuckyCharm(M)', quantity: 1 },
                { name: 'CelestialEssence(D)', quantity: 1 }
            ]
        }
    },
    trader_expert: {
        type: 'threshold',
        rewards: {
            coins: 400000,
            gems: 40000,
            items: [{ name: 'TraderBadge(E)', quantity: 1 }]
        }
    },
    market_mogul: {
        type: 'threshold',
        rewards: {
            coins: 2000000,
            gems: 200000,
            items: [{ name: 'MerchantCrown(L)', quantity: 1 }]
        }
    },
    pet_master: {
        type: 'threshold',
        rewards: {
            coins: 750000,
            gems: 75000,
            items: [{ name: 'PetMasterBadge(L)', quantity: 1 }]
        }
    }
};

const STREAK_BONUSES = {
    3: { multiplier: 1.1, bonus: 'Small boost' },
    7: { multiplier: 1.25, bonus: 'Weekly warrior boost' },
    14: { multiplier: 1.5, bonus: 'Two-week dedication boost' },
    30: { multiplier: 2.0, bonus: 'Monthly legend boost' },
    60: { multiplier: 2.5, bonus: 'Two-month master boost' },
    100: { multiplier: 3.0, bonus: 'Legendary streak boost' }
};

const QUEST_CHAIN_REWARDS = {
    basic_chain: {
        coins: 50000,
        gems: 5000,
        items: []
    },
    advanced_chain: {
        coins: 200000,
        gems: 20000,
        items: [{ name: 'MysticOrb(M)', quantity: 1 }]
    },
    master_chain: {
        coins: 1000000,
        gems: 100000,
        items: [
            { name: 'GoldenSigil(?)', quantity: 1 },
            { name: 'TimeClock(L)', quantity: 1 }
        ]
    }
};

const TIER_MULTIPLIERS = {
    bronze: 1.0,
    silver: 1.5,
    gold: 2.0,
    platinum: 3.0
};

const REBIRTH_REWARD_MULTIPLIER = 0.25;

const FIRST_TIME_BONUSES = {
    first_daily: {
        coins: 10000,
        gems: 1000,
        items: [{ name: 'WelcomeGift(C)', quantity: 1 }]
    },
    first_weekly: {
        coins: 50000,
        gems: 5000,
        items: [{ name: 'FirstWeekBadge(R)', quantity: 1 }]
    },
    first_achievement: {
        coins: 25000,
        gems: 2500
    }
};

const LEVEL_SCALING = {
    enabled: true,
    baseMultiplier: 0.01,
    maxMultiplier: 2.0,
    perLevel: 0.01
};

function calculateLevelBonus(level) {
    if (!LEVEL_SCALING.enabled) return 1;
    
    const bonus = 1 + (level * LEVEL_SCALING.perLevel);
    return Math.min(bonus, LEVEL_SCALING.maxMultiplier);
}

function calculateRebirthBonus(rebirth) {
    return 1 + (rebirth * REBIRTH_REWARD_MULTIPLIER);
}

function calculateStreakBonus(streak) {
    const milestones = Object.keys(STREAK_BONUSES).map(Number).sort((a, b) => b - a);
    
    for (const milestone of milestones) {
        if (streak >= milestone) {
            return STREAK_BONUSES[milestone].multiplier;
        }
    }
    
    return 1;
}

function applyAllMultipliers(baseRewards, level, rebirth, streak) {
    const levelBonus = calculateLevelBonus(level);
    const rebirthBonus = calculateRebirthBonus(rebirth);
    const streakBonus = calculateStreakBonus(streak);
    
    const totalMultiplier = levelBonus * rebirthBonus * streakBonus;
    
    return {
        coins: Math.floor(baseRewards.coins * totalMultiplier),
        gems: Math.floor(baseRewards.gems * totalMultiplier),
        items: baseRewards.items,
        multipliers: {
            level: levelBonus,
            rebirth: rebirthBonus,
            streak: streakBonus,
            total: totalMultiplier
        }
    };
}

function getRewardsByAchievement(achievementId) {
    return ACHIEVEMENT_REWARDS[achievementId] || null;
}

function getStreakBonusInfo(streak) {
    const milestones = Object.keys(STREAK_BONUSES).map(Number).sort((a, b) => b - a);
    
    for (const milestone of milestones) {
        if (streak >= milestone) {
            return STREAK_BONUSES[milestone];
        }
    }
    
    return { multiplier: 1, bonus: 'No bonus yet' };
}

module.exports = {
    DAILY_REWARDS,
    WEEKLY_REWARDS,
    ACHIEVEMENT_REWARDS,
    STREAK_BONUSES,
    QUEST_CHAIN_REWARDS,
    TIER_MULTIPLIERS,
    REBIRTH_REWARD_MULTIPLIER,
    FIRST_TIME_BONUSES,
    LEVEL_SCALING,
    calculateLevelBonus,
    calculateRebirthBonus,
    calculateStreakBonus,
    applyAllMultipliers,
    getRewardsByAchievement,
    getStreakBonusInfo
};