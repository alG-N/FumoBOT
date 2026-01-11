/**
 * Guild Settings Service
 * Manages server-specific settings and configurations
 * Uses separate admin database
 */

const { run, get, all } = require('../Database/adminDatabase');
const adminConfig = require('../Config/adminConfig');

// GET SETTINGS

/**
 * Get guild settings, creating default if not exists
 * @param {string} guildId - Guild ID
 * @returns {Promise<Object>} Guild settings object
 */
async function getGuildSettings(guildId) {
    try {
        const row = await get('SELECT * FROM guildSettings WHERE guildId = ?', [guildId]);

        if (row) {
            // Parse JSON fields
            try {
                row.admin_roles = JSON.parse(row.admin_roles || '[]');
                row.mod_roles = JSON.parse(row.mod_roles || '[]');
            } catch (e) {
                row.admin_roles = [];
                row.mod_roles = [];
            }
            return row;
        }

        // Create default settings
        const defaults = adminConfig.DEFAULT_GUILD_SETTINGS;
        const now = Date.now();

        await run(`
            INSERT INTO guildSettings (
                guildId, snipe_limit, delete_limit, announcement_channel, log_channel,
                admin_roles, mod_roles, mute_role, auto_mod_enabled,
                welcome_channel, welcome_message, goodbye_channel, goodbye_message,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            guildId,
            defaults.snipe_limit,
            defaults.delete_limit,
            defaults.announcement_channel,
            defaults.log_channel,
            JSON.stringify(defaults.admin_roles),
            JSON.stringify(defaults.mod_roles),
            defaults.mute_role,
            defaults.auto_mod_enabled ? 1 : 0,
            defaults.welcome_channel,
            defaults.welcome_message,
            defaults.goodbye_channel,
            defaults.goodbye_message,
            now,
            now
        ]);

        // Return the default settings with arrays already parsed
        return {
            guildId,
            ...defaults,
            created_at: now,
            updated_at: now
        };
    } catch (error) {
        console.error('[GuildSettings] Error getting settings:', error);
        // Return defaults on error
        return {
            guildId,
            ...adminConfig.DEFAULT_GUILD_SETTINGS
        };
    }
}

// UPDATE SETTINGS

/**
 * Update guild settings
 * @param {string} guildId - Guild ID
 * @param {Object} updates - Settings to update
 * @returns {Promise<Object>} Updated settings
 */
async function updateGuildSettings(guildId, updates) {
    // First ensure the guild has settings
    await getGuildSettings(guildId);

    const allowedFields = [
        'snipe_limit', 'delete_limit', 'announcement_channel', 'log_channel',
        'admin_roles', 'mod_roles', 'mute_role', 'auto_mod_enabled',
        'welcome_channel', 'welcome_message', 'goodbye_channel', 'goodbye_message'
    ];

    const filteredUpdates = {};
    for (const key of Object.keys(updates)) {
        if (allowedFields.includes(key)) {
            filteredUpdates[key] = updates[key];
        }
    }

    // Stringify array fields
    if (Array.isArray(filteredUpdates.admin_roles)) {
        filteredUpdates.admin_roles = JSON.stringify(filteredUpdates.admin_roles);
    }
    if (Array.isArray(filteredUpdates.mod_roles)) {
        filteredUpdates.mod_roles = JSON.stringify(filteredUpdates.mod_roles);
    }

    const fields = Object.keys(filteredUpdates);
    if (fields.length === 0) {
        return getGuildSettings(guildId);
    }

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = [...fields.map(f => filteredUpdates[f]), Date.now(), guildId];

    await run(
        `UPDATE guildSettings SET ${setClause}, updated_at = ? WHERE guildId = ?`,
        values
    );

    return getGuildSettings(guildId);
}

// SPECIFIC SETTING HELPERS

/**
 * Get snipe limit for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<number>} Snipe limit
 */
async function getSnipeLimit(guildId) {
    const settings = await getGuildSettings(guildId);
    return settings.snipe_limit || adminConfig.SNIPE_CONFIG.DEFAULT_LIMIT;
}

/**
 * Set snipe limit for a guild
 * @param {string} guildId - Guild ID
 * @param {number} limit - New snipe limit
 * @returns {Promise<Object>} Updated settings
 */
async function setSnipeLimit(guildId, limit) {
    const { MIN_LIMIT, MAX_LIMIT } = adminConfig.SNIPE_CONFIG;
    const clampedLimit = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, limit));
    return updateGuildSettings(guildId, { snipe_limit: clampedLimit });
}

/**
 * Get announcement channel for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Channel ID or null
 */
async function getAnnouncementChannel(guildId) {
    const settings = await getGuildSettings(guildId);
    return settings.announcement_channel;
}

/**
 * Set announcement channel for a guild
 * @param {string} guildId - Guild ID
 * @param {string|null} channelId - Channel ID or null to disable
 * @returns {Promise<Object>} Updated settings
 */
async function setAnnouncementChannel(guildId, channelId) {
    return updateGuildSettings(guildId, { announcement_channel: channelId });
}

/**
 * Get log channel for a guild
 * @param {string} guildId - Guild ID
 * @returns {Promise<string|null>} Channel ID or null
 */
async function getLogChannel(guildId) {
    const settings = await getGuildSettings(guildId);
    return settings.log_channel;
}

/**
 * Set log channel for a guild
 * @param {string} guildId - Guild ID
 * @param {string|null} channelId - Channel ID or null to disable
 * @returns {Promise<Object>} Updated settings
 */
async function setLogChannel(guildId, channelId) {
    return updateGuildSettings(guildId, { log_channel: channelId });
}

/**
 * Add an admin role
 * @param {string} guildId - Guild ID
 * @param {string} roleId - Role ID to add
 * @returns {Promise<Object>} Updated settings
 */
async function addAdminRole(guildId, roleId) {
    const settings = await getGuildSettings(guildId);
    const roles = settings.admin_roles || [];
    if (!roles.includes(roleId)) {
        roles.push(roleId);
    }
    return updateGuildSettings(guildId, { admin_roles: roles });
}

/**
 * Remove an admin role
 * @param {string} guildId - Guild ID
 * @param {string} roleId - Role ID to remove
 * @returns {Promise<Object>} Updated settings
 */
async function removeAdminRole(guildId, roleId) {
    const settings = await getGuildSettings(guildId);
    const roles = (settings.admin_roles || []).filter(r => r !== roleId);
    return updateGuildSettings(guildId, { admin_roles: roles });
}

/**
 * Add a moderator role
 * @param {string} guildId - Guild ID
 * @param {string} roleId - Role ID to add
 * @returns {Promise<Object>} Updated settings
 */
async function addModRole(guildId, roleId) {
    const settings = await getGuildSettings(guildId);
    const roles = settings.mod_roles || [];
    if (!roles.includes(roleId)) {
        roles.push(roleId);
    }
    return updateGuildSettings(guildId, { mod_roles: roles });
}

/**
 * Remove a moderator role
 * @param {string} guildId - Guild ID
 * @param {string} roleId - Role ID to remove
 * @returns {Promise<Object>} Updated settings
 */
async function removeModRole(guildId, roleId) {
    const settings = await getGuildSettings(guildId);
    const roles = (settings.mod_roles || []).filter(r => r !== roleId);
    return updateGuildSettings(guildId, { mod_roles: roles });
}

// PERMISSION CHECKING

/**
 * Check if a member has admin permissions in the guild
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} True if has admin access
 */
async function hasAdminPermission(member) {
    // Server owner always has permission
    if (member.guild.ownerId === member.id) {
        return true;
    }

    // Discord Administrator permission
    if (member.permissions.has('Administrator')) {
        return true;
    }

    // Check custom admin roles
    const settings = await getGuildSettings(member.guild.id);
    const adminRoles = settings.admin_roles || [];
    
    return member.roles.cache.some(role => adminRoles.includes(role.id));
}

/**
 * Check if a member has moderator permissions in the guild
 * @param {GuildMember} member - Discord guild member
 * @returns {Promise<boolean>} True if has mod access
 */
async function hasModPermission(member) {
    // Admin access includes mod access
    if (await hasAdminPermission(member)) {
        return true;
    }

    // Discord moderation permissions
    if (member.permissions.has('ModerateMembers') || 
        member.permissions.has('KickMembers') ||
        member.permissions.has('BanMembers')) {
        return true;
    }

    // Check custom mod roles
    const settings = await getGuildSettings(member.guild.id);
    const modRoles = settings.mod_roles || [];
    
    return member.roles.cache.some(role => modRoles.includes(role.id));
}

/**
 * Check if user is the server owner
 * @param {GuildMember} member - Discord guild member
 * @returns {boolean} True if server owner
 */
function isServerOwner(member) {
    return member.guild.ownerId === member.id;
}

// EXPORTS

module.exports = {
    // Main getters/setters
    getGuildSettings,
    updateGuildSettings,
    
    // Specific settings
    getSnipeLimit,
    setSnipeLimit,
    getAnnouncementChannel,
    setAnnouncementChannel,
    getLogChannel,
    setLogChannel,
    
    // Role management
    addAdminRole,
    removeAdminRole,
    addModRole,
    removeModRole,
    
    // Permission checking
    hasAdminPermission,
    hasModPermission,
    isServerOwner
};
