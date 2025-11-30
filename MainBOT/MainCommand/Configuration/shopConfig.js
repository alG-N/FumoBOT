const RARITY_ICONS = {
    Basic: "⚪",
    Common: "🟩",
    Rare: "🟦",
    Epic: "🟨",
    Legendary: "🟪",
    Mythical: "🟥",
    Divine: "⭐",
    "???": "⬛"
};

const RARITY_THRESHOLDS = {
    Basic: [0.01, 0.1, 0.4, 1.0],
    Common: [0.005, 0.05, 0.25, 1.0],
    Rare: [0.005, 0.03, 0.12, 0.3],
    Epic: [0.005, 0.02, 0.08, 0.2],
    Legendary: [0.005, 0.015, 0.05, 0.15],
    Mythical: [0.005, 0.01, 0.03, 0.1],
    Divine: [0.003, 0.008, 0.02, 0.08],
    '???': [0.005]
};

const STOCK_RANGES = {
    BASIC: [30, 100],
    LEGENDARY: [15, 30],
    LOTS: [3, 15],
    ON_STOCK: [1, 3],
    MYSTERY: [1, 2]
};

const ITEM_DEFINITIONS = [
    { name: 'PetFoob(B)', basePrice: 2500, currency: 'coins', rarity: 'Basic' },
    { name: 'Stone(B)', basePrice: 100, currency: 'coins', rarity: 'Basic' },
    { name: 'Stick(B)', basePrice: 50, currency: 'coins', rarity: 'Basic' },
    { name: 'UniqueRock(C)', basePrice: 3500, currency: 'gems', rarity: 'Common' },
    { name: 'Books(C)', basePrice: 2500, currency: 'coins', rarity: 'Common' },
    { name: 'Wool(C)', basePrice: 1050, currency: 'coins', rarity: 'Common' },
    { name: 'Wood(C)', basePrice: 750, currency: 'coins', rarity: 'Common' },
    { name: 'Dice(C)', basePrice: 500, currency: 'coins', rarity: 'Common' },
    { name: 'FragmentOf1800s(R)', basePrice: 15000, currency: 'gems', rarity: 'Rare' },
    { name: 'WeirdGrass(R)', basePrice: 10000, currency: 'gems', rarity: 'Rare' },
    { name: 'EnhancedScroll(E)', basePrice: 35000, currency: 'gems', rarity: 'Epic' },
    { name: 'RustedCore(E)', basePrice: 125000, currency: 'coins', rarity: 'Epic' },
    { name: 'RedShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
    { name: 'BlueShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
    { name: 'YellowShard(L)', basePrice: 75000, currency: 'gems', rarity: 'Legendary' },
    { name: 'WhiteShard(L)', basePrice: 135000, currency: 'gems', rarity: 'Legendary' },
    { name: 'DarkShard(L)', basePrice: 135000, currency: 'gems', rarity: 'Legendary' },
    { name: 'ChromaShard(M)', basePrice: 500000, currency: 'gems', rarity: 'Mythical' },
    { name: 'MonoShard(M)', basePrice: 500000, currency: 'gems', rarity: 'Mythical' },
    { name: 'EquinoxAlloy(M)', basePrice: 1000000, currency: 'gems', rarity: 'Mythical' },
    { name: 'CelestialEssence(D)', basePrice: 2500000, currency: 'gems', rarity: 'Divine' },
    { name: 'DivineOrb(D)', basePrice: 5000000, currency: 'gems', rarity: 'Divine' },
    { name: 'GoldenSigil(?)', basePrice: 100000000, currency: 'coins', rarity: '???' },
    { name: 'Undefined(?)', basePrice: 7557575, currency: 'gems', rarity: '???' },
    { name: 'Null?(?)', basePrice: 91991919, currency: 'coins', rarity: '???' }
];

const REROLL_COOLDOWN = 3 * 60 * 60 * 1000;
const MAX_REROLLS = 5;

module.exports = {
    RARITY_ICONS,
    RARITY_THRESHOLDS,
    STOCK_RANGES,
    ITEM_DEFINITIONS,
    REROLL_COOLDOWN,
    MAX_REROLLS
};