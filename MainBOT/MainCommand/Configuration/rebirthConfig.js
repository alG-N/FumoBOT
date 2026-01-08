/**
 * Rebirth System Configuration
 * 
 * Rebirth allows players who reach Level 100 to reset their progress
 * in exchange for permanent multiplier bonuses.
 * 
 * Requirements:
 * - Level 100 for each rebirth
 * - Rebirth 1 = Level 100
 * - Rebirth 2 = Level 100 (after rebirth 1)
 * - etc.
 * 
 * Rewards per Rebirth:
 * - Permanent coin/gem multiplier: 1 + (rebirth * 0.25)
 *   - Rebirth 1: x1.25
 *   - Rebirth 2: x1.5 (cumulative effect)
 *   - Rebirth 3: x1.75
 *   - etc.
 * - Keep ONE rarest fumo of your choice
 * - Unlock special features
 */

// Rebirth Requirements
const REBIRTH_LEVEL_REQUIREMENT = 100;

/**
 * Check if user can perform rebirth
 * @param {number} level - Current level
 * @returns {boolean}
 */
function canRebirth(level) {
    return level >= REBIRTH_LEVEL_REQUIREMENT;
}

// Rebirth Multipliers - Formula: 1 + (rebirth * MULTIPLIER_PER_REBIRTH)
const MULTIPLIER_PER_REBIRTH = 0.25;
const MAX_REBIRTH = 50; // Soft cap for display purposes

/**
 * Calculate the multiplier for a rebirth count
 * @param {number} rebirth - Current rebirth count
 * @returns {number} Multiplier (e.g., 1.25 for rebirth 1)
 */
function getRebirthMultiplier(rebirth) {
    if (rebirth <= 0) return 1;
    return 1 + (rebirth * MULTIPLIER_PER_REBIRTH);
}

/**
 * Get cumulative multiplier effect description
 * @param {number} rebirth 
 * @returns {string}
 */
function getMultiplierDescription(rebirth) {
    const mult = getRebirthMultiplier(rebirth);
    return `x${mult.toFixed(2)} Coins & Gems`;
}

// Rebirth Milestones & Special Unlocks
const REBIRTH_MILESTONES = [
    {
        rebirth: 1,
        name: 'First Rebirth',
        unlocks: ['🌍 Other Place (send extra fumos)'],
        bonus: 'Permanent x1.25 multiplier',
        title: 'Reborn',
        titleEmoji: '♻️',
        rewards: { coins: 5000, gems: 50 }
    },
    {
        rebirth: 3,
        name: 'Triple Rebirth',
        unlocks: ['Special rebirth shop items'],
        bonus: 'Permanent x1.75 multiplier',
        title: 'Experienced',
        titleEmoji: '🔄',
        rewards: { coins: 15000, gems: 150 }
    },
    {
        rebirth: 5,
        name: 'Veteran',
        unlocks: ['Exclusive rebirth banner'],
        bonus: 'Permanent x2.25 multiplier',
        title: 'Veteran',
        titleEmoji: '⭐',
        rewards: { coins: 30000, gems: 300 }
    },
    {
        rebirth: 10,
        name: 'Legendary Rebirth',
        unlocks: ['Legendary rebirth cosmetics'],
        bonus: 'Permanent x3.5 multiplier',
        title: 'Legend',
        titleEmoji: '🌟',
        rewards: { coins: 75000, gems: 750 }
    },
    {
        rebirth: 20,
        name: 'Mythical Rebirth',
        unlocks: ['Mythical rebirth effects'],
        bonus: 'Permanent x6.0 multiplier',
        title: 'Myth',
        titleEmoji: '✨',
        rewards: { coins: 200000, gems: 2000 }
    },
    {
        rebirth: 50,
        name: 'Transcendent Rebirth',
        unlocks: ['Ultimate prestige'],
        bonus: 'Permanent x13.5 multiplier',
        title: 'Transcendent',
        titleEmoji: '💫',
        rewards: { coins: 1000000, gems: 10000 }
    }
];

/**
 * Get rebirth milestone info
 * @param {number} rebirth 
 * @returns {Object|null}
 */
function getRebirthMilestone(rebirth) {
    return REBIRTH_MILESTONES.find(m => m.rebirth === rebirth);
}

/**
 * Get next rebirth milestone
 * @param {number} currentRebirth 
 * @returns {Object|null}
 */
function getNextRebirthMilestone(currentRebirth) {
    return REBIRTH_MILESTONES.find(m => m.rebirth > currentRebirth);
}

/**
 * Get player title based on rebirth
 * @param {number} rebirth 
 * @returns {{title: string, emoji: string}}
 */
function getRebirthTitle(rebirth) {
    // Find highest milestone achieved
    const achieved = REBIRTH_MILESTONES
        .filter(m => m.rebirth <= rebirth)
        .sort((a, b) => b.rebirth - a.rebirth)[0];
    
    if (!achieved) {
        return { title: 'Newcomer', emoji: '🌱' };
    }
    
    return { title: achieved.title, emoji: achieved.titleEmoji };
}

// Feature Unlocks By Rebirth
const REBIRTH_FEATURE_UNLOCKS = {
    OTHER_PLACE: 1,        // Send extra fumos to earn passive income
    REBIRTH_SHOP: 3,       // Access to rebirth-exclusive shop
    REBIRTH_BANNER: 5,     // Access to rebirth-exclusive banner
    REBIRTH_COSMETICS: 10, // Rebirth cosmetic effects
    PRESTIGE_EFFECTS: 20   // Ultimate prestige visual effects
};

/**
 * Check if a rebirth feature is unlocked
 * @param {number} rebirth 
 * @param {string} feature 
 * @returns {boolean}
 */
function hasRebirthFeature(rebirth, feature) {
    const required = REBIRTH_FEATURE_UNLOCKS[feature];
    if (!required) return true;
    return rebirth >= required;
}

// Reset Configuration - What gets reset during rebirth
const RESET_CONFIG = {
    // Currency - RESET
    resetCoins: true,
    resetGems: true,
    resetSpiritTokens: true,
    
    // Inventory - RESET (except 1 chosen fumo)
    resetInventory: true,
    keepOneFumo: true,
    
    // Farm - RESET
    resetFarmingFumos: true,
    resetBuildings: true,
    
    // Market - RESET
    clearMarketListings: true,
    
    // Boosts - RESET
    clearActiveBoosts: true,
    
    // Level/EXP - RESET
    resetLevel: true,
    resetExp: true,
    
    // Stats - KEEP (for tracking)
    keepTotalRolls: true,
    keepWinsLosses: true,
    
    // Quests - PARTIAL
    resetDailyQuests: true,
    resetWeeklyQuests: true,
    keepMainQuestProgress: true,  // Main quest progress persists
    keepAchievements: true,       // Achievements persist
    
    // Other - KEEP
    keepRebirth: true,           // Obviously
    keepPets: false,             // Pets reset
    keepPrayerProgress: false,   // Prayer resets
    
    // Items - RESET
    resetItems: true
};

/**
 * Get a summary of what will be reset
 * @returns {string[]}
 */
function getResetSummary() {
    return [
        '💰 All Coins & Gems',
        '🌸 Spirit Tokens',
        '📦 All Fumos (except 1 you choose)',
        '🌾 All Farming Fumos',
        '🏗️ All Buildings (reset to Lv.0)',
        '📈 Level & EXP (back to Lv.1)',
        '💹 Active Market Listings',
        '⚡ Active Boosts',
        '🐾 Pets & Eggs',
        '🙏 Prayer Progress',
        '📋 Daily/Weekly Quest Progress',
        '📦 Items'
    ];
}

/**
 * Get what is preserved during rebirth
 * @returns {string[]}
 */
function getPreservedSummary() {
    return [
        '♻️ Rebirth Count (+1)',
        '💫 Rebirth Multiplier (permanent)',
        '⭐ One Fumo of Your Choice',
        '📜 Main Quest Progress',
        '🏆 Achievements',
        '📊 Lifetime Statistics'
    ];
}

// Rarity Priority For Fumo Selection
const RARITY_PRIORITY = [
    'TRANSCENDENT',
    'ETERNAL',
    'INFINITE',
    'CELESTIAL',
    'ASTRAL',
    '???',
    'EXCLUSIVE',
    'MYTHICAL',
    'LEGENDARY',
    'OTHERWORLDLY',
    'EPIC',
    'RARE',
    'UNCOMMON',
    'Common'
];

/**
 * Sort fumos by rarity (highest first)
 * @param {Object[]} fumos 
 * @returns {Object[]}
 */
function sortFumosByRarity(fumos) {
    return fumos.sort((a, b) => {
        const aIdx = RARITY_PRIORITY.indexOf(a.rarity);
        const bIdx = RARITY_PRIORITY.indexOf(b.rarity);
        
        // Unknown rarities go to end
        const aPriority = aIdx === -1 ? 999 : aIdx;
        const bPriority = bIdx === -1 ? 999 : bIdx;
        
        return aPriority - bPriority;
    });
}

// Display Helpers
const REBIRTH_COLORS = {
    0: '#808080',     // Gray - No rebirth
    1: '#00FF00',     // Green
    3: '#0080FF',     // Blue
    5: '#8000FF',     // Purple
    10: '#FFD700',    // Gold
    20: '#FF4500',    // Orange-Red
    50: '#FF00FF'     // Magenta
};

/**
 * Get color for rebirth display
 * @param {number} rebirth 
 * @returns {string}
 */
function getRebirthColor(rebirth) {
    const keys = Object.keys(REBIRTH_COLORS).map(Number).sort((a, b) => b - a);
    for (const threshold of keys) {
        if (rebirth >= threshold) {
            return REBIRTH_COLORS[threshold];
        }
    }
    return REBIRTH_COLORS[0];
}

/**
 * Format rebirth display string
 * @param {number} rebirth 
 * @returns {string}
 */
function formatRebirthDisplay(rebirth) {
    if (rebirth <= 0) return 'No Rebirths';
    const title = getRebirthTitle(rebirth);
    return `${title.emoji} Rebirth ${rebirth} (${title.title})`;
}

module.exports = {
    // Constants
    REBIRTH_LEVEL_REQUIREMENT,
    MULTIPLIER_PER_REBIRTH,
    MAX_REBIRTH,
    REBIRTH_MILESTONES,
    REBIRTH_FEATURE_UNLOCKS,
    RESET_CONFIG,
    RARITY_PRIORITY,
    REBIRTH_COLORS,
    
    // Functions
    canRebirth,
    getRebirthMultiplier,
    getMultiplierDescription,
    getRebirthMilestone,
    getNextRebirthMilestone,
    getRebirthTitle,
    hasRebirthFeature,
    getResetSummary,
    getPreservedSummary,
    sortFumosByRarity,
    getRebirthColor,
    formatRebirthDisplay
};
