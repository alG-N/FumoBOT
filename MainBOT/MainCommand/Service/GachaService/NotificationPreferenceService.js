const fs = require('fs');
const path = require('path');
const { debugLog } = require('../../Core/logger');

const NOTIFICATION_PREFS_FILE = path.join(__dirname, '../../Data/notificationPreferences.json');

function loadNotificationPreferences() {
    try {
        if (!fs.existsSync(NOTIFICATION_PREFS_FILE)) {
            return {};
        }

        const data = fs.readFileSync(NOTIFICATION_PREFS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load notification preferences:', error);
        return {};
    }
}

function saveNotificationPreferences(preferences) {
    try {
        const dir = path.dirname(NOTIFICATION_PREFS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            NOTIFICATION_PREFS_FILE,
            JSON.stringify(preferences, null, 2),
            'utf8'
        );
        return true;
    } catch (error) {
        console.error('Failed to save notification preferences:', error);
        return false;
    }
}

function getUserNotificationPreferences(userId) {
    const prefs = loadNotificationPreferences();
    return prefs[userId] || {
        normalGacha: true,
        eventGacha: true
    };
}

function setUserNotificationPreference(userId, type, enabled) {
    const prefs = loadNotificationPreferences();
    
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
    const prefs = getUserNotificationPreferences(userId);
    return prefs.normalGacha !== false;
}

function shouldNotifyEventGacha(userId) {
    const prefs = getUserNotificationPreferences(userId);
    return prefs.eventGacha !== false;
}

function disableAllNotifications(userId) {
    const prefs = loadNotificationPreferences();
    prefs[userId] = {
        normalGacha: false,
        eventGacha: false
    };
    return saveNotificationPreferences(prefs);
}

function enableAllNotifications(userId) {
    const prefs = loadNotificationPreferences();
    prefs[userId] = {
        normalGacha: true,
        eventGacha: true
    };
    return saveNotificationPreferences(prefs);
}

module.exports = {
    getUserNotificationPreferences,
    setUserNotificationPreference,
    shouldNotifyNormalGacha,
    shouldNotifyEventGacha,
    disableAllNotifications,
    enableAllNotifications
};