const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { OWNER_IDS, DEVELOPER_ID, EMBED_COLORS } = require('../Config/ownerConfig');
const fs = require('fs');
const path = require('path');

// Data file path
const ANNOUNCEMENT_DATA_PATH = path.join(__dirname, '../Data/announcements.json');

// Announcement types
const ANNOUNCEMENT_TYPES = {
    general: {
        emoji: '📢',
        name: 'General Announcement',
        color: 0x5865F2,
        description: 'General bot updates and news'
    },
    update: {
        emoji: '🆕',
        name: 'Update Announcement',
        color: 0x57F287,
        description: 'New features and improvements'
    },
    maintenance: {
        emoji: '🔧',
        name: 'Maintenance Notice',
        color: 0xFEE75C,
        description: 'Scheduled maintenance alerts'
    },
    emergency: {
        emoji: '🚨',
        name: 'Emergency Alert',
        color: 0xED4245,
        description: 'Urgent issues and downtime'
    },
    event: {
        emoji: '🎉',
        name: 'Event Announcement',
        color: 0xEB459E,
        description: 'Special events and promotions'
    },
    patch: {
        emoji: '📝',
        name: 'Patch Notes',
        color: 0x9B59B6,
        description: 'Bug fixes and minor changes'
    }
};

function isAuthorized(userId) {
    return userId === DEVELOPER_ID || OWNER_IDS.includes(userId);
}

function loadAnnouncementData() {
    try {
        if (fs.existsSync(ANNOUNCEMENT_DATA_PATH)) {
            return JSON.parse(fs.readFileSync(ANNOUNCEMENT_DATA_PATH, 'utf8'));
        }
    } catch {}
    return {
        history: [],
        maintenanceMode: false,
        maintenanceMessage: null,
        maintenanceEndTime: null,
        scheduledAnnouncements: []
    };
}

function saveAnnouncementData(data) {
    const dir = path.dirname(ANNOUNCEMENT_DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ANNOUNCEMENT_DATA_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Announcement management (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('create')
            .setDescription('Create a new announcement')
            .addStringOption(opt => opt
                .setName('type')
                .setDescription('Type of announcement')
                .setRequired(true)
                .addChoices(
                    ...Object.entries(ANNOUNCEMENT_TYPES).map(([key, val]) => ({
                        name: `${val.emoji} ${val.name}`,
                        value: key
                    }))
                )
            )
        )
        .addSubcommand(sub => sub
            .setName('maintenance')
            .setDescription('Toggle maintenance mode')
            .addBooleanOption(opt => opt
                .setName('enable')
                .setDescription('Enable or disable maintenance mode')
                .setRequired(true)
            )
            .addStringOption(opt => opt
                .setName('duration')
                .setDescription('Expected duration (e.g., 30m, 2h, 1d)')
                .setRequired(false)
            )
            .addStringOption(opt => opt
                .setName('reason')
                .setDescription('Reason for maintenance')
                .setRequired(false)
            )
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('View announcement system status')
        )
        .addSubcommand(sub => sub
            .setName('history')
            .setDescription('View announcement history')
        )
        .addSubcommand(sub => sub
            .setName('broadcast')
            .setDescription('Send announcement to all servers (DM to admins)')
            .addStringOption(opt => opt
                .setName('message_id')
                .setDescription('Message ID of the announcement to broadcast')
                .setRequired(true)
            )
        ),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        if (!isAuthorized(userId)) {
            return interaction.reply({ 
                content: '❌ This command is restricted to bot owners only.', 
                ephemeral: true 
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case 'create':
                    await this.handleCreate(interaction);
                    break;
                case 'maintenance':
                    await this.handleMaintenance(interaction);
                    break;
                case 'status':
                    await this.handleStatus(interaction);
                    break;
                case 'history':
                    await this.handleHistory(interaction);
                    break;
                case 'broadcast':
                    await this.handleBroadcast(interaction);
                    break;
            }
        } catch (error) {
            console.error('[Announcement] Error:', error);
            const errorMsg = error.message || 'An unexpected error occurred';
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: `❌ Error: ${errorMsg}` }).catch(() => {});
            } else {
                await interaction.reply({ content: `❌ Error: ${errorMsg}`, ephemeral: true }).catch(() => {});
            }
        }
    },

    async handleCreate(interaction) {
        const type = interaction.options.getString('type');
        const typeInfo = ANNOUNCEMENT_TYPES[type];
        
        const modal = new ModalBuilder()
            .setCustomId(`announcement_create_${type}_${interaction.user.id}`)
            .setTitle(`${typeInfo.emoji} Create ${typeInfo.name}`);
        
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Announcement Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter a catchy title...')
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Announcement Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Write your announcement here...\n\nYou can use Discord markdown!')
                    .setRequired(true)
                    .setMaxLength(2000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('footer')
                    .setLabel('Footer Text (Optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., "Thank you for your patience!"')
                    .setRequired(false)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('image_url')
                    .setLabel('Image URL (Optional)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('https://example.com/image.png')
                    .setRequired(false)
                    .setMaxLength(500)
            )
        );
        
        await interaction.showModal(modal);
    },

    async handleMaintenance(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const enable = interaction.options.getBoolean('enable');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason') || 'Scheduled maintenance';
        
        const data = loadAnnouncementData();
        
        if (enable) {
            // Calculate end time
            let endTime = null;
            if (duration) {
                const match = duration.match(/^(\d+)(m|h|d)$/i);
                if (match) {
                    const amount = parseInt(match[1]);
                    const unit = match[2].toLowerCase();
                    const multipliers = { m: 60000, h: 3600000, d: 86400000 };
                    endTime = Date.now() + (amount * multipliers[unit]);
                }
            }
            
            data.maintenanceMode = true;
            data.maintenanceMessage = reason;
            data.maintenanceEndTime = endTime;
            data.history.push({
                type: 'maintenance_start',
                reason,
                endTime,
                timestamp: Date.now(),
                author: interaction.user.id
            });
            
            saveAnnouncementData(data);
            
            const embed = new EmbedBuilder()
                .setColor(ANNOUNCEMENT_TYPES.maintenance.color)
                .setTitle('🔧 Maintenance Mode Enabled')
                .setDescription(`**Reason:** ${reason}`)
                .addFields(
                    { name: 'Status', value: '🔴 Active', inline: true },
                    { name: 'Expected End', value: endTime ? `<t:${Math.floor(endTime / 1000)}:R>` : 'Not specified', inline: true }
                )
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        } else {
            data.maintenanceMode = false;
            data.maintenanceMessage = null;
            data.maintenanceEndTime = null;
            data.history.push({
                type: 'maintenance_end',
                timestamp: Date.now(),
                author: interaction.user.id
            });
            
            saveAnnouncementData(data);
            
            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Maintenance Mode Disabled')
                .setDescription('The bot is now fully operational!')
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleStatus(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const data = loadAnnouncementData();
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📊 Announcement System Status')
            .addFields(
                { 
                    name: '🔧 Maintenance Mode', 
                    value: data.maintenanceMode ? '🔴 Active' : '🟢 Inactive',
                    inline: true 
                },
                { 
                    name: '📜 Total Announcements', 
                    value: String(data.history.length),
                    inline: true 
                },
                { 
                    name: '🌐 Connected Servers', 
                    value: String(interaction.client.guilds.cache.size),
                    inline: true 
                }
            );
        
        if (data.maintenanceMode) {
            embed.addFields(
                { name: '📝 Maintenance Reason', value: data.maintenanceMessage || 'Not specified', inline: false },
                { 
                    name: '⏰ Expected End', 
                    value: data.maintenanceEndTime ? `<t:${Math.floor(data.maintenanceEndTime / 1000)}:R>` : 'Not specified',
                    inline: true 
                }
            );
        }
        
        // Show recent announcements
        const recentAnnouncements = data.history.slice(-5).reverse();
        if (recentAnnouncements.length > 0) {
            const recentList = recentAnnouncements.map((a, i) => {
                const type = a.type?.startsWith('maintenance') 
                    ? (a.type === 'maintenance_start' ? '🔧 Maintenance Started' : '✅ Maintenance Ended')
                    : `${ANNOUNCEMENT_TYPES[a.type]?.emoji || '📢'} ${ANNOUNCEMENT_TYPES[a.type]?.name || 'Announcement'}`;
                return `${i + 1}. ${type} - <t:${Math.floor(a.timestamp / 1000)}:R>`;
            }).join('\n');
            
            embed.addFields({ name: '📋 Recent Activity', value: recentList, inline: false });
        }
        
        embed.setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    async handleHistory(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const data = loadAnnouncementData();
        
        if (data.history.length === 0) {
            return interaction.editReply({ content: '📭 No announcements in history.' });
        }
        
        const history = data.history.slice(-10).reverse();
        
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📜 Announcement History (Last 10)')
            .setDescription(
                history.map((a, i) => {
                    const typeInfo = ANNOUNCEMENT_TYPES[a.type];
                    const emoji = a.type?.startsWith('maintenance') 
                        ? '🔧' 
                        : (typeInfo?.emoji || '📢');
                    const name = a.type?.startsWith('maintenance')
                        ? (a.type === 'maintenance_start' ? 'Maintenance Started' : 'Maintenance Ended')
                        : (typeInfo?.name || 'Announcement');
                    const title = a.title ? ` - ${a.title.slice(0, 30)}${a.title.length > 30 ? '...' : ''}` : '';
                    
                    return `**${i + 1}.** ${emoji} ${name}${title}\n└ <t:${Math.floor(a.timestamp / 1000)}:f>`;
                }).join('\n\n')
            )
            .setFooter({ text: `Total: ${data.history.length} announcements` })
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    async handleBroadcast(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⚠️ Broadcast Feature')
            .setDescription('This feature sends DMs to all server admins.\n\n**Use with caution!**\n\nThis feature is currently disabled to prevent spam.')
            .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
    },

    // Handle modal submission
    async handleModal(interaction) {
        if (!interaction.customId.startsWith('announcement_create_')) return false;
        
        const parts = interaction.customId.split('_');
        const type = parts[2];
        const userId = parts[3];
        
        if (userId !== interaction.user.id) {
            return interaction.reply({ content: '❌ This modal is not for you!', ephemeral: true });
        }
        
        const typeInfo = ANNOUNCEMENT_TYPES[type];
        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');
        const footer = interaction.fields.getTextInputValue('footer') || null;
        const imageUrl = interaction.fields.getTextInputValue('image_url') || null;
        
        // Create the announcement embed
        const embed = new EmbedBuilder()
            .setColor(typeInfo.color)
            .setTitle(`${typeInfo.emoji} ${title}`)
            .setDescription(content)
            .setTimestamp();
        
        if (footer) {
            embed.setFooter({ text: footer });
        }
        
        if (imageUrl) {
            try {
                new URL(imageUrl);
                embed.setImage(imageUrl);
            } catch {}
        }
        
        embed.setAuthor({
            name: `${typeInfo.name} • FumoBOT`,
            iconURL: interaction.client.user.displayAvatarURL()
        });
        
        // Save to history
        const data = loadAnnouncementData();
        data.history.push({
            type,
            title,
            content,
            footer,
            imageUrl,
            timestamp: Date.now(),
            author: interaction.user.id
        });
        saveAnnouncementData(data);
        
        // Create action buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`announcement_send_${interaction.channel.id}_${interaction.user.id}`)
                .setLabel('Send to This Channel')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📤'),
            new ButtonBuilder()
                .setCustomId(`announcement_preview_${interaction.user.id}`)
                .setLabel('Preview Only')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('👁️')
        );
        
        await interaction.reply({
            content: '**📋 Announcement Preview:**',
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
        
        return true;
    },

    // Handle button interactions
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('announcement_')) return false;
        
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const userId = parts[parts.length - 1];
        
        if (!isAuthorized(interaction.user.id)) {
            return interaction.reply({ content: '❌ Not authorized.', ephemeral: true });
        }
        
        if (action === 'send') {
            const channelId = parts[2];
            
            try {
                const channel = await interaction.client.channels.fetch(channelId);
                if (!channel) {
                    return interaction.reply({ content: '❌ Channel not found.', ephemeral: true });
                }
                
                // Get the embed from the interaction message
                const embed = interaction.message.embeds[0];
                if (!embed) {
                    return interaction.reply({ content: '❌ No embed found.', ephemeral: true });
                }
                
                await channel.send({ embeds: [EmbedBuilder.from(embed)] });
                
                await interaction.update({
                    content: `✅ Announcement sent to <#${channelId}>!`,
                    components: []
                });
            } catch (error) {
                console.error('[Announcement Send Error]', error);
                await interaction.reply({ 
                    content: `❌ Failed to send: ${error.message}`, 
                    ephemeral: true 
                });
            }
        } else if (action === 'preview') {
            await interaction.update({
                content: '✅ Preview mode - announcement not sent.',
                components: []
            });
        }
        
        return true;
    },

    // Export for maintenance check
    isMaintenanceModeEnabled() {
        const data = loadAnnouncementData();
        return data.maintenanceMode;
    },

    getMaintenanceInfo() {
        const data = loadAnnouncementData();
        return {
            enabled: data.maintenanceMode,
            message: data.maintenanceMessage,
            endTime: data.maintenanceEndTime
        };
    },

    ANNOUNCEMENT_TYPES
};
