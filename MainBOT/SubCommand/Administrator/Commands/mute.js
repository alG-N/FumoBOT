/**
 * /mute Command
 * Timeout/mute a user in the server
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const ModerationService = require('../Service/ModerationService');
const GuildSettingsService = require('../Service/GuildSettingsService');
const adminConfig = require('../Config/adminConfig');

// ═══════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITION
// ═══════════════════════════════════════════════════════════════

const data = new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute (timeout) a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Mute a user')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('The user to mute')
                    .setRequired(true))
            .addStringOption(opt =>
                opt.setName('duration')
                    .setDescription('Duration (e.g., 10m, 1h, 1d, 7d)')
                    .setRequired(true)
                    .addChoices(
                        { name: '1 minute', value: '1m' },
                        { name: '5 minutes', value: '5m' },
                        { name: '10 minutes', value: '10m' },
                        { name: '30 minutes', value: '30m' },
                        { name: '1 hour', value: '1h' },
                        { name: '6 hours', value: '6h' },
                        { name: '12 hours', value: '12h' },
                        { name: '1 day', value: '1d' },
                        { name: '7 days', value: '7d' },
                        { name: '14 days', value: '14d' },
                        { name: '28 days (max)', value: '28d' }
                    ))
            .addStringOption(opt =>
                opt.setName('reason')
                    .setDescription('Reason for the mute')
                    .setRequired(false)
                    .setMaxLength(500)))
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Unmute a user')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('The user to unmute')
                    .setRequired(true))
            .addStringOption(opt =>
                opt.setName('reason')
                    .setDescription('Reason for the unmute')
                    .setRequired(false)
                    .setMaxLength(500)));

// ═══════════════════════════════════════════════════════════════
// COMMAND EXECUTION
// ═══════════════════════════════════════════════════════════════

async function execute(interaction) {
    // Check permissions
    const hasPerm = await GuildSettingsService.hasModPermission(interaction.member);
    
    if (!hasPerm && !interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
            content: '❌ You do not have permission to mute members.',
            ephemeral: true
        });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
        return handleMute(interaction);
    } else {
        return handleUnmute(interaction);
    }
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Handle mute subcommand
 */
async function handleMute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || adminConfig.DEFAULT_REASONS.MUTE;

    // Parse duration
    const durationMs = ModerationService.parseDuration(durationStr);
    if (!durationMs) {
        return interaction.reply({
            content: '❌ Invalid duration format.',
            ephemeral: true
        });
    }

    // Get the member object
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content: '❌ User not found in this server.',
            ephemeral: true
        });
    }

    // Prevent self-mute
    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            content: '❌ You cannot mute yourself.',
            ephemeral: true
        });
    }

    // Prevent muting the bot
    if (targetUser.id === interaction.client.user.id) {
        return interaction.reply({
            content: '❌ I cannot mute myself.',
            ephemeral: true
        });
    }

    // Prevent muting server owner
    if (targetUser.id === interaction.guild.ownerId) {
        return interaction.reply({
            content: '❌ You cannot mute the server owner.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const result = await ModerationService.muteUser(
            targetMember, 
            interaction.member, 
            durationMs, 
            reason
        );

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.MODERATION)
                .setTitle('🔇 User Muted')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Duration', value: ModerationService.formatDuration(durationMs), inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Expires', value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:R>`, inline: true }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } else {
            return interaction.editReply({
                content: `❌ ${result.error}`
            });
        }
    } catch (error) {
        console.error('[/mute add] Error:', error);
        return interaction.editReply({
            content: '❌ An error occurred while trying to mute the user.'
        });
    }
}

/**
 * Handle unmute subcommand
 */
async function handleUnmute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Unmuted by moderator';

    // Get the member object
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content: '❌ User not found in this server.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const result = await ModerationService.unmuteUser(targetMember, interaction.member, reason);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.SUCCESS)
                .setTitle('🔊 User Unmuted')
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason }
                )
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } else {
            return interaction.editReply({
                content: `❌ ${result.error}`
            });
        }
    } catch (error) {
        console.error('[/mute remove] Error:', error);
        return interaction.editReply({
            content: '❌ An error occurred while trying to unmute the user.'
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    data,
    execute
};
