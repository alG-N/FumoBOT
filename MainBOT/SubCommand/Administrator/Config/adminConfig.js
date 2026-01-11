/**
 * Server Administrator Configuration
 */

module.exports = {
    // Default settings for new guilds
    DEFAULT_GUILD_SETTINGS: {
        snipe_limit: 10,                    // Default number of messages to track for snipe
        delete_limit: 100,                  // Default max messages to delete at once
        announcement_channel: null,          // Channel ID for bot announcements
        admin_roles: [],                    // Role IDs that can use admin commands
        mod_roles: [],                      // Role IDs that can use moderation commands
        mute_role: null,                    // Role ID to assign for mutes (if not using timeout)
        log_channel: null,                  // Channel ID for moderation logs
        auto_mod_enabled: false,            // Whether auto-moderation is enabled
        welcome_channel: null,              // Channel ID for welcome messages
        welcome_message: null,              // Custom welcome message
        goodbye_channel: null,              // Channel ID for goodbye messages
        goodbye_message: null               // Custom goodbye message
    },

    // Permission levels
    PERMISSION_LEVELS: {
        SERVER_OWNER: 4,      // Server owner only
        ADMINISTRATOR: 3,      // Has Administrator permission
        MODERATOR: 2,          // Has moderation permissions or mod role
        MEMBER: 1,             // Regular member
        RESTRICTED: 0          // Restricted/muted
    },

    // Snipe configuration
    SNIPE_CONFIG: {
        MIN_LIMIT: 1,
        MAX_LIMIT: 50,
        DEFAULT_LIMIT: 10,
        MAX_MESSAGE_AGE_MS: 24 * 60 * 60 * 1000  // 24 hours
    },

    // Delete configuration
    DELETE_CONFIG: {
        MIN_LIMIT: 1,
        MAX_LIMIT: 500,         // Server configurable max
        DISCORD_LIMIT: 100,     // Discord's max per bulk delete
        DEFAULT_LIMIT: 100,
        MAX_MESSAGE_AGE_DAYS: 14  // Discord only allows bulk delete for messages < 14 days old
    },

    // Mute configuration
    MUTE_CONFIG: {
        DEFAULT_DURATION_MS: 5 * 60 * 1000,    // 5 minutes default
        MAX_DURATION_MS: 28 * 24 * 60 * 60 * 1000,  // 28 days max (Discord limit)
        DURATION_PRESETS: {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '10m': 10 * 60 * 1000,
            '30m': 30 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '1d': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '14d': 14 * 24 * 60 * 60 * 1000,
            '28d': 28 * 24 * 60 * 60 * 1000
        }
    },

    // Command cooldowns (ms)
    COOLDOWNS: {
        setting: 3000,
        snipe: 2000,
        kick: 1000,
        mute: 1000,
        ban: 1000
    },

    // Embed colors
    COLORS: {
        SUCCESS: 0x00FF00,
        ERROR: 0xFF0000,
        WARNING: 0xFFAA00,
        INFO: 0x00AAFF,
        MODERATION: 0xFF5555,
        SETTING: 0x5865F2,
        SNIPE: 0x9B59B6
    },

    // Moderation reasons
    DEFAULT_REASONS: {
        KICK: 'No reason provided',
        MUTE: 'No reason provided',
        BAN: 'No reason provided'
    },

    // Log action types
    LOG_ACTIONS: {
        KICK: 'KICK',
        MUTE: 'MUTE',
        UNMUTE: 'UNMUTE',
        BAN: 'BAN',
        UNBAN: 'UNBAN',
        SETTING_CHANGE: 'SETTING_CHANGE'
    }
};
