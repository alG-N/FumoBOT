/**
 * /ban Command
 * Ban a user from the server
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
    .setName('ban')
    .setDescription('Ban or unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addSubcommand(sub =>
        sub.setName('add')
            .setDescription('Ban a user from the server')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('The user to ban')
                    .setRequired(true))
            .addStringOption(opt =>
                opt.setName('reason')
                    .setDescription('Reason for the ban')
                    .setRequired(false)
                    .setMaxLength(500))
            .addIntegerOption(opt =>
                opt.setName('delete_messages')
                    .setDescription('Days of messages to delete (0-7)')
                    .setRequired(false)
                    .setMinValue(0)
                    .setMaxValue(7)))
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Unban a user from the server')
            .addStringOption(opt =>
                opt.setName('user_id')
                    .setDescription('The user ID to unban')
                    .setRequired(true))
            .addStringOption(opt =>
                opt.setName('reason')
                    .setDescription('Reason for the unban')
                    .setRequired(false)
                    .setMaxLength(500)))
    .addSubcommand(sub =>
        sub.setName('list')
            .setDescription('View the server ban list'));

// COMMAND EXECUTION

async function execute(interaction) {
    // Check permissions
    const hasPerm = await GuildSettingsService.hasAdminPermission(interaction.member);
    
    if (!hasPerm && !interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({
            content: '❌ You do not have permission to ban members.',
            ephemeral: true
        });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'add':
                return await handleBan(interaction);
            case 'remove':
                return await handleUnban(interaction);
            case 'list':
                return await handleList(interaction);
            default:
                return interaction.reply({
                    content: '❌ Unknown subcommand.',
                    ephemeral: true
                });
        }
    } catch (error) {
        console.error('[/ban] Error:', error);
        const errorMsg = { content: '❌ An error occurred while processing the command.' };
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(errorMsg);
        }
        return interaction.reply(errorMsg);
    }
}

// SUBCOMMAND HANDLERS

/**
 * Handle ban subcommand
 */
async function handleBan(interaction) {
    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || adminConfig.DEFAULT_REASONS.BAN;
    const deleteMessageDays = interaction.options.getInteger('delete_messages') || 0;

    // Prevent self-ban
    if (targetUser.id === interaction.user.id) {
        return interaction.reply({
            content: '❌ You cannot ban yourself.',
            ephemeral: true
        });
    }

    // Prevent banning the bot
    if (targetUser.id === interaction.client.user.id) {
        return interaction.reply({
            content: '❌ I cannot ban myself.',
            ephemeral: true
        });
    }

    // Prevent banning server owner
    if (targetUser.id === interaction.guild.ownerId) {
        return interaction.reply({
            content: '❌ You cannot ban the server owner.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    // Try to get member (they might not be in the server)
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const result = await ModerationService.banUser(
        targetMember || targetUser, 
        interaction.member, 
        reason, 
        deleteMessageDays
    );

    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(adminConfig.COLORS.MODERATION)
            .setTitle('🔨 User Banned')
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'Moderator', value: interaction.user.tag, inline: true },
                { name: 'Reason', value: reason }
            )
            .setTimestamp();

        if (deleteMessageDays > 0) {
            embed.addFields({
                name: 'Messages Deleted',
                value: `${deleteMessageDays} day(s)`,
                inline: true
            });
        }

        return interaction.editReply({ embeds: [embed] });
    } else {
        return interaction.editReply({
            content: `❌ ${result.error}`
        });
    }
}

/**
 * Handle unban subcommand
 */
async function handleUnban(interaction) {
    const userId = interaction.options.getString('user_id');
    const reason = interaction.options.getString('reason') || 'Unbanned by moderator';

    // Validate user ID format
    if (!/^\d{17,19}$/.test(userId)) {
        return interaction.reply({
            content: '❌ Invalid user ID format.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const result = await ModerationService.unbanUser(
        interaction.guild, 
        userId, 
        interaction.member, 
        reason
    );

    if (result.success) {
        const embed = new EmbedBuilder()
            .setColor(adminConfig.COLORS.SUCCESS)
            .setTitle('🔓 User Unbanned')
            .addFields(
                { name: 'User ID', value: userId, inline: true },
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
}

/**
 * Handle list subcommand
 */
async function handleList(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const bans = await interaction.guild.bans.fetch();

        if (bans.size === 0) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(adminConfig.COLORS.INFO)
                        .setTitle('📋 Ban List')
                        .setDescription('No users are currently banned.')
                ]
            });
        }

        // Paginate if too many bans
        const banArray = Array.from(bans.values()).slice(0, 25);
        const totalBans = bans.size;

        const banList = banArray.map(ban => 
            `• **${ban.user.tag}** (${ban.user.id})\n  └ ${ban.reason || 'No reason provided'}`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor(adminConfig.COLORS.INFO)
            .setTitle(`📋 Ban List (${totalBans} total)`)
            .setDescription(banList.slice(0, 4096))
            .setTimestamp();

        if (totalBans > 25) {
            embed.setFooter({ text: `Showing 25 of ${totalBans} bans` });
        }

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('[/ban list] Error:', error);
        return interaction.editReply({
            content: '❌ Failed to fetch ban list.'
        });
    }
}

// EXPORTS

module.exports = {
    data,
    execute
};
