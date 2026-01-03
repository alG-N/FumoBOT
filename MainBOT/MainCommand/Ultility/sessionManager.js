/**
 * Session Manager - Handles active user sessions with cleanup and recovery
 * Prevents memory leaks from unclosed sessions and allows recovery after bot restart
 */

const { debugLog } = require('../Core/logger');
const fs = require('fs');
const path = require('path');

// Session storage
const activeSessions = new Map();

// Session types for different commands
const SESSION_TYPES = {
    TRADE: 'trade',
    CRAFT: 'craft',
    GACHA: 'gacha',
    PRAY: 'pray',
    SHOP: 'shop',
    MYSTERY_CRATE: 'mystery_crate',
    DICE_DUEL: 'dice_duel',
    FARM: 'farm',
    SGIL: 'sgil',
    GENERIC: 'generic'
};

// Session state file for persistence
const SESSION_FILE = path.join(__dirname, '../Data/activeSessions.json');

// Configuration
const CONFIG = {
    maxSessionDuration: 600000,  // 10 minutes max session duration
    cleanupInterval: 30000,      // Check for stale sessions every 30s
    persistInterval: 60000,      // Save sessions to disk every 60s
    warningThreshold: 300000     // Warn at 5 minutes remaining
};

/**
 * Create a new session for a user
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {object} data - Session data
 * @returns {object} Session object
 */
function createSession(userId, sessionType, data = {}) {
    const sessionId = `${sessionType}_${userId}_${Date.now()}`;
    
    // Check if user already has a session of this type
    const existingSession = getSession(userId, sessionType);
    if (existingSession) {
        debugLog('SESSION', `User ${userId} already has active ${sessionType} session, ending old one`);
        endSession(userId, sessionType);
    }
    
    const session = {
        id: sessionId,
        sessionId, // alias for compatibility
        odlSessionId: sessionId, // alias for compatibility
        startTime: Date.now(),
        lastActivity: Date.now(),
        userId,
        sessionType,
        data,
        collector: null,
        message: null,
        interval: null,
        warnings: []
    };
    
    activeSessions.set(getSessionKey(userId, sessionType), session);
    debugLog('SESSION', `Created ${sessionType} session for user ${userId}`);
    
    return session;
}

/**
 * Get session key for a user and type
 */
function getSessionKey(userId, sessionType) {
    return `${sessionType}_${userId}`;
}

/**
 * Get an active session for a user
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @returns {object|null} Session object or null
 */
function getSession(userId, sessionType) {
    return activeSessions.get(getSessionKey(userId, sessionType)) || null;
}

/**
 * Update session activity and data
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {object} updates - Data to update
 */
function updateSession(userId, sessionType, updates = {}) {
    const session = getSession(userId, sessionType);
    if (session) {
        session.lastActivity = Date.now();
        Object.assign(session.data, updates);
        return true;
    }
    return false;
}

/**
 * Attach a collector to a session for proper cleanup
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {object} collector - Discord.js collector
 */
function attachCollector(userId, sessionType, collector) {
    const session = getSession(userId, sessionType);
    if (session) {
        // Clean up existing collector if any
        if (session.collector && !session.collector.ended) {
            session.collector.stop('session_replaced');
        }
        session.collector = collector;
        
        // Auto-cleanup when collector ends
        collector.on('end', () => {
            if (session.collector === collector) {
                session.collector = null;
            }
        });
    }
}

/**
 * Attach a message to a session for cleanup
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {object} message - Discord.js message
 */
function attachMessage(userId, sessionType, message) {
    const session = getSession(userId, sessionType);
    if (session) {
        session.message = message;
    }
}

/**
 * Attach an interval to a session for cleanup
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {number} intervalId - setInterval ID
 */
function attachInterval(userId, sessionType, intervalId) {
    const session = getSession(userId, sessionType);
    if (session) {
        if (session.interval) {
            clearInterval(session.interval);
        }
        session.interval = intervalId;
    }
}

/**
 * End a session and clean up resources
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session
 * @param {string} reason - Reason for ending
 * @returns {boolean} True if session was ended
 */
function endSession(userId, sessionType, reason = 'completed') {
    const session = getSession(userId, sessionType);
    if (!session) return false;
    
    // Clean up collector
    if (session.collector && !session.collector.ended) {
        try {
            session.collector.stop(reason);
        } catch (error) {
            debugLog('SESSION', `Error stopping collector for ${userId}: ${error.message}`);
        }
    }
    
    // Clean up interval
    if (session.interval) {
        clearInterval(session.interval);
    }
    
    // Disable buttons on message if possible
    if (session.message) {
        try {
            session.message.edit({ components: [] }).catch(() => {});
        } catch (error) {
            // Message may already be deleted
        }
    }
    
    activeSessions.delete(getSessionKey(userId, sessionType));
    debugLog('SESSION', `Ended ${sessionType} session for user ${userId} (${reason})`);
    
    return true;
}

/**
 * Check if user has an active session
 * @param {string} userId - User ID
 * @param {string} sessionType - Type of session (optional, checks all if not provided)
 * @returns {boolean}
 */
function hasActiveSession(userId, sessionType = null) {
    if (sessionType) {
        return activeSessions.has(getSessionKey(userId, sessionType));
    }
    
    // Check all session types
    for (const type of Object.values(SESSION_TYPES)) {
        if (activeSessions.has(getSessionKey(userId, type))) {
            return true;
        }
    }
    return false;
}

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {array} Array of sessions
 */
function getUserSessions(userId) {
    const sessions = [];
    for (const [key, session] of activeSessions) {
        if (session.userId === userId) {
            sessions.push(session);
        }
    }
    return sessions;
}

/**
 * Get session statistics
 * @returns {object} Statistics object
 */
function getSessionStats() {
    const stats = {
        total: activeSessions.size,
        byType: {},
        oldestSession: null,
        averageAge: 0
    };
    
    const now = Date.now();
    let totalAge = 0;
    
    for (const [key, session] of activeSessions) {
        const type = session.sessionType;
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        
        const age = now - session.startTime;
        totalAge += age;
        
        if (!stats.oldestSession || session.startTime < stats.oldestSession.startTime) {
            stats.oldestSession = {
                userId: session.userId,
                type: session.sessionType,
                age: age
            };
        }
    }
    
    stats.averageAge = activeSessions.size > 0 ? totalAge / activeSessions.size : 0;
    
    return stats;
}

/**
 * Force end all sessions for a user (for admin use)
 * @param {string} userId - User ID
 * @returns {number} Number of sessions ended
 */
function endAllUserSessions(userId) {
    let count = 0;
    for (const type of Object.values(SESSION_TYPES)) {
        if (endSession(userId, type, 'forced')) {
            count++;
        }
    }
    return count;
}

/**
 * Cleanup stale sessions
 */
function cleanupStaleSessions() {
    const now = Date.now();
    const stale = [];
    
    for (const [key, session] of activeSessions) {
        const age = now - session.startTime;
        const inactive = now - session.lastActivity;
        
        // End sessions that are too old or inactive
        if (age > CONFIG.maxSessionDuration || inactive > CONFIG.maxSessionDuration / 2) {
            stale.push({ userId: session.userId, type: session.sessionType });
        }
    }
    
    for (const { userId, type } of stale) {
        endSession(userId, type, 'timeout');
        debugLog('SESSION', `Cleaned up stale ${type} session for user ${userId}`);
    }
    
    return stale.length;
}

/**
 * Save sessions to disk for recovery after restart
 */
function persistSessions() {
    const sessionsToSave = [];
    
    for (const [key, session] of activeSessions) {
        // Only save basic session data, not collectors/messages
        sessionsToSave.push({
            userId: session.userId,
            sessionType: session.sessionType,
            startTime: session.startTime,
            data: session.data
        });
    }
    
    try {
        fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionsToSave, null, 2));
    } catch (error) {
        debugLog('SESSION', `Failed to persist sessions: ${error.message}`);
    }
}

/**
 * Load persisted sessions (call on startup)
 * Note: These sessions won't have active collectors, so they'll be cleaned up
 */
function loadPersistedSessions() {
    try {
        if (fs.existsSync(SESSION_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            
            // Don't restore old sessions - just log that there were interrupted sessions
            const now = Date.now();
            for (const session of data) {
                const age = now - session.startTime;
                if (age < CONFIG.maxSessionDuration) {
                    debugLog('SESSION', `Found interrupted ${session.sessionType} session for user ${session.userId}`);
                }
            }
            
            // Clear the file
            fs.writeFileSync(SESSION_FILE, '[]');
        }
    } catch (error) {
        debugLog('SESSION', `Failed to load persisted sessions: ${error.message}`);
    }
}

// Start cleanup interval
setInterval(cleanupStaleSessions, CONFIG.cleanupInterval);

// Start persist interval
setInterval(persistSessions, CONFIG.persistInterval);

// Load any persisted sessions on startup
loadPersistedSessions();

module.exports = {
    SESSION_TYPES,
    createSession,
    getSession,
    updateSession,
    attachCollector,
    attachMessage,
    attachInterval,
    endSession,
    hasActiveSession,
    getUserSessions,
    getSessionStats,
    endAllUserSessions,
    cleanupStaleSessions,
    persistSessions,
    loadPersistedSessions
};
