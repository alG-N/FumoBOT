/**
 * /snipe Command
 * Recover deleted messages
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');

const SnipeService = require('../Service/SnipeService');
const GuildSettingsService = require('../Service/GuildSettingsService');
const adminConfig = require('../Config/adminConfig');
const { formatTimeAgo } = require('../../../MainCommand/Ultility/timeUtils');

// SLASH COMMAND DEFINITION

const data = new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Recover recently deleted messages')
    .addIntegerOption(opt =>
        opt.setName('count')
            .setDescription('Number of messages to recover (default: 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10))
    .addChannelOption(opt =>
        opt.setName('channel')
            .setDescription('Specific channel to snipe from (default: current channel)')
            .setRequired(false))
    .addUserOption(opt =>
        opt.setName('user')
            .setDescription('Only show deleted messages from this user')
            .setRequired(false));

// COMMAND EXECUTION

async function execute(interaction) {
    // Check if user has mod permissions
    const hasPerm = await GuildSettingsService.hasModPermission(interaction.member);
    
    if (!hasPerm) {
        return interaction.reply({
            content: '❌ You need moderation permissions to use this command.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const count = interaction.options.getInteger('count') || 1;
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const targetUser = interaction.options.getUser('user');

    try {
        // Get snipe limit from settings
        const snipeLimit = await GuildSettingsService.getSnipeLimit(interaction.guild.id);
        const effectiveCount = Math.min(count, snipeLimit);

        let messages;
        
        if (targetUser) {
            // Get messages by specific user
            messages = SnipeService.getDeletedMessagesByUser(
                interaction.guild.id, 
                targetUser.id, 
                effectiveCount
            );
        } else {
            // Get messages from channel
            messages = SnipeService.getDeletedMessages(
                interaction.guild.id, 
                effectiveCount, 
                targetChannel.id
            );
        }

        if (messages.length === 0) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(adminConfig.COLORS.WARNING)
                        .setDescription('📭 No deleted messages found.')
                        .setFooter({ text: `Tracking up to ${snipeLimit} messages` })
                ]
            });
        }

        // Create embeds for each message
        const embeds = messages.map((msg, index) => createSnipeEmbed(msg, index + 1, messages.length));

        // Discord limits to 10 embeds per message
        if (embeds.length > 10) {
            embeds.splice(10);
        }

        return interaction.editReply({ embeds });

    } catch (error) {
        console.error('[/snipe] Error:', error);
        return interaction.editReply({
            content: '❌ An error occurred while fetching deleted messages.'
        });
    }
}

// HELPER FUNCTIONS

/**
 * Create an embed for a sniped message
 * @param {Object} msg - Sniped message data
 * @param {number} index - Message index
 * @param {number} total - Total messages
 * @returns {EmbedBuilder} Snipe embed
 */
function createSnipeEmbed(msg, index, total) {
    const embed = new EmbedBuilder()
        .setColor(adminConfig.COLORS.SNIPE)
        .setAuthor({
            name: `${msg.author.displayName} (${msg.author.tag})`,
            iconURL: msg.author.avatarURL
        })
        .setFooter({ 
            text: `Message ${index}/${total} • Deleted ${formatTimeAgo(msg.deletedAt)}` 
        })
        .setTimestamp(msg.deletedAt);

    // Add message content
    if (msg.content) {
        const content = msg.content.length > 4096 
            ? msg.content.slice(0, 4093) + '...' 
            : msg.content;
        embed.setDescription(content);
    }

    // Add channel info
    embed.addFields({
        name: 'Channel',
        value: `<#${msg.channel.id}>`,
        inline: true
    });

    // Add original timestamp
    embed.addFields({
        name: 'Sent',
        value: `<t:${Math.floor(msg.createdAt / 1000)}:R>`,
        inline: true
    });

    // Add attachments info
    if (msg.attachments && msg.attachments.length > 0) {
        const attachmentList = msg.attachments
            .map(a => `📎 [${a.name}](${a.url})`)
            .join('\n');
        
        embed.addFields({
            name: `Attachments (${msg.attachments.length})`,
            value: attachmentList.slice(0, 1024)
        });

        // Try to show first image attachment
        const imageAttachment = msg.attachments.find(a => 
            a.type?.startsWith('image/') || 
            /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name)
        );
        
        if (imageAttachment) {
            embed.setImage(imageAttachment.proxyUrl || imageAttachment.url);
        }
    }

    // Add embeds info
    if (msg.embeds && msg.embeds.length > 0) {
        const embedInfo = msg.embeds
            .map(e => e.title || e.description?.slice(0, 50) || 'Embed')
            .join(', ');
        
        embed.addFields({
            name: 'Embeds',
            value: `${msg.embeds.length} embed(s): ${embedInfo}`.slice(0, 1024),
            inline: true
        });
    }

    return embed;
}

module.exports = {
    data,
    execute
};
