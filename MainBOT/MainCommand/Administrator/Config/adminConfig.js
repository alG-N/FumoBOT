/**
 * Administrator Configuration
 * Central configuration file for all admin-related settings
 */

const path = require('path');

// ═══════════════════════════════════════════════════════════════
// ADMIN IDS & PERMISSIONS
// ═══════════════════════════════════════════════════════════════

/**
 * List of Discord user IDs with full admin access
 * These users can use all admin commands
 */
const ADMIN_IDS = [
    '1128296349566251068',  // Primary Admin
    '1362450043939979378',  // Secondary Admin
    '1448912158367813662'   // Tertiary Admin
];

/**
 * Developer ID - has access to ban/unban commands
 * Usually the bot owner
 */
const DEVELOPER_ID = '1128296349566251068';

// ═══════════════════════════════════════════════════════════════
// CHANNEL IDS
// ═══════════════════════════════════════════════════════════════

/**
 * Channel where guild join/leave notifications are sent
 */
const GUILD_LOG_CHANNEL_ID = '1366324387967533057';

/**
 * Channel where ticket reports are sent
 */
const REPORT_CHANNEL_ID = '1362826913088799001';

/**
 * Guild ID for the support server
 */
const SUPPORT_GUILD_ID = '1255091916823986207';

// ═══════════════════════════════════════════════════════════════
// FILE PATHS
// ═══════════════════════════════════════════════════════════════

const DATA_DIR = path.join(__dirname, '../Data');

const FILE_PATHS = {
    BAN_LIST: path.join(DATA_DIR, 'BannedList', 'Banned.json'),
    TICKET_COUNTER: path.join(DATA_DIR, 'ticketCounter.txt')
};

// ═══════════════════════════════════════════════════════════════
// TICKET CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const TICKET_TYPES = {
    bug: {
        label: '🐛 Bug Report',
        value: 'bug',
        description: 'Report a bug or issue with the bot',
        emoji: '🐛',
        name: 'Bug Report',
        color: 0xff0000,
        requiresCommand: true
    },
    exploit: {
        label: '🔓 Exploit Report',
        value: 'exploit',
        description: 'Report an exploit or abuse',
        emoji: '🔓',
        name: 'Exploit Report',
        color: 0xff6600,
        requiresCommand: true
    },
    suggestion: {
        label: '💡 Suggestion',
        value: 'suggestion',
        description: 'Suggest a new feature or improvement',
        emoji: '💡',
        name: 'Suggestion',
        color: 0x00ff00,
        requiresCommand: false
    },
    ban_appeal: {
        label: '⚖️ Ban Appeal',
        value: 'ban_appeal',
        description: 'Appeal your ban from the bot',
        emoji: '⚖️',
        name: 'Ban Appeal',
        color: 0xffaa00,
        requiresCommand: false
    },
    other: {
        label: '❓ Other',
        value: 'other',
        description: 'Other issues or questions',
        emoji: '❓',
        name: 'Other',
        color: 0x00aaff,
        requiresCommand: false
    }
};

const TICKET_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ═══════════════════════════════════════════════════════════════
// RARITY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ITEM_RARITIES = [
    { label: 'Basic (B)', value: 'B' },
    { label: 'Common (C)', value: 'C' },
    { label: 'Rare (R)', value: 'R' },
    { label: 'Epic (E)', value: 'E' },
    { label: 'Legendary (L)', value: 'L' },
    { label: 'Mythical (M)', value: 'M' },
    { label: 'Divine (D)', value: 'D' },
    { label: 'Secret (?)', value: '?' },
    { label: 'Unknown (Un)', value: 'Un' },
    { label: 'Prime (P)', value: 'P' }
];

const FUMO_TRAITS = [
    { label: 'Normal (no trait)', value: 'normal' },
    { label: '✨ SHINY', value: 'shiny', suffix: '[✨SHINY]' },
    { label: '🌟 alG', value: 'alg', suffix: '[🌟alG]' }
];

const CURRENCY_TYPES = [
    { label: 'Coins 💰', value: 'coins', emoji: '💰', column: 'coins' },
    { label: 'Gems 💎', value: 'gems', emoji: '💎', column: 'gems' }
];

// ═══════════════════════════════════════════════════════════════
// AMOUNT PARSING CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const AMOUNT_SUFFIXES = {
    'k': 1e3,
    'm': 1e6,
    'b': 1e9,
    't': 1e12,
    'qa': 1e15,
    'qi': 1e18,
    'sx': 1e21,
    'sp': 1e24,
    'oc': 1e27,
    'no': 1e30,
    'dc': 1e33,
    'ud': 1e36,
    'dd': 1e39,
    'td': 1e42,
    'qad': 1e45,
    'qid': 1e48
};

// ═══════════════════════════════════════════════════════════════
// BAN DURATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const BAN_DURATION_MULTIPLIERS = {
    s: 1000,                        // seconds
    m: 60 * 1000,                   // minutes
    h: 60 * 60 * 1000,              // hours
    d: 24 * 60 * 60 * 1000,         // days
    w: 7 * 24 * 60 * 60 * 1000,     // weeks
    y: 365 * 24 * 60 * 60 * 1000    // years
};

// ═══════════════════════════════════════════════════════════════
// GUILD TRACKING CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const GUILD_FEATURES_MAP = {
    'ANIMATED_ICON': '🎬 Animated Icon',
    'BANNER': '🖼️ Banner',
    'COMMERCE': '🛒 Commerce',
    'COMMUNITY': '🏘️ Community',
    'DISCOVERABLE': '🔍 Discoverable',
    'FEATURABLE': '⭐ Featurable',
    'INVITE_SPLASH': '💦 Invite Splash',
    'MEMBER_VERIFICATION_GATE_ENABLED': '✅ Verification Gate',
    'NEWS': '📰 News Channels',
    'PARTNERED': '🤝 Partnered',
    'PREVIEW_ENABLED': '👁️ Preview',
    'VANITY_URL': '🔗 Vanity URL',
    'VERIFIED': '✅ Verified',
    'VIP_REGIONS': '🌐 VIP Regions',
    'WELCOME_SCREEN_ENABLED': '👋 Welcome Screen'
};

const BOOST_TIERS = {
    emojis: ['⚪', '🥉', '🥈', '🥇', '💎'],
    names: ['None', 'Tier 1', 'Tier 2', 'Tier 3']
};

// ═══════════════════════════════════════════════════════════════
// EMBED COLORS
// ═══════════════════════════════════════════════════════════════

const EMBED_COLORS = {
    SUCCESS: 'Green',
    ERROR: 'Red',
    WARNING: 'Orange',
    INFO: 'Blue',
    GREY: 'Grey',
    BAN: 'DarkRed',
    GUILD_JOIN: 0x00ff00,
    GUILD_LEAVE: 0xff0000
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a user ID has admin permissions
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId);
}

/**
 * Check if a user ID is the developer
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isDeveloper(userId) {
    return userId === DEVELOPER_ID;
}

/**
 * Validate a Discord user ID format
 * @param {string} userId - Discord user ID to validate
 * @returns {boolean}
 */
function isValidUserId(userId) {
    return /^\d{17,19}$/.test(userId);
}

module.exports = {
    // Admin IDs
    ADMIN_IDS,
    DEVELOPER_ID,
    
    // Channel IDs
    GUILD_LOG_CHANNEL_ID,
    REPORT_CHANNEL_ID,
    SUPPORT_GUILD_ID,
    
    // File Paths
    FILE_PATHS,
    DATA_DIR,
    
    // Ticket Config
    TICKET_TYPES,
    TICKET_EXPIRY_MS,
    
    // Rarity Config
    ITEM_RARITIES,
    FUMO_TRAITS,
    CURRENCY_TYPES,
    
    // Parsing Config
    AMOUNT_SUFFIXES,
    BAN_DURATION_MULTIPLIERS,
    
    // Guild Config
    GUILD_FEATURES_MAP,
    BOOST_TIERS,
    
    // Embed Colors
    EMBED_COLORS,
    
    // Helper Functions
    isAdmin,
    isDeveloper,
    isValidUserId
};
