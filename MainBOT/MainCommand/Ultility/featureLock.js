/**
 * Feature Lock Utility
 * 
 * Centralized utility for checking if users have access to features
 * based on their level, rebirth level, and other requirements.
 * 
 * Use this utility in command handlers to prevent unauthorized access.
 */

const { EmbedBuilder } = require('discord.js');
const { FEATURE_UNLOCKS, getFeatureDisplayName, isFeatureUnlocked } = require('../Configuration/levelConfig');

// Lazy-load services to avoid circular dependencies
let LevelDatabaseService = null;
let RebirthDatabaseService = null;

function getLevelService() {
    if (!LevelDatabaseService) {
        try {
            LevelDatabaseService = require('../Service/UserDataService/LevelService/LevelDatabaseService');
        } catch (e) {
            console.error('[FeatureLock] Could not load LevelDatabaseService:', e.message);
        }
    }
    return LevelDatabaseService;
}

function getRebirthService() {
    if (!RebirthDatabaseService) {
        try {
            RebirthDatabaseService = require('../Service/UserDataService/RebirthService/RebirthDatabaseService');
        } catch (e) {
            console.error('[FeatureLock] Could not load RebirthDatabaseService:', e.message);
        }
    }
    return RebirthDatabaseService;
}

/**
 * Feature requirement definitions
 */
const FEATURE_REQUIREMENTS = {
    AUTO_ROLL: {
        level: FEATURE_UNLOCKS.AUTO_ROLL,
        rebirth: 0,
        name: 'Auto-Roll (Crate & Event Gacha)',
        description: 'Use auto-roll feature in crate and event gacha'
    },
    PRAY: {
        level: FEATURE_UNLOCKS.PRAY,
        rebirth: 0,
        name: 'Pray Mechanic',
        description: 'Access the pray command for special blessings'
    },
    TRADING: {
        level: FEATURE_UNLOCKS.TRADING,
        rebirth: 0,
        name: 'Trading',
        description: 'Trade fumos with other players'
    },
    BIOME_SYSTEM: {
        level: FEATURE_UNLOCKS.BIOME_SYSTEM,
        rebirth: 0,
        name: 'Biome System',
        description: 'Change your farming biome for different bonuses'
    },
    REBIRTH: {
        level: FEATURE_UNLOCKS.REBIRTH,
        rebirth: 0,
        name: 'Rebirth',
        description: 'Reset your progress for permanent bonuses'
    }
};

/**
 * Check if a user has access to a feature
 * @param {string} userId 
 * @param {string} featureName - Feature key from FEATURE_REQUIREMENTS
 * @returns {Promise<{allowed: boolean, reason?: string, requirements?: Object}>}
 */
async function checkFeatureAccess(userId, featureName) {
    const feature = FEATURE_REQUIREMENTS[featureName];
    if (!feature) {
        return { allowed: true }; // Unknown features are allowed by default
    }
    
    try {
        const levelService = getLevelService();
        const rebirthService = getRebirthService();
        
        // Get user's current level
        let userLevel = 1;
        if (levelService) {
            const levelData = await levelService.getUserLevel(userId);
            userLevel = levelData?.level || 1;
        }
        
        // Get user's rebirth level
        let rebirthLevel = 0;
        if (rebirthService && feature.rebirth > 0) {
            const rebirthData = await rebirthService.getUserRebirthProgress(userId);
            rebirthLevel = rebirthData?.rebirthLevel || 0;
        }
        
        // Check level requirement
        if (userLevel < feature.level) {
            return {
                allowed: false,
                reason: `You need to be **Level ${feature.level}** to use ${feature.name}.`,
                requirements: {
                    currentLevel: userLevel,
                    requiredLevel: feature.level,
                    feature: featureName
                }
            };
        }
        
        // Check rebirth requirement
        if (rebirthLevel < feature.rebirth) {
            return {
                allowed: false,
                reason: `You need **Rebirth ${feature.rebirth}** to use ${feature.name}.`,
                requirements: {
                    currentRebirth: rebirthLevel,
                    requiredRebirth: feature.rebirth,
                    feature: featureName
                }
            };
        }
        
        return { allowed: true };
    } catch (error) {
        console.error(`[FeatureLock] Error checking feature access:`, error);
        // On error, allow access (fail open for better UX)
        return { allowed: true };
    }
}

/**
 * Check multiple features at once
 * @param {string} userId 
 * @param {string[]} featureNames 
 * @returns {Promise<Object>} Map of feature name to access result
 */
async function checkMultipleFeatures(userId, featureNames) {
    const results = {};
    
    // Get user level and rebirth once
    const levelService = getLevelService();
    const rebirthService = getRebirthService();
    
    let userLevel = 1;
    let rebirthLevel = 0;
    
    try {
        if (levelService) {
            const levelData = await levelService.getUserLevel(userId);
            userLevel = levelData?.level || 1;
        }
        
        if (rebirthService) {
            const rebirthData = await rebirthService.getUserRebirthProgress(userId);
            rebirthLevel = rebirthData?.rebirthLevel || 0;
        }
    } catch (error) {
        console.error('[FeatureLock] Error getting user data:', error);
    }
    
    for (const featureName of featureNames) {
        const feature = FEATURE_REQUIREMENTS[featureName];
        if (!feature) {
            results[featureName] = { allowed: true };
            continue;
        }
        
        if (userLevel < feature.level) {
            results[featureName] = {
                allowed: false,
                reason: `Level ${feature.level} required`,
                requirements: { currentLevel: userLevel, requiredLevel: feature.level }
            };
        } else if (rebirthLevel < feature.rebirth) {
            results[featureName] = {
                allowed: false,
                reason: `Rebirth ${feature.rebirth} required`,
                requirements: { currentRebirth: rebirthLevel, requiredRebirth: feature.rebirth }
            };
        } else {
            results[featureName] = { allowed: true };
        }
    }
    
    return results;
}

/**
 * Create a "feature locked" embed for display
 * @param {string} featureName 
 * @param {Object} requirements 
 * @returns {EmbedBuilder}
 */
function createFeatureLockedEmbed(featureName, requirements) {
    const feature = FEATURE_REQUIREMENTS[featureName] || {
        name: featureName,
        description: 'This feature'
    };
    
    const embed = new EmbedBuilder()
        .setTitle('🔒 Feature Locked')
        .setColor(0xFF6B6B)
        .setDescription(`${feature.description} is not available yet.`);
    
    if (requirements.requiredLevel && requirements.currentLevel) {
        embed.addFields({
            name: '📊 Level Requirement',
            value: `Current: **${requirements.currentLevel}** | Required: **${requirements.requiredLevel}**\n` +
                   `Need ${requirements.requiredLevel - requirements.currentLevel} more level(s)`,
            inline: false
        });
    }
    
    if (requirements.requiredRebirth && requirements.currentRebirth !== undefined) {
        embed.addFields({
            name: '🔄 Rebirth Requirement',
            value: `Current: **${requirements.currentRebirth}** | Required: **${requirements.requiredRebirth}**`,
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Complete quests and gain EXP to level up!' });
    
    return embed;
}

/**
 * Middleware-style function to check access before running a command
 * Returns null if access is granted, or an embed if access is denied
 * @param {string} userId 
 * @param {string} featureName 
 * @returns {Promise<EmbedBuilder|null>}
 */
async function requireFeature(userId, featureName) {
    const result = await checkFeatureAccess(userId, featureName);
    
    if (!result.allowed) {
        return createFeatureLockedEmbed(featureName, result.requirements || {});
    }
    
    return null; // Access granted
}

/**
 * Get list of all features with their unlock status for a user
 * @param {string} userId 
 * @returns {Promise<Object[]>}
 */
async function getUserFeatureStatus(userId) {
    const featureNames = Object.keys(FEATURE_REQUIREMENTS);
    const results = await checkMultipleFeatures(userId, featureNames);
    
    return Object.entries(FEATURE_REQUIREMENTS).map(([key, feature]) => ({
        key,
        name: feature.name,
        description: feature.description,
        requiredLevel: feature.level,
        requiredRebirth: feature.rebirth,
        unlocked: results[key]?.allowed || false
    }));
}

module.exports = {
    FEATURE_REQUIREMENTS,
    checkFeatureAccess,
    checkMultipleFeatures,
    createFeatureLockedEmbed,
    requireFeature,
    getUserFeatureStatus
};
