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

const GACHA_THRESHOLDS = {
    TRANSCENDENT: 0.0000667,
    ETERNAL: 0.0002667,
    INFINITE: 0.0007667,
    CELESTIAL: 0.0018777,
    ASTRAL: 0.0052107,
    QUESTION: 0.0118767,    
    EXCLUSIVE: 0.0318767,
    MYTHICAL: 0.1318767,
    LEGENDARY: 0.5318767,
    OTHERWORLDLY: 1.5318767, 
    EPIC: 7.5318767,
    RARE: 17.5318767,
    UNCOMMON: 42.5318767,
};

// Event Banner Base Chances (New Year 2026)
const EVENT_BASE_CHANCES = {
    Common: 49,           // 49%
    UNCOMMON: 30,         // 30%
    RARE: 20,             // 20%
    QUESTION: 1,          // 1%
    TRANSCENDENT: 0.000000001  // 1 in 1 billion
};

const PITY_THRESHOLDS = {
    TRANSCENDENT: 1_500_000,
    ETERNAL: 500_000,
    INFINITE: 200_000,
    CELESTIAL: 90_000,
    ASTRAL: 30_000,
    EVENT_MYTHICAL: 1000,
    EVENT_QUESTION: 10000
};

const SELL_REWARDS = {
    Common: 20,
    UNCOMMON: 50,
    RARE: 70,
    EPIC: 150,
    OTHERWORLDLY: 300,
    LEGENDARY: 1300,
    MYTHICAL: 7000
};

const SHINY_CONFIG = {
    BASE_CHANCE: 0.01,    
    LUCK_BONUS: 0.02,      
    ALG_BASE_CHANCE: 0.00001, 
    ALG_LUCK_BONUS: 0.00009,  
    ALG_MULTIPLIER: 150,     
    SHINY_MULTIPLIER: 2    
};

/**
 * Variant Configuration
 * 
 * Variants are mutually exclusive - only ONE variant per fumo
 * Priority order (highest to lowest):
 *   1. GLITCHED (requires active boost from S!gil or CosmicCore)
 *   2. VOID (requires active boost from VoidCrystal)
 *   3. alG (base variant, very rare)
 *   4. SHINY (base variant, rare)
 * 
 * Examples:
 *   - Reimu(Common) - no variant
 *   - Reimu(Common)[✨SHINY] - SHINY variant
 *   - Reimu(Common)[🌟alG] - alG variant
 *   - Reimu(Common)[🔮GLITCHED] - GLITCHED variant
 *   - Reimu(Common)[🌀VOID] - VOID variant
 */
const VARIANT_CONFIG = {
    TAGS: {
        SHINY: '[✨SHINY]',
        ALG: '[🌟alG]',
        GLITCHED: '[🔮GLITCHED]',
        VOID: '[🌀VOID]'
    },
    EMOJI: {
        SHINY: '✨',
        ALG: '🌟',
        GLITCHED: '🔮',
        VOID: '🌀'
    },
    // Priority order for variant rolling (higher = checked first)
    PRIORITY: ['GLITCHED', 'VOID', 'ALG', 'SHINY'],
    // Base multipliers for sell value
    MULTIPLIERS: {
        SHINY: 2,
        ALG: 150,
        GLITCHED: 500,
        VOID: 100
    }
};

// Gacha Constants (formerly from constants.js)
const GACHA_CONSTANTS = {
    COST: 100,
    COOLDOWN: 4000,
    BOOST_CHARGE_MAX: 1000,
    BOOST_ACTIVE_ROLLS: 250,
    BOOST_MULTIPLIER: 25,
    BONUS_ROLL_MULTIPLIER: 2,
    PASSIVE_COINS: 150,
    PASSIVE_GEMS: 50,
    INCOME_INTERVAL: 5000,
    EVENT_ROLL_LIMIT: 50000,
    EVENT_WINDOW_MS: 30 * 60 * 1000
};

// Channel IDs for logging
const LOG_CHANNELS = {
    LOG_CHANNEL_ID: '1411386632589807719',
    BACKUP_CHANNEL_ID: '1367500981809447054'
};

function isRarer(r1, r2) {
    const idx1 = RARITY_PRIORITY.indexOf(r1?.toUpperCase() ?? '');
    const idx2 = RARITY_PRIORITY.indexOf(r2?.toUpperCase() ?? '');
    return idx1 > idx2;
}

function compareFumos(a, b) {
    const rarityA = RARITY_PRIORITY.indexOf(a.rarity?.toUpperCase() ?? 'COMMON');
    const rarityB = RARITY_PRIORITY.indexOf(b.rarity?.toUpperCase() ?? 'COMMON');
    if (rarityA !== rarityB) return rarityA - rarityB;
    return a.name.localeCompare(b.name);
}

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
    VARIANT_CONFIG,
    GACHA_CONSTANTS,
    LOG_CHANNELS,
    
    isRarer,
    compareFumos,
    getRarityIndex,

    // Legacy exports for backward compatibility with constants.js
    GACHA_COST: GACHA_CONSTANTS.COST,
    GACHA_COOLDOWN: GACHA_CONSTANTS.COOLDOWN,
    RARITY_THRESHOLDS: GACHA_THRESHOLDS,
    PITY: PITY_THRESHOLDS,
    BOOST_CHARGE_MAX: GACHA_CONSTANTS.BOOST_CHARGE_MAX,
    BOOST_ACTIVE_ROLLS: GACHA_CONSTANTS.BOOST_ACTIVE_ROLLS,
    BOOST_MULTIPLIER: GACHA_CONSTANTS.BOOST_MULTIPLIER,
    BONUS_ROLL_MULTIPLIER: GACHA_CONSTANTS.BONUS_ROLL_MULTIPLIER,
    PASSIVE_COINS: GACHA_CONSTANTS.PASSIVE_COINS,
    PASSIVE_GEMS: GACHA_CONSTANTS.PASSIVE_GEMS,
    INCOME_INTERVAL: GACHA_CONSTANTS.INCOME_INTERVAL,
    SHINY_BASE_CHANCE: SHINY_CONFIG.BASE_CHANCE,
    SHINY_LUCK_BONUS: SHINY_CONFIG.LUCK_BONUS,
    ALG_BASE_CHANCE: SHINY_CONFIG.ALG_BASE_CHANCE,
    ALG_LUCK_BONUS: SHINY_CONFIG.ALG_LUCK_BONUS,
    EVENT_ROLL_LIMIT: GACHA_CONSTANTS.EVENT_ROLL_LIMIT,
    EVENT_WINDOW_MS: GACHA_CONSTANTS.EVENT_WINDOW_MS,
    EVENT_MYTHICAL_PITY: PITY_THRESHOLDS.EVENT_MYTHICAL,
    EVENT_QUESTION_PITY: PITY_THRESHOLDS.EVENT_QUESTION,
    LOG_CHANNEL_ID: LOG_CHANNELS.LOG_CHANNEL_ID,
    BACKUP_CHANNEL_ID: LOG_CHANNELS.BACKUP_CHANNEL_ID
};