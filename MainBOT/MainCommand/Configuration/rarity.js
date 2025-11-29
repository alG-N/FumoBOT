/**
 * Rarity Configuration
 * All rarity definitions, thresholds, and ordering
 */

const RARITY_PRIORITY = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const SPECIAL_RARITIES = [
    'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 
    'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const ASTRAL_PLUS_RARITIES = [
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

/**
 * Gacha rarity thresholds (used with luck multiplier)
 * Lower threshold = rarer
 */
const GACHA_THRESHOLDS = {
    TRANSCENDENT: 0.0000667,
    ETERNAL: 0.0002667,
    INFINITE: 0.0007667,
    CELESTIAL: 0.0018777,
    ASTRAL: 0.0052107,
    QUESTION: 0.0118767,      // ???
    EXCLUSIVE: 0.0318767,
    MYTHICAL: 0.1318767,
    LEGENDARY: 0.5318767,
    OTHERWORLDLY: 1.5318767,  // Requires FantasyBook
    EPIC: 7.5318767,
    RARE: 17.5318767,
    UNCOMMON: 42.5318767,
    // Common is anything above UNCOMMON
};

/**
 * Event gacha base chances (before boosts)
 */
const EVENT_BASE_CHANCES = {
    EPIC: 86.3899,
    LEGENDARY: 13.5,
    MYTHICAL: 0.1,
    QUESTION: 0.01,           // ???
    TRANSCENDENT: 0.0001
};

/**
 * Pity system thresholds
 */
const PITY_THRESHOLDS = {
    TRANSCENDENT: 1_500_000,
    ETERNAL: 500_000,
    INFINITE: 200_000,
    CELESTIAL: 90_000,
    ASTRAL: 30_000,
    // Event gacha pity
    EVENT_MYTHICAL: 1000,
    EVENT_QUESTION: 10000
};

/**
 * Coin rewards for selling fumos
 */
const SELL_REWARDS = {
    Common: 20,
    UNCOMMON: 50,
    RARE: 70,
    EPIC: 150,
    OTHERWORLDLY: 300,
    LEGENDARY: 1300,
    MYTHICAL: 7000
};

/**
 * Shiny and AlterGolden chances
 */
const SHINY_CONFIG = {
    BASE_CHANCE: 0.01,        // 1% base
    LUCK_BONUS: 0.02,         // +2% per luck point
    ALG_BASE_CHANCE: 0.00001, // 0.001% base
    ALG_LUCK_BONUS: 0.00009,  // +0.009% per luck point
    ALG_MULTIPLIER: 150,      // alG sells for 150x
    SHINY_MULTIPLIER: 2       // Shiny sells for 2x
};

/**
 * Compare two rarities
 * @param {string} r1 - First rarity
 * @param {string} r2 - Second rarity
 * @returns {boolean} True if r1 is rarer than r2
 */
function isRarer(r1, r2) {
    const idx1 = RARITY_PRIORITY.indexOf(r1?.toUpperCase() ?? '');
    const idx2 = RARITY_PRIORITY.indexOf(r2?.toUpperCase() ?? '');
    return idx1 > idx2;
}

/**
 * Compare two fumos by rarity, then name
 * @param {Object} a - First fumo {name, rarity}
 * @param {Object} b - Second fumo {name, rarity}
 * @returns {number} Sort order
 */
function compareFumos(a, b) {
    const rarityA = RARITY_PRIORITY.indexOf(a.rarity?.toUpperCase() ?? 'COMMON');
    const rarityB = RARITY_PRIORITY.indexOf(b.rarity?.toUpperCase() ?? 'COMMON');
    if (rarityA !== rarityB) return rarityA - rarityB;
    return a.name.localeCompare(b.name);
}

/**
 * Get rarity index (0 = Common, higher = rarer)
 */
function getRarityIndex(rarity) {
    return RARITY_PRIORITY.indexOf(rarity?.toUpperCase() ?? 'COMMON');
}

module.exports = {
    RARITY_PRIORITY,
    SPECIAL_RARITIES,
    ASTRAL_PLUS_RARITIES,
    GACHA_THRESHOLDS,
    EVENT_BASE_CHANCES,
    PITY_THRESHOLDS,
    SELL_REWARDS,
    SHINY_CONFIG,
    
    // Helper functions
    isRarer,
    compareFumos,
    getRarityIndex
};