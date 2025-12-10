const PET_ABILITIES = {
    Dog: {
        abilityName: "Loyal Companion",
        stat: 'Coin',
        base: 5,
        max: 150,
        type: 'percent',
        description: "Increases coin rewards"
    },
    Bunny: {
        abilityName: "Lucky Foot",
        stat: 'Luck',
        base: 1,
        max: 100,
        type: 'percent',
        description: "Boosts luck chance"
    },
    Cat: {
        abilityName: "Gem Hunter",
        stat: 'Gem',
        base: 2.5,
        max: 75,
        type: 'percent',
        description: "Increases gem rewards"
    },
    Monkey: {
        abilityName: "Business Sense",
        stat: 'Income',
        base: 1.01,
        max: 2,
        type: 'multiplier',
        description: "Multiplies all income"
    },
    Bear: {
        abilityName: "Treasure Nose",
        stat: 'ItemChance',
        base: 5,
        max: 20,
        type: 'interval-chance',
        interval: 5 * 60 * 1000,
        description: "Chance to find random items"
    },
    Pig: {
        abilityName: "Time Warp",
        stat: 'Cooldown',
        base: 0.99,
        max: 0.5,
        type: 'multiplier',
        description: "Reduces cooldown times"
    },
    Chicken: {
        abilityName: "Rapid Incubation",
        stat: 'HatchSpeed',
        base: 1.5,
        max: 3,
        type: 'multiplier',
        description: "Speeds up egg hatching"
    },
    Owl: {
        abilityName: "Ancient Wisdom",
        stat: 'ExpBonus',
        base: 0.1,
        max: 5,
        type: 'passive',
        activeInterval: 15 * 60 * 1000,
        activeGain: 150,
        maxGain: 750,
        description: "Grants passive exp to all pets"
    },
    SilverMonkey: {
        abilityName: "Silver Fortune",
        stat: 'Income',
        base: 1.05,
        max: 2.5,
        type: 'multiplier',
        description: "Enhanced income multiplier"
    },
    PolarBear: {
        abilityName: "Frozen Cache",
        stat: 'ItemChance',
        base: 8,
        max: 30,
        type: 'interval-chance',
        interval: 4 * 60 * 1000,
        description: "Better item finding ability"
    },
    NightOwl: {
        abilityName: "Nocturnal Insight",
        stat: 'ExpBonus',
        base: 0.2,
        max: 8,
        type: 'passive',
        activeInterval: 12 * 60 * 1000,
        activeGain: 200,
        maxGain: 1000,
        description: "Enhanced exp bonus"
    },
    Butterfly: {
        abilityName: "Metamorphosis",
        stat: 'AllStats',
        base: 1.02,
        max: 1.5,
        type: 'multiplier',
        description: "Small boost to everything"
    },
    GoldenLab: {
        abilityName: "Midas Touch",
        stat: 'Coin',
        base: 10,
        max: 300,
        type: 'percent',
        description: "Massive coin boost"
    }
};

const EGG_POOLS = {
    CommonEgg: [
        { name: "Dog", rarity: "Common", chance: 33 },
        { name: "Bunny", rarity: "Common", chance: 33 },
        { name: "Cat", rarity: "Common", chance: 34 }
    ],
    RareEgg: [
        { name: "Monkey", rarity: "Rare", chance: 45 }, // 45
        { name: "Bear", rarity: "Rare", chance: 30 }, // 30
        { name: "Pig", rarity: "Epic", chance: 15 }, // 15
        { name: "Chicken", rarity: "Legendary", chance: 6 }, // 6
        { name: "Owl", rarity: "Mythical", chance: 4 } // 4
    ],
    DivineEgg: [
        { name: "SilverMonkey", rarity: "Legendary", chance: 50 },
        { name: "PolarBear", rarity: "Legendary", chance: 45 },
        { name: "NightOwl", rarity: "Mythical", chance: 4 },
        { name: "Butterfly", rarity: "Mythical", chance: 0.8 },
        { name: "GoldenLab", rarity: "Divine", chance: 0.2 }
    ]
};

const EGG_DATA = {
    CommonEgg: { time: 10 * 10 * 1000, emoji: "🥚", rarity: "Common" },
    RareEgg: { time: 90 * 60 * 1000, emoji: "🐣", rarity: "Rare" },
    DivineEgg: { time: 6 * 60 * 60 * 1000, emoji: "🌟", rarity: "Divine" }
};

const HUNGER_CONFIG = {
    Common: { max: 1500, duration: 12 },
    Rare: { max: 1800, duration: 15 },
    Epic: { max: 2160, duration: 18 },
    Legendary: { max: 2880, duration: 24 },
    Mythical: { max: 3600, duration: 30 },
    Divine: { max: 4320, duration: 36 }
};

const RARITY_COLORS = {
    Common: 0xA0A0A0,
    Rare: 0x3498DB,
    Epic: 0x9B59B6,
    Legendary: 0xE67E22,
    Mythical: 0xE91E63,
    Divine: 0xFFD700
};

const RARITY_TIERS = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine'];

module.exports = {
    PET_ABILITIES,
    EGG_POOLS,
    EGG_DATA,
    HUNGER_CONFIG,
    RARITY_COLORS,
    RARITY_TIERS
};