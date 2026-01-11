/**
 * /setting Command
 * Server owner settings configuration
 * Only server owners can access this command
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

const GuildSettingsService = require('../Service/GuildSettingsService');
const adminConfig = require('../Config/adminConfig');

// ═══════════════════════════════════════════════════════════════
// SLASH COMMAND DEFINITION
// ═══════════════════════════════════════════════════════════════

const data = new SlashCommandBuilder()
    .setName('setting')
    .setDescription('Configure server settings (Server Owner only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('view')
            .setDescription('View current server settings'))
    .addSubcommand(sub =>
        sub.setName('snipe')
            .setDescription('Configure snipe message limit')
            .addIntegerOption(opt =>
                opt.setName('limit')
                    .setDescription('Number of deleted messages to track (1-50)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(50)))
    .addSubcommand(sub =>
        sub.setName('announcement')
            .setDescription('Set the announcement channel')
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel for bot announcements (leave empty to disable)')
                    .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
        sub.setName('log')
            .setDescription('Set the moderation log channel')
            .addChannelOption(opt =>
                opt.setName('channel')
                    .setDescription('Channel for moderation logs (leave empty to disable)')
                    .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub =>
        sub.setName('adminrole')
            .setDescription('Manage admin roles')
            .addStringOption(opt =>
                opt.setName('action')
                    .setDescription('Add or remove role')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' }
                    ))
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Role to add/remove')
                    .setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('modrole')
            .setDescription('Manage moderator roles')
            .addStringOption(opt =>
                opt.setName('action')
                    .setDescription('Add or remove role')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Add', value: 'add' },
                        { name: 'Remove', value: 'remove' }
                    ))
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Role to add/remove')
                    .setRequired(true)))
    .addSubcommand(sub =>
        sub.setName('reset')
            .setDescription('Reset all settings to default'));

// ═══════════════════════════════════════════════════════════════
// COMMAND EXECUTION
// ═══════════════════════════════════════════════════════════════

async function execute(interaction) {
    // Only server owner can use this command
    if (!GuildSettingsService.isServerOwner(interaction.member)) {
        return interaction.reply({
            content: '❌ Only the server owner can use this command.',
            ephemeral: true
        });
    }

    const subcommand = interaction.options.getSubcommand();

    try {
        switch (subcommand) {
            case 'view':
                return await handleView(interaction);
            case 'snipe':
                return await handleSnipe(interaction);
            case 'announcement':
                return await handleAnnouncement(interaction);
            case 'log':
                return await handleLog(interaction);
            case 'adminrole':
                return await handleAdminRole(interaction);
            case 'modrole':
                return await handleModRole(interaction);
            case 'reset':
                return await handleReset(interaction);
            default:
                return interaction.reply({
                    content: '❌ Unknown subcommand.',
                    ephemeral: true
                });
        }
    } catch (error) {
        console.error('[/setting] Error:', error);
        const errorMsg = { content: '❌ An error occurred while processing the command.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp(errorMsg);
        }
        return interaction.reply(errorMsg);
    }
}

// ═══════════════════════════════════════════════════════════════
// SUBCOMMAND HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * View current server settings
 */
async function handleView(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const settings = await GuildSettingsService.getGuildSettings(interaction.guild.id);

    // Format roles
    const adminRoles = settings.admin_roles || [];
    const modRoles = settings.mod_roles || [];

    const adminRolesMention = adminRoles.length > 0 
        ? adminRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';
    
    const modRolesMention = modRoles.length > 0 
        ? modRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SETTING)
        .setTitle('⚙️ Server Settings')
        .setDescription(`Settings for **${interaction.guild.name}**`)
        .addFields(
            { 
                name: '📝 Snipe Limit', 
                value: `${settings.snipe_limit} messages`, 
                inline: true 
            },
            { 
                name: '📢 Announcement Channel', 
                value: settings.announcement_channel 
                    ? `<#${settings.announcement_channel}>` 
                    : '*Not set*', 
                inline: true 
            },
            { 
                name: '📋 Log Channel', 
                value: settings.log_channel 
                    ? `<#${settings.log_channel}>` 
                    : '*Not set*', 
                inline: true 
            },
            { 
                name: '👑 Admin Roles', 
                value: adminRolesMention 
            },
            { 
                name: '🛡️ Moderator Roles', 
                value: modRolesMention 
            }
        )
        .setFooter({ text: 'Use /setting <option> to change settings' })
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}

/**
 * Configure snipe message limit
 */
async function handleSnipe(interaction) {
    const limit = interaction.options.getInteger('limit');

    await GuildSettingsService.setSnipeLimit(interaction.guild.id, limit);

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SUCCESS)
        .setTitle('✅ Snipe Limit Updated')
        .setDescription(`The bot will now track the last **${limit}** deleted messages.`)
        .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Set announcement channel
 */
async function handleAnnouncement(interaction) {
    const channel = interaction.options.getChannel('channel');
    const channelId = channel?.id || null;

    await GuildSettingsService.setAnnouncementChannel(interaction.guild.id, channelId);

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SUCCESS)
        .setTimestamp();

    if (channelId) {
        embed.setTitle('✅ Announcement Channel Set')
            .setDescription(`Bot announcements will be sent to <#${channelId}>`);
    } else {
        embed.setTitle('✅ Announcement Channel Disabled')
            .setDescription('Bot announcements have been disabled for this server.');
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Set moderation log channel
 */
async function handleLog(interaction) {
    const channel = interaction.options.getChannel('channel');
    const channelId = channel?.id || null;

    await GuildSettingsService.setLogChannel(interaction.guild.id, channelId);

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SUCCESS)
        .setTimestamp();

    if (channelId) {
        embed.setTitle('✅ Log Channel Set')
            .setDescription(`Moderation logs will be sent to <#${channelId}>`);
    } else {
        embed.setTitle('✅ Log Channel Disabled')
            .setDescription('Moderation logging has been disabled for this server.');
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Manage admin roles
 */
async function handleAdminRole(interaction) {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');

    // Prevent adding @everyone or managed roles
    if (role.id === interaction.guild.id || role.managed) {
        return interaction.reply({
            content: '❌ You cannot use this role.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SUCCESS)
        .setTimestamp();

    if (action === 'add') {
        await GuildSettingsService.addAdminRole(interaction.guild.id, role.id);
        embed.setTitle('✅ Admin Role Added')
            .setDescription(`<@&${role.id}> can now use admin commands.`);
    } else {
        await GuildSettingsService.removeAdminRole(interaction.guild.id, role.id);
        embed.setTitle('✅ Admin Role Removed')
            .setDescription(`<@&${role.id}> can no longer use admin commands.`);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Manage moderator roles
 */
async function handleModRole(interaction) {
    const action = interaction.options.getString('action');
    const role = interaction.options.getRole('role');

    // Prevent adding @everyone or managed roles
    if (role.id === interaction.guild.id || role.managed) {
        return interaction.reply({
            content: '❌ You cannot use this role.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SUCCESS)
        .setTimestamp();

    if (action === 'add') {
        await GuildSettingsService.addModRole(interaction.guild.id, role.id);
        embed.setTitle('✅ Moderator Role Added')
            .setDescription(`<@&${role.id}> can now use moderation commands.`);
    } else {
        await GuildSettingsService.removeModRole(interaction.guild.id, role.id);
        embed.setTitle('✅ Moderator Role Removed')
            .setDescription(`<@&${role.id}> can no longer use moderation commands.`);
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Reset all settings to default
 */
async function handleReset(interaction) {
    // Create confirmation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('setting_reset_confirm')
                .setLabel('Confirm Reset')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('setting_reset_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.WARNING)
        .setTitle('⚠️ Reset Settings')
        .setDescription('Are you sure you want to reset all settings to default?\n\nThis will clear:\n• Admin roles\n• Moderator roles\n• Announcement channel\n• Log channel\n• Snipe limit (reset to 10)')
        .setTimestamp();

    const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });

    // Wait for button interaction
    try {
        const buttonInteraction = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
        });

        if (buttonInteraction.customId === 'setting_reset_confirm') {
            // Reset settings
            await GuildSettingsService.updateGuildSettings(interaction.guild.id, {
                snipe_limit: adminConfig.DEFAULT_GUILD_SETTINGS.snipe_limit,
                announcement_channel: null,
                log_channel: null,
                admin_roles: [],
                mod_roles: [],
                mute_role: null
            });

            const successEmbed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.SUCCESS)
                .setTitle('✅ Settings Reset')
                .setDescription('All settings have been reset to default.')
                .setTimestamp();

            await buttonInteraction.update({ embeds: [successEmbed], components: [] });
        } else {
            const cancelEmbed = new EmbedBuilder()
                .setColor(adminConfig.COLORS.INFO)
                .setTitle('❌ Reset Cancelled')
                .setDescription('Settings were not changed.')
                .setTimestamp();

            await buttonInteraction.update({ embeds: [cancelEmbed], components: [] });
        }
    } catch (error) {
        // Timeout
        const timeoutEmbed = new EmbedBuilder()
            .setColor(adminConfig.COLORS.ERROR)
            .setTitle('⏰ Timeout')
            .setDescription('Reset cancelled due to timeout.')
            .setTimestamp();

        await interaction.editReply({ embeds: [timeoutEmbed], components: [] });
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    data,
    execute
};
