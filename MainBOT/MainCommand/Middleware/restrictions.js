const { EmbedBuilder, Colors } = require('discord.js');
const { maintenance, developerID } = require('../Configuration/Maintenance/maintenanceConfig');
const { isBanned } = require('../Administrator/BannedList/BanUtils');

const restrictionCache = new Map();
const CACHE_TTL = 30000;

setInterval(() => {
    const now = Date.now();
    const toDelete = [];
    
    for (const [userId, { timestamp }] of restrictionCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            toDelete.push(userId);
        }
    }
    
    toDelete.forEach(userId => restrictionCache.delete(userId));
}, 60000);

function formatBanTime(expiresAt) {
    const remaining = expiresAt - Date.now();
    
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

function createMaintenanceEmbed() {
    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🚧 Maintenance Mode')
        .setDescription(
            "The bot is currently in maintenance mode. Please try again later.\n\n" +
            "**FumoBOT's Developer:** alterGolden"
        )
        .setFooter({ text: "Thank you for your patience" })
        .setTimestamp();
}

function createBanEmbed(banData) {
    let description = `You are banned from using this bot.\n\n` +
        `**Reason:** ${banData.reason || 'No reason provided'}`;

    if (banData.expiresAt) {
        const timeRemaining = formatBanTime(banData.expiresAt);
        description += `\n**Time Remaining:** ${timeRemaining}`;
        
        const expirationDate = new Date(banData.expiresAt).toLocaleString();
        description += `\n**Expires:** ${expirationDate}`;
    } else {
        description += `\n**Ban Type:** Permanent`;
    }

    if (banData.bannedAt) {
        const banDate = new Date(banData.bannedAt).toLocaleString();
        description += `\n**Banned Since:** ${banDate}`;
    }

    return new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('⛔ You Are Banned')
        .setDescription(description)
        .setFooter({ text: "Ban enforced by developer" })
        .setTimestamp();
}

function checkRestrictions(userId, useCache = true) {
    if (useCache && restrictionCache.has(userId)) {
        const cached = restrictionCache.get(userId);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.result;
        }
        restrictionCache.delete(userId);
    }

    let result;

    if (maintenance === "yes" && userId !== developerID) {
        result = {
            blocked: true,
            embed: createMaintenanceEmbed(),
            reason: 'MAINTENANCE'
        };
    } else {
        const banData = isBanned(userId);
        
        if (banData) {
            if (banData.expiresAt && banData.expiresAt <= Date.now()) {
                result = { blocked: false };
            } else {
                result = {
                    blocked: true,
                    embed: createBanEmbed(banData),
                    reason: 'BANNED',
                    banData
                };
            }
        } else {
            result = { blocked: false };
        }
    }

    if (useCache) {
        restrictionCache.set(userId, {
            result,
            timestamp: Date.now()
        });
    }

    return result;
}

function checkMultipleRestrictions(userIds) {
    const results = {};
    
    for (const userId of userIds) {
        results[userId] = checkRestrictions(userId);
    }
    
    return results;
}

function clearRestrictionCache(userId = null) {
    if (userId) {
        restrictionCache.delete(userId);
    } else {
        restrictionCache.clear();
    }
}

function getRestrictionCacheStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    let blocked = 0;
    
    for (const { result, timestamp } of restrictionCache.values()) {
        if (now - timestamp < CACHE_TTL) {
            valid++;
            if (result.blocked) blocked++;
        } else {
            expired++;
        }
    }
    
    return {
        total: restrictionCache.size,
        valid,
        expired,
        blocked,
        ttl: CACHE_TTL
    };
}

function restrictionMiddleware(userId, next) {
    const restriction = checkRestrictions(userId);
    
    if (restriction.blocked) {
        return true;
    }
    
    if (typeof next === 'function') {
        return next();
    }
    
    return false;
}

module.exports = {
    checkRestrictions,
    checkMultipleRestrictions,
    clearRestrictionCache,
    getRestrictionCacheStats,
    restrictionMiddleware,
    formatBanTime,
    createMaintenanceEmbed,
    createBanEmbed
};