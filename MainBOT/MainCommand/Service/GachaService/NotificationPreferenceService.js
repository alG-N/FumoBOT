/**
 * Notification Preference Service
 * Manages user notification preferences with async file operations and in-memory caching
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const NOTIFICATION_PREFS_FILE = path.join(__dirname, '../../Data/notificationPreferences.json');

// In-memory cache to minimize file reads
let preferencesCache = null;
let cacheLoadTime = 0;
const CACHE_TTL = 60000; // 1 minute cache TTL

// Write debouncing to prevent excessive file writes
let writeTimeout = null;
let pendingWrites = false;
const WRITE_DEBOUNCE = 2000; // 2 second debounce

/**
 * Load preferences from file (async)
 */
async function loadNotificationPreferences() {
    try {
        // Use cached data if still valid
        if (preferencesCache && (Date.now() - cacheLoadTime) < CACHE_TTL) {
            return preferencesCache;
        }

        try {
            await fs.access(NOTIFICATION_PREFS_FILE);
        } catch {
            preferencesCache = {};
            cacheLoadTime = Date.now();
            return {};
        }

        const data = await fs.readFile(NOTIFICATION_PREFS_FILE, 'utf8');
        preferencesCache = JSON.parse(data);
        cacheLoadTime = Date.now();
        return preferencesCache;
    } catch (error) {
        console.error('Failed to load notification preferences:', error);
        preferencesCache = {};
        return {};
    }
}

/**
 * Load preferences synchronously (for startup/initial load only)
 */
function loadNotificationPreferencesSync() {
    try {
        if (!fsSync.existsSync(NOTIFICATION_PREFS_FILE)) {
            preferencesCache = {};
            cacheLoadTime = Date.now();
            return {};
        }

        const data = fsSync.readFileSync(NOTIFICATION_PREFS_FILE, 'utf8');
        preferencesCache = JSON.parse(data);
        cacheLoadTime = Date.now();
        return preferencesCache;
    } catch (error) {
        console.error('Failed to load notification preferences (sync):', error);
        preferencesCache = {};
        return {};
    }
}

/**
 * Save preferences to file (async with debouncing)
 */
async function saveNotificationPreferences(preferences) {
    try {
        // Update cache immediately
        preferencesCache = preferences;
        cacheLoadTime = Date.now();
        pendingWrites = true;

        // Debounce writes
        if (writeTimeout) {
            clearTimeout(writeTimeout);
        }

        writeTimeout = setTimeout(async () => {
            try {
                const dir = path.dirname(NOTIFICATION_PREFS_FILE);
                try {
                    await fs.access(dir);
                } catch {
                    await fs.mkdir(dir, { recursive: true });
                }

                await fs.writeFile(
                    NOTIFICATION_PREFS_FILE,
                    JSON.stringify(preferencesCache, null, 2),
                    'utf8'
                );
                pendingWrites = false;
            } catch (error) {
                console.error('Failed to write notification preferences:', error);
            }
        }, WRITE_DEBOUNCE);

        return true;
    } catch (error) {
        console.error('Failed to save notification preferences:', error);
        return false;
    }
}

/**
 * Force immediate save (for shutdown)
 */
async function flushPendingWrites() {
    if (!pendingWrites) return;
    
    if (writeTimeout) {
        clearTimeout(writeTimeout);
        writeTimeout = null;
    }

    try {
        const dir = path.dirname(NOTIFICATION_PREFS_FILE);
        if (!fsSync.existsSync(dir)) {
            fsSync.mkdirSync(dir, { recursive: true });
        }

        fsSync.writeFileSync(
            NOTIFICATION_PREFS_FILE,
            JSON.stringify(preferencesCache || {}, null, 2),
            'utf8'
        );
        pendingWrites = false;
    } catch (error) {
        console.error('Failed to flush notification preferences:', error);
    }
}

async function getUserNotificationPreferences(userId) {
    const prefs = await loadNotificationPreferences();
    return prefs[userId] || {
        normalGacha: true,
        eventGacha: true
    };
}

// Sync version for backward compatibility
function getUserNotificationPreferencesSync(userId) {
    if (!preferencesCache) {
        loadNotificationPreferencesSync();
    }
    return preferencesCache[userId] || {
        normalGacha: true,
        eventGacha: true
    };
}

async function setUserNotificationPreference(userId, type, enabled) {
    const prefs = await loadNotificationPreferences();
    
    if (!prefs[userId]) {
        prefs[userId] = {
            normalGacha: true,
            eventGacha: true
        };
    }
    
    if (type === 'normal') {
        prefs[userId].normalGacha = enabled;
    } else if (type === 'event') {
        prefs[userId].eventGacha = enabled;
    }
    
    return saveNotificationPreferences(prefs);
}

function shouldNotifyNormalGacha(userId) {
    const prefs = getUserNotificationPreferencesSync(userId);
    return prefs.normalGacha !== false;
}

function shouldNotifyEventGacha(userId) {
    const prefs = getUserNotificationPreferencesSync(userId);
    return prefs.eventGacha !== false;
}

async function disableAllNotifications(userId) {
    const prefs = await loadNotificationPreferences();
    prefs[userId] = {
        normalGacha: false,
        eventGacha: false
    };
    return saveNotificationPreferences(prefs);
}

async function enableAllNotifications(userId) {
    const prefs = await loadNotificationPreferences();
    prefs[userId] = {
        normalGacha: true,
        eventGacha: true
    };
    return saveNotificationPreferences(prefs);
}

// Pre-load cache on module load
loadNotificationPreferencesSync();

module.exports = {
    getUserNotificationPreferences,
    getUserNotificationPreferencesSync,
    setUserNotificationPreference,
    shouldNotifyNormalGacha,
    shouldNotifyEventGacha,
    disableAllNotifications,
    enableAllNotifications,
    flushPendingWrites
};
