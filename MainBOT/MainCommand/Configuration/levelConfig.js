/**
 * Level & Experience Configuration
 * 
 * EXP is earned through:
 * - Main Quest completion
 * - Daily quest completion (bonus EXP)
 * - Weekly quest completion (bonus EXP)
 * 
 * Level Unlocks:
 * - Level 5: No reward (just progress)
 * - Level 10: Auto-roll in crate gacha and event gacha
 * - Level 15: .pray mechanic unlocked
 * - Level 20: Trading unlocked
 * - Level 25-40: No extra unlocks
 * - Level 50: Biome system in farming
 * - Level 50-100: No extra unlocks
 * - Level 100: Rebirth eligibility
 */

// ═══════════════════════════════════════════════════════════════════
// EXP REQUIREMENTS
// Formula: floor(BASE_EXP * (SCALE_FACTOR ^ (level - 1)))
// ═══════════════════════════════════════════════════════════════════
const BASE_EXP = 100;
const SCALE_FACTOR = 1.12; // 12% increase per level
const MAX_LEVEL = 100; // Max level before rebirth is required

/**
 * Calculate EXP required for a specific level
 * @param {number} level - Target level (1-100)
 * @returns {number} EXP required to reach that level
 */
function getExpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(BASE_EXP * Math.pow(SCALE_FACTOR, level - 1));
}

/**
 * Calculate total EXP required from level 1 to target level
 * @param {number} level - Target level
 * @returns {number} Total cumulative EXP
 */
function getTotalExpForLevel(level) {
    let total = 0;
    for (let i = 2; i <= level; i++) {
        total += getExpForLevel(i);
    }
    return total;
}

/**
 * Calculate what level a user is at given their total EXP
 * @param {number} totalExp - User's total EXP
 * @returns {{level: number, currentExp: number, expToNext: number, progress: number}}
 */
function getLevelFromExp(totalExp) {
    let level = 1;
    let expUsed = 0;
    
    while (level < MAX_LEVEL) {
        const expNeeded = getExpForLevel(level + 1);
        if (expUsed + expNeeded > totalExp) {
            break;
        }
        expUsed += expNeeded;
        level++;
    }
    
    const currentExp = totalExp - expUsed;
    const expToNext = level >= MAX_LEVEL ? 0 : getExpForLevel(level + 1);
    const progress = expToNext > 0 ? (currentExp / expToNext) * 100 : 100;
    
    return {
        level,
        currentExp,
        expToNext,
        progress: Math.min(100, progress),
        totalExp
    };
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL MILESTONES & REWARDS
// Only specific levels have rewards/unlocks as per design
// ═══════════════════════════════════════════════════════════════════
const LEVEL_MILESTONES = [
    {
        level: 5,
        name: 'Novice Collector',
        rewards: null, // No reward at level 5
        unlocks: [],
        description: 'You\'re starting to understand the basics!'
    },
    {
        level: 10,
        name: 'Apprentice',
        rewards: { coins: 10000, gems: 1000 },
        unlocks: ['🎰 AUTO-ROLL UNLOCKED (Crate & Event Gacha)'],
        description: 'Auto-roll is now available in gacha!'
    },
    {
        level: 15,
        name: 'Devotee',
        rewards: { coins: 25000, gems: 2500 },
        unlocks: ['🙏 PRAY MECHANIC UNLOCKED'],
        description: 'You may now pray at the shrine!'
    },
    {
        level: 20,
        name: 'Trader',
        rewards: { coins: 50000, gems: 5000 },
        unlocks: ['🔄 TRADING UNLOCKED'],
        description: 'You can now trade with other collectors!'
    },
    {
        level: 50,
        name: 'Biome Master',
        rewards: { coins: 500000, gems: 50000 },
        unlocks: ['🌍 BIOME SYSTEM UNLOCKED'],
        description: 'You can now change farming biomes!'
    },
    {
        level: 100,
        name: 'Transcendent',
        rewards: { coins: 1000000, gems: 100000 },
        unlocks: ['♻️ REBIRTH UNLOCKED'],
        description: 'You have reached the pinnacle. Rebirth awaits...'
    }
];

// ═══════════════════════════════════════════════════════════════════
// FEATURE UNLOCK LEVELS
// These are the ONLY levels that unlock features
// ═══════════════════════════════════════════════════════════════════
const FEATURE_UNLOCKS = {
    AUTO_ROLL: 10,        // Auto-roll in crate gacha and event gacha
    PRAY: 15,             // .pray mechanic
    TRADING: 20,          // Trading with other users
    BIOME_SYSTEM: 50,     // Biome selection in farming
    REBIRTH: 100          // Rebirth eligibility
};

/**
 * Check if a user has unlocked a feature
 * @param {number} level - User's current level
 * @param {string} feature - Feature key from FEATURE_UNLOCKS
 * @returns {boolean}
 */
function hasUnlockedFeature(level, feature) {
    const requiredLevel = FEATURE_UNLOCKS[feature];
    if (requiredLevel === undefined) return true; // Unknown feature = unlocked by default
    return level >= requiredLevel;
}

/**
 * Get all features unlocked at or below a level
 * @param {number} level - User's current level
 * @returns {string[]} Array of unlocked feature keys
 */
function getUnlockedFeatures(level) {
    return Object.entries(FEATURE_UNLOCKS)
        .filter(([_, reqLevel]) => level >= reqLevel)
        .map(([feature]) => feature);
}

/**
 * Get locked features for a level
 * @param {number} level - User's current level
 * @returns {Array<{feature: string, level: number}>}
 */
function getLockedFeatures(level) {
    return Object.entries(FEATURE_UNLOCKS)
        .filter(([_, reqLevel]) => level < reqLevel)
        .map(([feature, reqLevel]) => ({ feature, level: reqLevel }))
        .sort((a, b) => a.level - b.level);
}

/**
 * Get next feature unlock info
 * @param {number} level - User's current level
 * @returns {{feature: string, level: number}|null}
 */
function getNextFeatureUnlock(level) {
    const locked = getLockedFeatures(level);
    return locked.length > 0 ? locked[0] : null;
}

/**
 * Get milestone for a specific level (if exists)
 * @param {number} level 
 * @returns {Object|null}
 */
function getMilestoneForLevel(level) {
    return LEVEL_MILESTONES.find(m => m.level === level) || null;
}

/**
 * Get next milestone from current level
 * @param {number} currentLevel 
 * @returns {Object|null}
 */
function getNextMilestone(currentLevel) {
    return LEVEL_MILESTONES.find(m => m.level > currentLevel) || null;
}

/**
 * Get feature name formatted for display
 * @param {string} featureKey 
 * @returns {string}
 */
function getFeatureDisplayName(featureKey) {
    const names = {
        AUTO_ROLL: '🎰 Auto-Roll (Crate & Event Gacha)',
        PRAY: '🙏 Pray Mechanic',
        TRADING: '🔄 Trading',
        BIOME_SYSTEM: '🌍 Biome System',
        REBIRTH: '♻️ Rebirth'
    };
    return names[featureKey] || featureKey;
}

// ═══════════════════════════════════════════════════════════════════
// EXP REWARDS FROM QUESTS
// ═══════════════════════════════════════════════════════════════════
const QUEST_EXP_REWARDS = {
    DAILY_QUEST: 25,           // Per daily quest completed
    WEEKLY_QUEST: 100,         // Per weekly quest completed
    ALL_DAILY_BONUS: 50,       // Bonus for completing all daily quests
    ALL_WEEKLY_BONUS: 200,     // Bonus for completing all weekly quests
    ACHIEVEMENT_BASE: 50,      // Base EXP per achievement milestone
    STREAK_BONUS_PER_DAY: 5    // Extra EXP per streak day (max 50)
};

/**
 * Calculate EXP from completing daily quests
 * @param {number} completed - Number of daily quests completed
 * @param {number} total - Total daily quests
 * @param {number} streak - Current streak
 * @returns {number} Total EXP earned
 */
function calculateDailyQuestExp(completed, total, streak = 0) {
    let exp = completed * QUEST_EXP_REWARDS.DAILY_QUEST;
    
    if (completed >= total) {
        exp += QUEST_EXP_REWARDS.ALL_DAILY_BONUS;
    }
    
    const streakBonus = Math.min(streak * QUEST_EXP_REWARDS.STREAK_BONUS_PER_DAY, 50);
    exp += streakBonus;
    
    return exp;
}

/**
 * Calculate EXP from completing weekly quests
 * @param {number} completed - Number of weekly quests completed
 * @param {number} total - Total weekly quests
 * @returns {number} Total EXP earned
 */
function calculateWeeklyQuestExp(completed, total) {
    let exp = completed * QUEST_EXP_REWARDS.WEEKLY_QUEST;
    
    if (completed >= total) {
        exp += QUEST_EXP_REWARDS.ALL_WEEKLY_BONUS;
    }
    
    return exp;
}

// ═══════════════════════════════════════════════════════════════════
// LEVEL DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════
const LEVEL_TIERS = [
    { min: 1, max: 9, name: 'Beginner', color: '#808080', emoji: '⚪' },
    { min: 10, max: 24, name: 'Intermediate', color: '#00FF00', emoji: '🟢' },
    { min: 25, max: 49, name: 'Advanced', color: '#0080FF', emoji: '🔵' },
    { min: 50, max: 74, name: 'Expert', color: '#8000FF', emoji: '🟣' },
    { min: 75, max: 89, name: 'Master', color: '#FF8000', emoji: '🟠' },
    { min: 90, max: 99, name: 'Grandmaster', color: '#FF0000', emoji: '🔴' },
    { min: 100, max: 100, name: 'Transcendent', color: '#FFD700', emoji: '✨' }
];

/**
 * Get tier info for a level
 * @param {number} level 
 * @returns {{name: string, color: string, emoji: string}}
 */
function getLevelTier(level) {
    return LEVEL_TIERS.find(t => level >= t.min && level <= t.max) || LEVEL_TIERS[0];
}

/**
 * Format level display string
 * @param {number} level 
 * @param {number} rebirth 
 * @returns {string}
 */
function formatLevelDisplay(level, rebirth = 0) {
    const tier = getLevelTier(level);
    const rebirthStr = rebirth > 0 ? ` ♻️${rebirth}` : '';
    return `${tier.emoji} Lv.${level}${rebirthStr}`;
}

module.exports = {
    // Constants
    BASE_EXP,
    SCALE_FACTOR,
    MAX_LEVEL,
    LEVEL_MILESTONES,
    FEATURE_UNLOCKS,
    QUEST_EXP_REWARDS,
    LEVEL_TIERS,
    
    // EXP calculations
    getExpForLevel,
    getTotalExpForLevel,
    getLevelFromExp,
    
    // Feature checks
    hasUnlockedFeature,
    getUnlockedFeatures,
    getLockedFeatures,
    getNextFeatureUnlock,
    getFeatureDisplayName,
    
    // Milestone helpers
    getMilestoneForLevel,
    getNextMilestone,
    
    // Quest EXP calculations
    calculateDailyQuestExp,
    calculateWeeklyQuestExp,
    
    // Display helpers
    getLevelTier,
    formatLevelDisplay
};
