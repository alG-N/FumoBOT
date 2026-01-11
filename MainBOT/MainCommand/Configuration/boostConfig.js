const BOOST_TYPES = {
    COIN: 'coin',
    GEM: 'gem',
    LUCK: 'luck',
    LUCK_EVERY_10: 'luckEvery10',
    SELL_PENALTY: 'sellPenalty',
    RARITY_OVERRIDE: 'rarityOverride',
    SUMMON_COOLDOWN: 'summonCooldown',
    SUMMON_SPEED: 'summonSpeed',
    YUYUKO_ROLLS: 'yuyukoRolls',
    // Tier 6 special types
    VOID_TRAIT: 'voidTrait',
    GLITCHED_TRAIT: 'glitchedTrait',
    TRAIT_LUCK: 'traitLuck',
    ROLL_SPEED: 'rollSpeed',
    // S!gil types
    SELL_VALUE: 'sell',
    REIMU_LUCK: 'reimuLuck',
    ASTRAL_BLOCK: 'astralBlock',
    NULLIFIED_ROLLS: 'nullifiedRolls'
};

const BOOST_CATEGORIES = {
    [BOOST_TYPES.COIN]: { name: '🪙 Coin Boosts', emoji: '💰', order: 1 },
    [BOOST_TYPES.GEM]: { name: '💎 Gem Boosts', emoji: '💎', order: 2 },
    [BOOST_TYPES.LUCK]: { name: '🍀 Luck Boosts', emoji: '🍀', order: 3 },
    [BOOST_TYPES.LUCK_EVERY_10]: { name: '🎲 Luck (Every 10)', emoji: '🎲', order: 4 },
    [BOOST_TYPES.SUMMON_COOLDOWN]: { name: '⏱️ Cooldown Reductions', emoji: '⏱️', order: 5 },
    [BOOST_TYPES.SUMMON_SPEED]: { name: '⚡ Summon Speed', emoji: '⚡', order: 6 },
    [BOOST_TYPES.RARITY_OVERRIDE]: { name: '🎯 Rarity Override', emoji: '🎯', order: 7 },
    [BOOST_TYPES.SELL_PENALTY]: { name: '⚠️ Debuffs', emoji: '⚠️', order: 8 },
    [BOOST_TYPES.YUYUKO_ROLLS]: { name: '🌸 Yuyuko Rolls', emoji: '🌸', order: 9 },
    // Tier 6 & S!gil special
    special: { name: '🔮 Special Effects', emoji: '✨', order: 10 }
};

const SPECIAL_SOURCES = {
    MYSTERIOUS_DICE: 'MysteriousDice',
    TIME_CLOCK: 'TimeClock',
    SGIL: 'S!gil',
    GOLDEN_SIGIL: 'GoldenSigil',
    // Tier 6 sources
    VOID_CRYSTAL: 'VoidCrystal',
    CRYSTAL_SIGIL: 'CrystalSigil',
    ETERNAL_ESSENCE: 'EternalEssence',
    COSMIC_CORE: 'CosmicCore'
};

const BOOST_COLORS = {
    DEFAULT: 0xFFD700,
    COIN: 0xFFD700,
    GEM: 0x00FFFF,
    LUCK: 0x00FF00,
    COOLDOWN: 0x3498DB,
    DEBUFF: 0xFF0000,
    YUYUKO: 0xFF69B4
};

module.exports = {
    BOOST_TYPES,
    BOOST_CATEGORIES,
    SPECIAL_SOURCES,
    BOOST_COLORS
};