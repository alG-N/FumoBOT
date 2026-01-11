/**
 * /kick Command
 * Kick a user from the server
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const ModerationService = require('../Service/ModerationService');
const GuildSettingsService = require('../Service/GuildSettingsService');
const adminConfig = require('../Config/adminConfig');

// SLASH COMMAND DEFINITION

const data = new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
        opt.setName('user')
            .setDescription('The user to kick')
            .setRequired(true))
    .addStringOption(opt =>
        opt.setName('reason')
            .setDescription('Reason for the kick')
            .setRequired(false)
            .setMaxLength(500));

// COMMAND EXECUTION

async function execute(interaction) {
    // Check permissions
    const hasPerm = await GuildSettingsService.hasModPermission(interaction.member);
    
    if (!hasPerm && !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({
            content: '❌ You do not have permission to kick members.',
            ephemeral: true
        });
    }

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || adminConfig.DEFAULT_REASONS.KICK;

    // Get the member object
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({
            content: '❌ User not found in this server.',
            ephemeral: true
        });
    }

    // Prevent self-kick
    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            content: '❌ You cannot kick yourself.',
            ephemeral: true
        });
    }

    // Prevent kicking the bot
    if (targetUser.id === interaction.client.user.id) {
        return interaction.reply({
            content: '❌ I cannot kick myself.',
            ephemeral: true
        });
    }

    // Prevent kicking server owner
    if (targetUser.id === interaction.guild.ownerId) {
        return interaction.reply({
            content: '❌ You cannot kick the server owner.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    try {
        const result = await ModerationService.kickUser(targetMember, interaction.member, reason);

        if (result.success) {
            const embed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.MODERATION)
                .setTitle('👢 User Kicked')
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
        console.error('[/kick] Error:', error);
        return interaction.editReply({
            content: '❌ An error occurred while trying to kick the user.'
        });
    }
}

// EXPORTS

module.exports = {
    data,
    execute
};
