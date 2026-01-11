/**
 * Moderation Service
 * Handles kick, mute, and ban operations with logging
 */

const { EmbedBuilder } = require('discord.js');
const GuildSettingsService = require('./GuildSettingsService');
const adminConfig = require('../Config/adminConfig');
const { formatDuration } = require('../../../MainCommand/Ultility/timeUtils');

// MODERATION ACTIONS

/**
 * Kick a user from the server
 * @param {GuildMember} target - Member to kick
 * @param {GuildMember} moderator - Moderator performing the action
 * @param {string} reason - Reason for kick
 * @returns {Promise<Object>} Result object
 */
async function kickUser(target, moderator, reason = adminConfig.DEFAULT_REASONS.KICK) {
    try {
        // Check if target can be kicked
        if (!target.kickable) {
            return {
                success: false,
                error: 'I cannot kick this user. They may have higher permissions than me.'
            };
        }

        // Check hierarchy
        if (target.roles.highest.position >= moderator.roles.highest.position && 
            moderator.id !== moderator.guild.ownerId) {
            return {
                success: false,
                error: 'You cannot kick someone with equal or higher role than you.'
            };
        }

        // Try to DM the user before kicking
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.MODERATION)
                .setTitle('🚪 You have been kicked')
                .setDescription(`You have been kicked from **${target.guild.name}**`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: moderator.user.tag }
                )
                .setTimestamp();
            
            await target.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            // User has DMs closed, continue with kick
        }

        // Perform the kick
        await target.kick(reason);

        // Log the action
        await logModAction(target.guild, {
            type: adminConfig.LOG_ACTIONS.KICK,
            target,
            moderator,
            reason
        });

        return {
            success: true,
            message: `Successfully kicked ${target.user.tag}`
        };
    } catch (error) {
        console.error('[ModerationService] Kick error:', error);
        return {
            success: false,
            error: `Failed to kick user: ${error.message}`
        };
    }
}

/**
 * Mute (timeout) a user
 * @param {GuildMember} target - Member to mute
 * @param {GuildMember} moderator - Moderator performing the action
 * @param {number} durationMs - Duration in milliseconds
 * @param {string} reason - Reason for mute
 * @returns {Promise<Object>} Result object
 */
async function muteUser(target, moderator, durationMs, reason = adminConfig.DEFAULT_REASONS.MUTE) {
    try {
        // Check if target can be timed out
        if (!target.moderatable) {
            return {
                success: false,
                error: 'I cannot mute this user. They may have higher permissions than me.'
            };
        }

        // Check hierarchy
        if (target.roles.highest.position >= moderator.roles.highest.position && 
            moderator.id !== moderator.guild.ownerId) {
            return {
                success: false,
                error: 'You cannot mute someone with equal or higher role than you.'
            };
        }

        // Clamp duration to Discord's max (28 days)
        const clampedDuration = Math.min(durationMs, adminConfig.MUTE_CONFIG.MAX_DURATION_MS);

        // Try to DM the user before muting
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.MODERATION)
                .setTitle('🔇 You have been muted')
                .setDescription(`You have been muted in **${target.guild.name}**`)
                .addFields(
                    { name: 'Duration', value: formatDuration(clampedDuration) },
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: moderator.user.tag }
                )
                .setTimestamp();
            
            await target.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            // User has DMs closed, continue with mute
        }

        // Perform the timeout
        await target.timeout(clampedDuration, reason);

        // Log the action
        await logModAction(target.guild, {
            type: adminConfig.LOG_ACTIONS.MUTE,
            target,
            moderator,
            reason,
            duration: clampedDuration
        });

        return {
            success: true,
            message: `Successfully muted ${target.user.tag} for ${formatDuration(clampedDuration)}`
        };
    } catch (error) {
        console.error('[ModerationService] Mute error:', error);
        return {
            success: false,
            error: `Failed to mute user: ${error.message}`
        };
    }
}

/**
 * Unmute a user (remove timeout)
 * @param {GuildMember} target - Member to unmute
 * @param {GuildMember} moderator - Moderator performing the action
 * @param {string} reason - Reason for unmute
 * @returns {Promise<Object>} Result object
 */
async function unmuteUser(target, moderator, reason = 'Unmuted by moderator') {
    try {
        if (!target.isCommunicationDisabled()) {
            return {
                success: false,
                error: 'This user is not muted.'
            };
        }

        // Remove timeout
        await target.timeout(null, reason);

        // Log the action
        await logModAction(target.guild, {
            type: adminConfig.LOG_ACTIONS.UNMUTE,
            target,
            moderator,
            reason
        });

        return {
            success: true,
            message: `Successfully unmuted ${target.user.tag}`
        };
    } catch (error) {
        console.error('[ModerationService] Unmute error:', error);
        return {
            success: false,
            error: `Failed to unmute user: ${error.message}`
        };
    }
}

/**
 * Ban a user from the server
 * @param {GuildMember|User} target - Member or User to ban
 * @param {GuildMember} moderator - Moderator performing the action
 * @param {string} reason - Reason for ban
 * @param {number} deleteMessageDays - Days of messages to delete (0-7)
 * @returns {Promise<Object>} Result object
 */
async function banUser(target, moderator, reason = adminConfig.DEFAULT_REASONS.BAN, deleteMessageDays = 0) {
    try {
        const guild = moderator.guild;
        const isMember = target.roles !== undefined; // Check if it's a GuildMember
        
        if (isMember) {
            // Check if target can be banned
            if (!target.bannable) {
                return {
                    success: false,
                    error: 'I cannot ban this user. They may have higher permissions than me.'
                };
            }

            // Check hierarchy
            if (target.roles.highest.position >= moderator.roles.highest.position && 
                moderator.id !== guild.ownerId) {
                return {
                    success: false,
                    error: 'You cannot ban someone with equal or higher role than you.'
                };
            }

            // Try to DM the user before banning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(adminConfig.COLORS.MODERATION)
                    .setTitle('🔨 You have been banned')
                    .setDescription(`You have been banned from **${guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: moderator.user.tag }
                    )
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                // User has DMs closed, continue with ban
            }
        }

        // Perform the ban
        const userId = isMember ? target.id : target.id;
        await guild.members.ban(userId, {
            reason: reason,
            deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60
        });

        // Log the action
        await logModAction(guild, {
            type: adminConfig.LOG_ACTIONS.BAN,
            target: isMember ? target : { user: target, id: target.id },
            moderator,
            reason,
            deleteMessageDays
        });

        const targetTag = isMember ? target.user.tag : target.tag;
        return {
            success: true,
            message: `Successfully banned ${targetTag}`
        };
    } catch (error) {
        console.error('[ModerationService] Ban error:', error);
        return {
            success: false,
            error: `Failed to ban user: ${error.message}`
        };
    }
}

/**
 * Unban a user from the server
 * @param {Guild} guild - Guild to unban from
 * @param {string} userId - User ID to unban
 * @param {GuildMember} moderator - Moderator performing the action
 * @param {string} reason - Reason for unban
 * @returns {Promise<Object>} Result object
 */
async function unbanUser(guild, userId, moderator, reason = 'Unbanned by moderator') {
    try {
        // Check if user is banned
        try {
            await guild.bans.fetch(userId);
        } catch {
            return {
                success: false,
                error: 'This user is not banned.'
            };
        }

        // Perform the unban
        await guild.members.unban(userId, reason);

        // Log the action
        await logModAction(guild, {
            type: adminConfig.LOG_ACTIONS.UNBAN,
            target: { id: userId },
            moderator,
            reason
        });

        return {
            success: true,
            message: `Successfully unbanned user ID: ${userId}`
        };
    } catch (error) {
        console.error('[ModerationService] Unban error:', error);
        return {
            success: false,
            error: `Failed to unban user: ${error.message}`
        };
    }
}

// LOGGING

/**
 * Log a moderation action to the guild's log channel
 * @param {Guild} guild - Guild where action occurred
 * @param {Object} action - Action details
 */
async function logModAction(guild, action) {
    try {
        const logChannelId = await GuildSettingsService.getLogChannel(guild.id);
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = createLogEmbed(action);
        await logChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[ModerationService] Logging error:', error);
    }
}

/**
 * Create a log embed for a moderation action
 * @param {Object} action - Action details
 * @returns {EmbedBuilder} Log embed
 */
function createLogEmbed(action) {
    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.MODERATION)
        .setTimestamp();

    const targetUser = action.target?.user || action.target;
    const targetTag = targetUser?.tag || `ID: ${action.target?.id || 'Unknown'}`;
    const targetId = action.target?.id || 'Unknown';

    switch (action.type) {
        case adminConfig.LOG_ACTIONS.KICK:
            embed.setTitle('👢 Member Kicked')
                .setDescription(`**${targetTag}** was kicked from the server`)
                .addFields(
                    { name: 'User ID', value: targetId, inline: true },
                    { name: 'Moderator', value: action.moderator.user.tag, inline: true },
                    { name: 'Reason', value: action.reason }
                );
            break;

        case adminConfig.LOG_ACTIONS.MUTE:
            embed.setTitle('🔇 Member Muted')
                .setDescription(`**${targetTag}** was muted`)
                .addFields(
                    { name: 'User ID', value: targetId, inline: true },
                    { name: 'Moderator', value: action.moderator.user.tag, inline: true },
                    { name: 'Duration', value: formatDuration(action.duration), inline: true },
                    { name: 'Reason', value: action.reason }
                );
            break;

        case adminConfig.LOG_ACTIONS.UNMUTE:
            embed.setTitle('🔊 Member Unmuted')
                .setColor(adminConfig.COLORS.SUCCESS)
                .setDescription(`**${targetTag}** was unmuted`)
                .addFields(
                    { name: 'User ID', value: targetId, inline: true },
                    { name: 'Moderator', value: action.moderator.user.tag, inline: true },
                    { name: 'Reason', value: action.reason }
                );
            break;

        case adminConfig.LOG_ACTIONS.BAN:
            embed.setTitle('🔨 Member Banned')
                .setDescription(`**${targetTag}** was banned from the server`)
                .addFields(
                    { name: 'User ID', value: targetId, inline: true },
                    { name: 'Moderator', value: action.moderator.user.tag, inline: true },
                    { name: 'Reason', value: action.reason }
                );
            if (action.deleteMessageDays > 0) {
                embed.addFields({ 
                    name: 'Messages Deleted', 
                    value: `${action.deleteMessageDays} day(s)`, 
                    inline: true 
                });
            }
            break;

        case adminConfig.LOG_ACTIONS.UNBAN:
            embed.setTitle('🔓 Member Unbanned')
                .setColor(adminConfig.COLORS.SUCCESS)
                .setDescription(`User ID **${targetId}** was unbanned`)
                .addFields(
                    { name: 'Moderator', value: action.moderator.user.tag, inline: true },
                    { name: 'Reason', value: action.reason }
                );
            break;

        case adminConfig.LOG_ACTIONS.DELETE:
            embed.setTitle('🗑️ Messages Deleted')
                .setColor(adminConfig.COLORS.WARNING)
                .setDescription(`${action.count} message(s) deleted in ${action.channel}`)
                .addFields(
                    { name: 'Moderator', value: action.moderator?.tag || 'Unknown', inline: true },
                    { name: 'Count', value: String(action.count), inline: true }
                );
            if (action.filters) {
                embed.addFields({ name: 'Filters', value: action.filters, inline: false });
            }
            break;

        default:
            embed.setTitle('📋 Moderation Action')
                .setDescription(`Action: ${action.type}`)
                .addFields({ name: 'Details', value: JSON.stringify(action, null, 2).slice(0, 1000) });
    }

    if (targetUser?.displayAvatarURL) {
        embed.setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));
    }

    return embed;
}

// UTILITY FUNCTIONS

/**
 * Parse duration string into milliseconds
 * @param {string} durationStr - Duration string (e.g., "1h", "30m", "7d")
 * @returns {number|null} Duration in milliseconds or null if invalid
 */
function parseDuration(durationStr) {
    if (!durationStr) return null;

    // Check presets first
    const preset = adminConfig.MUTE_CONFIG.DURATION_PRESETS[durationStr.toLowerCase()];
    if (preset) return preset;

    // Parse custom format
    const match = durationStr.match(/^(\d+)(s|m|h|d|w)?$/i);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = (match[2] || 'm').toLowerCase();

    const multipliers = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000,
        'w': 7 * 24 * 60 * 60 * 1000
    };

    return value * (multipliers[unit] || multipliers['m']);
}

// formatDuration is now imported from timeUtils

// EXPORTS

module.exports = {
    // Actions
    kickUser,
    muteUser,
    unmuteUser,
    banUser,
    unbanUser,
    
    // Logging
    logModAction,
    createLogEmbed,
    
    // Utilities
    parseDuration,
    formatDuration
};
