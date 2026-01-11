/**
 * /delete Command
 * Bulk delete messages from a channel
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const GuildSettingsService = require('../Service/GuildSettingsService');
const ModerationService = require('../Service/ModerationService');
const adminConfig = require('../Config/adminConfig');

const data = new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Delete multiple messages from this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
        opt.setName('amount')
            .setDescription('Number of messages to delete (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100))
    .addUserOption(opt =>
        opt.setName('user')
            .setDescription('Only delete messages from this user')
            .setRequired(false))
    .addStringOption(opt =>
        opt.setName('contains')
            .setDescription('Only delete messages containing this text')
            .setRequired(false))
    .addBooleanOption(opt =>
        opt.setName('bots')
            .setDescription('Only delete messages from bots')
            .setRequired(false))
    .addBooleanOption(opt =>
        opt.setName('pinned')
            .setDescription('Include pinned messages (default: false)')
            .setRequired(false));

async function execute(interaction) {
    // Check permissions
    const hasPerm = await GuildSettingsService.hasModPermission(interaction.member);
    
    if (!hasPerm && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
            content: '❌ You do not have permission to delete messages.',
            ephemeral: true
        });
    }

    // Get guild settings for delete limit
    const settings = await GuildSettingsService.getGuildSettings(interaction.guildId);
    const maxDeleteLimit = settings.delete_limit || adminConfig.DELETE_CONFIG.DEFAULT_LIMIT;

    let amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');
    const containsText = interaction.options.getString('contains');
    const botsOnly = interaction.options.getBoolean('bots') || false;
    const includePinned = interaction.options.getBoolean('pinned') || false;

    // Enforce server's delete limit
    if (amount > maxDeleteLimit) {
        return interaction.reply({
            content: `❌ This server's delete limit is set to **${maxDeleteLimit}** messages. Use \`/setting delete_limit\` to change it.`,
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Fetch more messages than needed to account for filtering
        const fetchLimit = Math.min(amount * 2, 100);
        const messages = await interaction.channel.messages.fetch({ limit: fetchLimit });
        
        // Calculate the 14-day cutoff
        const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
        
        // Filter messages
        let filteredMessages = messages.filter(msg => {
            // Skip messages older than 14 days (Discord limitation)
            if (msg.createdTimestamp < fourteenDaysAgo) return false;
            
            // Skip pinned messages unless explicitly included
            if (msg.pinned && !includePinned) return false;
            
            // Filter by user if specified
            if (targetUser && msg.author.id !== targetUser.id) return false;
            
            // Filter by text content if specified
            if (containsText && !msg.content.toLowerCase().includes(containsText.toLowerCase())) return false;
            
            // Filter by bots if specified
            if (botsOnly && !msg.author.bot) return false;
            
            return true;
        });

        // Limit to requested amount
        filteredMessages = [...filteredMessages.values()].slice(0, amount);

        if (filteredMessages.length === 0) {
            return interaction.editReply({
                content: '❌ No messages found matching your criteria (messages older than 14 days cannot be bulk deleted).'
            });
        }

        // Delete messages
        const deleted = await interaction.channel.bulkDelete(filteredMessages, true);
        
        // Build response
        const embed = new EmbedBuilder()
            .setColor(adminConfig.COLORS.SUCCESS)
            .setTitle('🗑️ Messages Deleted')
            .setDescription(`Successfully deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''}.`)
            .setTimestamp();

        // Add filter info if used
        const filters = [];
        if (targetUser) filters.push(`From: ${targetUser.tag}`);
        if (containsText) filters.push(`Contains: "${containsText}"`);
        if (botsOnly) filters.push('Bots only');
        if (includePinned) filters.push('Including pinned');
        
        if (filters.length > 0) {
            embed.addFields({ name: 'Filters Applied', value: filters.join('\n') });
        }

        embed.setFooter({ text: `Moderator: ${interaction.user.tag}` });

        // Log the action
        await ModerationService.logAction(interaction.guildId, {
            action: 'DELETE',
            moderator: interaction.user,
            channel: interaction.channel,
            count: deleted.size,
            filters: filters.join(', ') || 'None'
        });

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('[Delete] Error:', error);
        
        if (error.code === 50034) {
            return interaction.editReply({
                content: '❌ Cannot delete messages older than 14 days.'
            });
        }
        
        return interaction.editReply({
            content: `❌ Failed to delete messages: ${error.message}`
        });
    }
}

module.exports = {
    data,
    execute
};
