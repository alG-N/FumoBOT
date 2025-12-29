/**
 * Ban Service
 * Handles all ban-related business logic
 */

const fs = require('fs');
const path = require('path');
const { parseDuration, formatDuration } = require('../Utils/adminUtils');

// File path for ban list
const BAN_FILE_PATH = path.join(__dirname, '../Data/BannedList/Banned.json');

// Ensure directory and file exist
function ensureBanFile() {
    const dir = path.dirname(BAN_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(BAN_FILE_PATH)) {
        fs.writeFileSync(BAN_FILE_PATH, JSON.stringify([], null, 2));
    }
}

// Initialize on module load
ensureBanFile();

// ═══════════════════════════════════════════════════════════════
// BAN LIST OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Read the current ban list from file
 * @returns {Array} - Array of ban objects
 */
function readBanList() {
    try {
        return JSON.parse(fs.readFileSync(BAN_FILE_PATH, 'utf8'));
    } catch (error) {
        console.error('Error reading ban list:', error);
        return [];
    }
}

/**
 * Write ban list to file
 * @param {Array} banList - Array of ban objects
 */
function writeBanList(banList) {
    try {
        fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(banList, null, 2));
    } catch (error) {
        console.error('Error writing ban list:', error);
    }
}

/**
 * Clean expired bans from the list
 * @returns {number} - Number of expired bans removed
 */
function cleanExpiredBans() {
    const banList = readBanList();
    const now = Date.now();
    
    const activeBans = banList.filter(ban => {
        if (ban.expiresAt && now > ban.expiresAt) {
            return false;
        }
        return true;
    });
    
    const removed = banList.length - activeBans.length;
    
    if (removed > 0) {
        writeBanList(activeBans);
    }
    
    return removed;
}

// ═══════════════════════════════════════════════════════════════
// BAN OPERATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Ban a user
 * @param {string} userId - Discord user ID to ban
 * @param {string} reason - Reason for the ban
 * @param {number|null} durationMs - Duration in milliseconds (null for permanent)
 * @returns {Object} - Ban record
 */
function banUser(userId, reason, durationMs = null) {
    const banList = readBanList();
    const expiresAt = durationMs ? Date.now() + durationMs : null;
    const bannedAt = Date.now();

    const banRecord = {
        userId,
        reason,
        expiresAt,
        bannedAt
    };

    const existingIndex = banList.findIndex(b => b.userId === userId);
    if (existingIndex !== -1) {
        banList[existingIndex] = banRecord;
    } else {
        banList.push(banRecord);
    }

    writeBanList(banList);
    return banRecord;
}

/**
 * Unban a user
 * @param {string} userId - Discord user ID to unban
 * @returns {boolean} - True if user was unbanned, false if not found
 */
function unbanUser(userId) {
    const banList = readBanList();
    const initialLength = banList.length;
    const newList = banList.filter(ban => ban.userId !== userId);
    
    if (newList.length < initialLength) {
        writeBanList(newList);
        return true;
    }
    
    return false;
}

/**
 * Check if a user is banned
 * @param {string} userId - Discord user ID to check
 * @returns {Object|null} - Ban record if banned, null otherwise
 */
function isUserBanned(userId) {
    const banList = readBanList();
    const ban = banList.find(b => b.userId === userId);
    
    if (!ban) return null;
    
    // Check if ban has expired
    if (ban.expiresAt && Date.now() > ban.expiresAt) {
        unbanUser(userId);
        return null;
    }
    
    return ban;
}

/**
 * Get all banned users
 * @param {boolean} includeExpired - Whether to include expired bans
 * @returns {Array} - Array of ban records
 */
function getAllBans(includeExpired = false) {
    const banList = readBanList();
    const now = Date.now();
    
    if (includeExpired) {
        return banList;
    }
    
    return banList.filter(ban => !ban.expiresAt || now <= ban.expiresAt);
}

/**
 * Get ban info for a user
 * @param {string} userId - Discord user ID
 * @returns {Object|null} - Ban info with formatted duration
 */
function getBanInfo(userId) {
    const ban = isUserBanned(userId);
    
    if (!ban) return null;
    
    const remainingMs = ban.expiresAt ? ban.expiresAt - Date.now() : null;
    
    return {
        ...ban,
        isPermanent: !ban.expiresAt,
        remainingMs,
        remainingFormatted: remainingMs ? formatDuration(remainingMs) : 'Permanent',
        bannedAtFormatted: new Date(ban.bannedAt).toLocaleString()
    };
}

/**
 * Update ban reason
 * @param {string} userId - Discord user ID
 * @param {string} newReason - New reason for the ban
 * @returns {boolean} - True if updated, false if user not banned
 */
function updateBanReason(userId, newReason) {
    const banList = readBanList();
    const banIndex = banList.findIndex(b => b.userId === userId);
    
    if (banIndex === -1) return false;
    
    banList[banIndex].reason = newReason;
    writeBanList(banList);
    return true;
}

/**
 * Extend ban duration
 * @param {string} userId - Discord user ID
 * @param {number} additionalMs - Additional milliseconds to add
 * @returns {Object|null} - Updated ban record or null if not found
 */
function extendBan(userId, additionalMs) {
    const banList = readBanList();
    const banIndex = banList.findIndex(b => b.userId === userId);
    
    if (banIndex === -1) return null;
    
    const ban = banList[banIndex];
    
    if (ban.expiresAt) {
        ban.expiresAt += additionalMs;
    } else {
        // If permanent, set expiry from now
        ban.expiresAt = Date.now() + additionalMs;
    }
    
    writeBanList(banList);
    return ban;
}

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY (isBanned from BanUtils)
// ═══════════════════════════════════════════════════════════════

/**
 * Legacy isBanned function for backward compatibility
 * @param {string} userId - Discord user ID
 * @returns {Object|null} - Ban record if banned
 */
function isBanned(userId) {
    return isUserBanned(userId);
}

module.exports = {
    // Core operations
    banUser,
    unbanUser,
    isUserBanned,
    isBanned, // Legacy alias
    
    // Query operations
    getAllBans,
    getBanInfo,
    
    // Update operations
    updateBanReason,
    extendBan,
    
    // Maintenance
    cleanExpiredBans,
    
    // Utilities
    parseDuration,
    
    // File path export
    BAN_FILE_PATH
};
