const { EmbedBuilder, Colors } = require('discord.js');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION LOADING (uses existing MainCommand configs)
// ═══════════════════════════════════════════════════════════════

let maintenanceConfig = null;
let banService = null;

// Developer ID fallback
const DEVELOPER_ID = "1128296349566251068";

/**
 * Load maintenance config (handles both Main and Sub)
 */
function loadMaintenanceConfig() {
    if (maintenanceConfig) return maintenanceConfig;
    
    try {
        maintenanceConfig = require(path.join(__dirname, '../../MainCommand/Configuration/maintenanceConfig.js'));
    } catch (err) {
        console.log('[AccessControl] Could not load maintenance config:', err.message);
        maintenanceConfig = {
            developerID: DEVELOPER_ID,
            getSystemState: () => ({ enabled: false }),
            canBypassMaintenance: (userId) => userId === DEVELOPER_ID,
            isFeatureDisabled: () => false
        };
    }
    return maintenanceConfig;
}

/**
 * Load ban service
 */
function loadBanService() {
    if (banService) return banService;
    
    try {
        banService = require(path.join(__dirname, '../../MainCommand/Administrator/Service/BanService.js'));
    } catch (err) {
        console.log('[AccessControl] Could not load BanService:', err.message);
        banService = {
            isBanned: () => null
        };
    }
    return banService;
}

// ═══════════════════════════════════════════════════════════════
// ACCESS TYPES
// ═══════════════════════════════════════════════════════════════

const AccessType = {
    MAIN: 'main',      // MainCommand (Fumo game, trading, etc.)
    SUB: 'sub',        // SubCommand (Reddit, Anime, Music, Video, etc.)
    BOTH: 'both'       // Requires both systems to be available
};

// ═══════════════════════════════════════════════════════════════
// COMMAND SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

const MAIN_COMMAND_SUGGESTIONS = [
    '`/fumo` - Fumo collection game',
    '`/gacha` - Pull for rare Fumos',
    '`/trade` - Trade with other users',
    '`/farm` - Manage your Fumo farm',
    '`/market` - Buy and sell items',
    '`/pet` - Pet management system',
    '`/craft` - Craft items and equipment'
];

const SUB_COMMAND_SUGGESTIONS = [
    '`/reddit` - Browse Reddit posts',
    '`/anime` - Search anime information',
    '`/music` - Play music in voice channels',
    '`/video` - Download videos',
    '`/steam` - Check Steam sales',
    '`/pixiv` - Browse Pixiv artwork',
    '`/ping` - Check bot status',
    '`/avatar` - View user avatars'
];

// ═══════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const accessCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

// Clear expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, { timestamp }] of accessCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            accessCache.delete(key);
        }
    }
}, 60000);

/**
 * Clear cache for a specific user or all users
 */
function clearCache(userId = null) {
    if (userId) {
        for (const key of accessCache.keys()) {
            if (key.startsWith(userId)) {
                accessCache.delete(key);
            }
        }
    } else {
        accessCache.clear();
    }
}

// ═══════════════════════════════════════════════════════════════
// TIME FORMATTING
// ═══════════════════════════════════════════════════════════════

/**
 * Format remaining time in human readable format
 */
function formatRemainingTime(remaining) {
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && days === 0) parts.push(`${seconds}s`);
    
    return parts.join(' ') || '< 1s';
}

// ═══════════════════════════════════════════════════════════════
// EMBED BUILDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Create ban embed with detailed information
 */
function createBanEmbed(banData) {
    let description = `You are **banned** from using FumoBOT.\n\n`;
    description += `📋 **Reason:** ${banData.reason || 'No reason provided'}\n`;

    if (banData.expiresAt) {
        const remaining = banData.expiresAt - Date.now();
        const timeRemaining = formatRemainingTime(remaining);
        description += `⏰ **Time Remaining:** ${timeRemaining}\n`;
        description += `📅 **Expires:** <t:${Math.floor(banData.expiresAt / 1000)}:F>\n`;
    } else {
        description += `🔒 **Ban Type:** Permanent\n`;
    }

    if (banData.bannedAt) {
        description += `📆 **Banned Since:** <t:${Math.floor(banData.bannedAt / 1000)}:F>\n`;
    }

    description += `\n*This ban applies to all FumoBOT features.*`;

    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('⛔ You Are Banned')
        .setDescription(description)
        .setFooter({ text: 'Contact the developer if you believe this is a mistake' })
        .setTimestamp();
}

/**
 * Create maintenance embed for MainCommand only
 */
function createMainMaintenanceEmbed(mainState) {
    const subSuggestions = SUB_COMMAND_SUGGESTIONS.slice(0, 5).join('\n');
    
    let description = `🔧 **MainCommand features** are currently under maintenance.\n\n`;
    description += `📋 **Reason:** ${mainState.reason || 'Scheduled maintenance'}\n`;
    
    if (mainState.estimatedEnd) {
        description += `⏰ **Estimated End:** <t:${Math.floor(mainState.estimatedEnd / 1000)}:R>\n`;
    }
    
    description += `\n**📚 Available Commands While You Wait:**\n${subSuggestions}`;
    description += `\n\n*Use these SubCommands while MainCommand is being maintained!*`;

    return new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('🚧 MainCommand Maintenance')
        .setDescription(description)
        .setFooter({ text: "FumoBOT's Developer: alterGolden" })
        .setTimestamp();
}

/**
 * Create maintenance embed for SubCommand only
 */
function createSubMaintenanceEmbed(subState) {
    const mainSuggestions = MAIN_COMMAND_SUGGESTIONS.slice(0, 5).join('\n');
    
    let description = `🔧 **SubCommand features** are currently under maintenance.\n\n`;
    description += `📋 **Reason:** ${subState.reason || 'Scheduled maintenance'}\n`;
    
    if (subState.estimatedEnd) {
        description += `⏰ **Estimated End:** <t:${Math.floor(subState.estimatedEnd / 1000)}:R>\n`;
    }
    
    description += `\n**🎮 Available Commands While You Wait:**\n${mainSuggestions}`;
    description += `\n\n*Try our Fumo collection game while SubCommand is being maintained!*`;

    return new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('🚧 SubCommand Maintenance')
        .setDescription(description)
        .setFooter({ text: "FumoBOT's Developer: alterGolden" })
        .setTimestamp();
}

/**
 * Create maintenance embed when both systems are down
 */
function createBothMaintenanceEmbed(mainState, subState) {
    let description = `🔧 **Both MainCommand and SubCommand** are currently under maintenance.\n\n`;
    
    description += `**MainCommand:**\n`;
    description += `📋 Reason: ${mainState.reason || 'Scheduled maintenance'}\n`;
    if (mainState.estimatedEnd) {
        description += `⏰ Estimated End: <t:${Math.floor(mainState.estimatedEnd / 1000)}:R>\n`;
    }
    
    description += `\n**SubCommand:**\n`;
    description += `📋 Reason: ${subState.reason || 'Scheduled maintenance'}\n`;
    if (subState.estimatedEnd) {
        description += `⏰ Estimated End: <t:${Math.floor(subState.estimatedEnd / 1000)}:R>\n`;
    }
    
    description += `\n*Please check back later. We apologize for the inconvenience!*`;

    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🚧 Full Maintenance Mode')
        .setDescription(description)
        .addFields({
            name: '💡 What can you do?',
            value: '• Check our Discord server for updates\n• Follow @alterGolden for announcements\n• Take a break and come back soon!',
            inline: false
        })
        .setFooter({ text: "FumoBOT's Developer: alterGolden" })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════
// MAIN ACCESS CHECK FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a user has access to use bot features
 * @param {Interaction|Message} context - Discord interaction or message
 * @param {string} accessType - Type of access required (AccessType.MAIN, SUB, or BOTH)
 * @param {Object} options - Additional options
 * @returns {Promise<{blocked: boolean, embed?: EmbedBuilder, reason?: string}>}
 */
async function checkAccess(context, accessType = AccessType.SUB, options = {}) {
    const userId = context.user?.id || context.author?.id;
    if (!userId) {
        return { blocked: false };
    }
    
    const { useCache = true, featureName = null } = options;
    const cacheKey = `${userId}:${accessType}:${featureName || 'all'}`;
    
    // Check cache
    if (useCache && accessCache.has(cacheKey)) {
        const cached = accessCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.result;
        }
        accessCache.delete(cacheKey);
    }
    
    // Load configurations
    const config = loadMaintenanceConfig();
    const ban = loadBanService();
    
    const developerID = config.developerID || DEVELOPER_ID;
    
    // Check if user is developer (bypass all restrictions)
    if (userId === developerID) {
        const result = { blocked: false };
        if (useCache) {
            accessCache.set(cacheKey, { result, timestamp: Date.now() });
        }
        return result;
    }
    
    // ─────────────────────────────────────────────────────────────
    // STEP 1: Check ban status (applies to ALL features)
    // ─────────────────────────────────────────────────────────────
    const banData = ban.isBanned(userId);
    if (banData) {
        // Check if ban has expired
        if (banData.expiresAt && banData.expiresAt <= Date.now()) {
            // Ban expired, don't block
        } else {
            const result = {
                blocked: true,
                embed: createBanEmbed(banData),
                reason: 'BANNED',
                banData
            };
            
            if (useCache) {
                accessCache.set(cacheKey, { result, timestamp: Date.now() });
            }
            
            console.log(`[AccessControl] Blocked banned user: ${userId}`);
            return result;
        }
    }
    
    // ─────────────────────────────────────────────────────────────
    // STEP 2: Check maintenance status based on access type
    // ─────────────────────────────────────────────────────────────
    const mainState = config.getSystemState ? config.getSystemState('main') : { enabled: false };
    const subState = config.getSystemState ? config.getSystemState('sub') : { enabled: false };
    
    const mainInMaintenance = mainState.enabled && !config.canBypassMaintenance(userId);
    const subInMaintenance = subState.enabled && !config.canBypassMaintenance(userId);
    
    // Check feature-specific maintenance if provided
    if (featureName && config.isFeatureDisabled) {
        if (accessType === AccessType.MAIN && config.isFeatureDisabled(featureName, 'main')) {
            const result = {
                blocked: true,
                embed: createMainMaintenanceEmbed(mainState),
                reason: 'MAIN_FEATURE_DISABLED'
            };
            if (useCache) {
                accessCache.set(cacheKey, { result, timestamp: Date.now() });
            }
            return result;
        }
        
        if (accessType === AccessType.SUB && config.isFeatureDisabled(featureName, 'sub')) {
            const result = {
                blocked: true,
                embed: createSubMaintenanceEmbed(subState),
                reason: 'SUB_FEATURE_DISABLED'
            };
            if (useCache) {
                accessCache.set(cacheKey, { result, timestamp: Date.now() });
            }
            return result;
        }
    }
    
    let result = { blocked: false };
    
    switch (accessType) {
        case AccessType.MAIN:
            if (mainInMaintenance) {
                result = {
                    blocked: true,
                    embed: createMainMaintenanceEmbed(mainState),
                    reason: 'MAIN_MAINTENANCE'
                };
            }
            break;
            
        case AccessType.SUB:
            if (subInMaintenance) {
                result = {
                    blocked: true,
                    embed: createSubMaintenanceEmbed(subState),
                    reason: 'SUB_MAINTENANCE'
                };
            }
            break;
            
        case AccessType.BOTH:
            if (mainInMaintenance && subInMaintenance) {
                result = {
                    blocked: true,
                    embed: createBothMaintenanceEmbed(mainState, subState),
                    reason: 'BOTH_MAINTENANCE'
                };
            } else if (mainInMaintenance) {
                result = {
                    blocked: true,
                    embed: createMainMaintenanceEmbed(mainState),
                    reason: 'MAIN_MAINTENANCE'
                };
            } else if (subInMaintenance) {
                result = {
                    blocked: true,
                    embed: createSubMaintenanceEmbed(subState),
                    reason: 'SUB_MAINTENANCE'
                };
            }
            break;
    }
    
    // Cache the result
    if (useCache) {
        accessCache.set(cacheKey, { result, timestamp: Date.now() });
    }
    
    if (result.blocked) {
        console.log(`[AccessControl] Blocked user ${userId} - Reason: ${result.reason}`);
    }
    
    return result;
}

// ═══════════════════════════════════════════════════════════════
// QUICK CHECK FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Quick check for MainCommand access
 */
async function checkMainAccess(context, options = {}) {
    return checkAccess(context, AccessType.MAIN, options);
}

/**
 * Quick check for SubCommand access
 */
async function checkSubAccess(context, options = {}) {
    return checkAccess(context, AccessType.SUB, options);
}

/**
 * Check if user is banned (synchronous, for quick checks)
 */
function isBanned(userId) {
    const ban = loadBanService();
    return ban.isBanned(userId);
}

/**
 * Get current maintenance status for both systems
 */
function getMaintenanceStatus() {
    const config = loadMaintenanceConfig();
    
    const mainState = config.getSystemState ? config.getSystemState('main') : { enabled: false };
    const subState = config.getSystemState ? config.getSystemState('sub') : { enabled: false };
    
    return {
        main: {
            enabled: mainState.enabled,
            reason: mainState.reason,
            estimatedEnd: mainState.estimatedEnd
        },
        sub: {
            enabled: subState.enabled,
            reason: subState.reason,
            estimatedEnd: subState.estimatedEnd
        },
        bothDown: mainState.enabled && subState.enabled
    };
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    let blocked = 0;
    
    for (const { result, timestamp } of accessCache.values()) {
        if (now - timestamp < CACHE_TTL) {
            valid++;
            if (result.blocked) blocked++;
        } else {
            expired++;
        }
    }
    
    return {
        total: accessCache.size,
        valid,
        expired,
        blocked,
        ttl: CACHE_TTL
    };
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    // Main function
    checkAccess,
    
    // Quick access functions
    checkMainAccess,
    checkSubAccess,
    
    // Access types
    AccessType,
    
    // Utility functions
    isBanned,
    getMaintenanceStatus,
    formatRemainingTime,
    clearCache,
    getCacheStats,
    
    // Embed builders (for custom use)
    createBanEmbed,
    createMainMaintenanceEmbed,
    createSubMaintenanceEmbed,
    createBothMaintenanceEmbed
};
