/**
 * Ban Commands Handler
 * Handles ban and unban command registration and execution
 */

const { EmbedBuilder } = require('discord.js');
const { DEVELOPER_ID, isDeveloper, isValidUserId, EMBED_COLORS } = require('../Config/adminConfig');
const BanService = require('../Service/BanService');
const { parseDuration, formatDuration } = require('../Utils/adminUtils');

// ═══════════════════════════════════════════════════════════════
// EMBED BUILDERS
// ═══════════════════════════════════════════════════════════════

function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setTitle(title)
        .setDescription(description);
}

function createSuccessEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setTitle(title)
        .setDescription(description);
}

function createWarningEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(EMBED_COLORS.WARNING)
        .setTitle(title)
        .setDescription(description);
}

// ═══════════════════════════════════════════════════════════════
// COMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Handle the .ban command
 * @param {Message} message - Discord message
 * @param {Array} args - Command arguments
 * @param {string} developerID - Developer ID for permission check
 */
async function handleBanCommand(message, args, developerID) {
    // Permission check
    if (!isDeveloper(message.author.id) && message.author.id !== developerID) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Permission Denied', 'You do not have permission to use this command.')]
        });
    }

    const userId = args[0];

    // Validate user ID
    if (!userId || !isValidUserId(userId)) {
        return message.reply({
            embeds: [createWarningEmbed('⚠️ Invalid Input', 'Please provide a valid user ID.')]
        });
    }

    // Self-ban check
    if (userId === message.author.id) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Action Forbidden', 'You cannot ban yourself.')]
        });
    }

    // Bot-ban check
    if (userId === message.client.user.id) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Action Forbidden', 'You cannot ban the bot.')]
        });
    }

    // Parse duration if provided
    const durationStr = args.find(arg => /^(\d+)([smhdwy])$/i.test(arg));
    const durationMs = durationStr ? parseDuration(durationStr) : null;

    // Extract reason
    const reason = args
        .filter(arg => arg !== userId && arg !== durationStr)
        .join(' ') || 'No reason provided';

    // Execute ban
    BanService.banUser(userId, reason, durationMs);

    const embed = new EmbedBuilder()
        .setTitle('✅ User Banned')
        .setColor(EMBED_COLORS.BAN)
        .addFields(
            { name: 'User ID', value: `<@${userId}>`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: durationMs ? formatDuration(durationMs) : 'Permanent', inline: true }
        )
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

/**
 * Handle the .unban command
 * @param {Message} message - Discord message
 * @param {Array} args - Command arguments
 * @param {string} developerID - Developer ID for permission check
 */
async function handleUnbanCommand(message, args, developerID) {
    // Permission check
    if (!isDeveloper(message.author.id) && message.author.id !== developerID) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Permission Denied', 'You do not have permission to use this command.')]
        });
    }

    const userId = args[0];

    // Validate user ID
    if (!userId || !isValidUserId(userId)) {
        return message.reply({
            embeds: [createWarningEmbed('⚠️ Invalid Input', 'Please provide a valid user ID to unban.')]
        });
    }

    // Execute unban
    const wasUnbanned = BanService.unbanUser(userId);

    if (wasUnbanned) {
        return message.reply({
            embeds: [createSuccessEmbed('✅ User Unbanned', `Successfully unbanned <@${userId}>.`)]
        });
    } else {
        return message.reply({
            embeds: [createWarningEmbed('⚠️ Not Found', `User <@${userId}> was not found in the ban list.`)]
        });
    }
}

/**
 * Handle the .baninfo command
 * @param {Message} message - Discord message
 * @param {Array} args - Command arguments
 * @param {string} developerID - Developer ID for permission check
 */
async function handleBanInfoCommand(message, args, developerID) {
    // Permission check
    if (!isDeveloper(message.author.id) && message.author.id !== developerID) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Permission Denied', 'You do not have permission to use this command.')]
        });
    }

    const userId = args[0];

    // Validate user ID
    if (!userId || !isValidUserId(userId)) {
        return message.reply({
            embeds: [createWarningEmbed('⚠️ Invalid Input', 'Please provide a valid user ID.')]
        });
    }

    const banInfo = BanService.getBanInfo(userId);

    if (!banInfo) {
        return message.reply({
            embeds: [createSuccessEmbed('✅ Not Banned', `User <@${userId}> is not currently banned.`)]
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('🔍 Ban Information')
        .setColor(EMBED_COLORS.BAN)
        .addFields(
            { name: 'User', value: `<@${userId}>`, inline: true },
            { name: 'Reason', value: banInfo.reason, inline: true },
            { name: 'Duration', value: banInfo.remainingFormatted, inline: true },
            { name: 'Banned At', value: banInfo.bannedAtFormatted, inline: true },
            { name: 'Permanent', value: banInfo.isPermanent ? 'Yes' : 'No', inline: true }
        )
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

/**
 * Handle the .banlist command
 * @param {Message} message - Discord message
 * @param {string} developerID - Developer ID for permission check
 */
async function handleBanListCommand(message, developerID) {
    // Permission check
    if (!isDeveloper(message.author.id) && message.author.id !== developerID) {
        return message.reply({
            embeds: [createErrorEmbed('❌ Permission Denied', 'You do not have permission to use this command.')]
        });
    }

    const bans = BanService.getAllBans();

    if (bans.length === 0) {
        return message.reply({
            embeds: [createSuccessEmbed('📋 Ban List', 'No users are currently banned.')]
        });
    }

    const banListText = bans.slice(0, 20).map((ban, index) => {
        const remaining = ban.expiresAt ? formatDuration(ban.expiresAt - Date.now()) : 'Permanent';
        return `${index + 1}. <@${ban.userId}> - ${remaining}\n   Reason: ${ban.reason.substring(0, 50)}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setTitle(`📋 Ban List (${bans.length} total)`)
        .setColor(EMBED_COLORS.BAN)
        .setDescription(banListText || 'No bans to display.')
        .setFooter({ text: bans.length > 20 ? `Showing first 20 of ${bans.length} bans` : '' })
        .setTimestamp();

    return message.reply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Register ban system commands
 * @param {Client} client - Discord client
 * @param {string} developerID - Developer ID for permission checks
 */
function registerBanSystem(client, developerID = DEVELOPER_ID) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const prefix = '.';
        if (!message.content.startsWith(prefix)) return;

        const fullCommand = message.content.slice(prefix.length).trim();
        const [command, ...args] = fullCommand.split(/ +/);
        const lowerCommand = command?.toLowerCase();

        switch (lowerCommand) {
            case 'ban':
                await handleBanCommand(message, args, developerID);
                break;
            case 'unban':
                await handleUnbanCommand(message, args, developerID);
                break;
            case 'baninfo':
                await handleBanInfoCommand(message, args, developerID);
                break;
            case 'banlist':
                await handleBanListCommand(message, developerID);
                break;
        }
    });
}

module.exports = {
    registerBanSystem,
    handleBanCommand,
    handleUnbanCommand,
    handleBanInfoCommand,
    handleBanListCommand,
    
    // Re-export service functions for backward compatibility
    banUser: BanService.banUser,
    unbanUser: BanService.unbanUser,
    isUserBanned: BanService.isUserBanned,
    parseDuration
};
