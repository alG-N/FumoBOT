const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');
const fs = require('fs');
const path = require('path');

// Report types
const REPORT_TYPES = {
    bug: {
        label: '🐛 Bug Report',
        value: 'bug',
        description: 'Report a bug or issue with the bot',
        emoji: '🐛',
        name: 'Bug Report',
        color: 0xff0000,
        requiresCommand: true
    },
    exploit: {
        label: '🔓 Exploit Report',
        value: 'exploit',
        description: 'Report an exploit or abuse',
        emoji: '🔓',
        name: 'Exploit Report',
        color: 0xff6600,
        requiresCommand: true
    },
    suggestion: {
        label: '💡 Suggestion',
        value: 'suggestion',
        description: 'Suggest a new feature or improvement',
        emoji: '💡',
        name: 'Suggestion',
        color: 0x00ff00,
        requiresCommand: false
    },
    other: {
        label: '❓ Other',
        value: 'other',
        description: 'Other issues or questions',
        emoji: '❓',
        name: 'Other',
        color: 0x00aaff,
        requiresCommand: false
    }
};

// File paths
const DATA_DIR = path.join(__dirname, '../../OwnerCommand/Data');
const COUNTER_PATH = path.join(DATA_DIR, 'ticketCounter.txt');

// Report channel - you can change this to your own channel ID
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID || null;

// Cooldown tracking (1 report per 5 minutes per user)
const cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

function getTicketCounter() {
    try {
        if (fs.existsSync(COUNTER_PATH)) {
            return parseInt(fs.readFileSync(COUNTER_PATH, 'utf8')) || 0;
        }
    } catch {}
    return 0;
}

function incrementTicketCounter() {
    const current = getTicketCounter();
    const newCount = current + 1;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(COUNTER_PATH, String(newCount));
    return newCount;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Submit a bug report, suggestion, or feedback'),

    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        // Check cooldown
        const userId = interaction.user.id;
        const lastReport = cooldowns.get(userId);
        if (lastReport && Date.now() - lastReport < COOLDOWN_MS) {
            const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastReport)) / 1000);
            return interaction.reply({
                content: `⏳ Please wait ${remaining} seconds before submitting another report.`,
                ephemeral: true
            });
        }

        // Show modal directly instead of select menu (faster, no timeout issues)
        const modal = new ModalBuilder()
            .setCustomId(`report_modal_${interaction.user.id}`)
            .setTitle('📝 Submit a Report');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('report_type')
                    .setPlaceholder('Select report type')
                    .addOptions(
                        Object.values(REPORT_TYPES).map(type => ({
                            label: type.name,
                            value: type.value,
                            description: type.description,
                            emoji: type.emoji
                        }))
                    )
            )
        );

        // Use modal with text inputs only (select menu not allowed in modals)
        const reportModal = new ModalBuilder()
            .setCustomId(`report_submit_${interaction.user.id}`)
            .setTitle('📝 Submit a Report');

        reportModal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('type')
                    .setLabel('Report Type')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('bug / exploit / suggestion / other')
                    .setRequired(true)
                    .setMaxLength(20)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('command')
                    .setLabel('Related Command (if any)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., /gacha, /farm (leave empty if N/A)')
                    .setRequired(false)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Brief Summary')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Short description of your report')
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('description')
                    .setLabel('Detailed Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Please provide as much detail as possible...')
                    .setRequired(true)
                    .setMaxLength(1500)
            )
        );

        await interaction.showModal(reportModal);
    },

    // Handle modal submission
    async handleModal(interaction) {
        if (!interaction.customId.startsWith('report_submit_')) return false;

        const userId = interaction.user.id;
        
        try {
            await interaction.deferReply({ ephemeral: true });

            // Get values
            const typeInput = interaction.fields.getTextInputValue('type').toLowerCase().trim();
            const command = interaction.fields.getTextInputValue('command') || null;
            const title = interaction.fields.getTextInputValue('title');
            const description = interaction.fields.getTextInputValue('description');

            // Match report type
            const reportType = REPORT_TYPES[typeInput] || REPORT_TYPES.other;
            
            // Generate ticket number
            const ticketNumber = incrementTicketCounter();

            // Create report embed
            const reportEmbed = new EmbedBuilder()
                .setColor(reportType.color)
                .setTitle(`${reportType.emoji} ${reportType.name} #${ticketNumber}`)
                .setDescription(description)
                .addFields(
                    { name: 'Summary', value: title, inline: false },
                    { name: 'Reporter', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: 'Server', value: interaction.guild?.name || 'DM', inline: true }
                )
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: `Report ID: ${ticketNumber}` })
                .setTimestamp();

            if (command) {
                reportEmbed.addFields({ name: 'Command', value: command, inline: true });
            }

            // Create response button for admins
            const adminRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report_respond_${ticketNumber}_${interaction.user.id}`)
                    .setLabel('Respond to User')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💬'),
                new ButtonBuilder()
                    .setCustomId(`report_resolve_${ticketNumber}_${interaction.user.id}`)
                    .setLabel('Mark Resolved')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`report_reject_${ticketNumber}_${interaction.user.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

            // Try to send to report channel
            let sent = false;
            if (REPORT_CHANNEL_ID) {
                try {
                    const reportChannel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID);
                    if (reportChannel) {
                        await reportChannel.send({ embeds: [reportEmbed], components: [adminRow] });
                        sent = true;
                    }
                } catch (err) {
                    console.error('[Report] Failed to send to report channel:', err.message);
                }
            }

            // If no report channel, try to DM bot owner
            if (!sent) {
                try {
                    const app = await interaction.client.application.fetch();
                    if (app.owner) {
                        const owner = app.owner.owner || app.owner;
                        await owner.send({ embeds: [reportEmbed] });
                        sent = true;
                    }
                } catch (err) {
                    console.error('[Report] Failed to DM owner:', err.message);
                }
            }

            // Update cooldown
            cooldowns.set(userId, Date.now());

            // Confirm to user
            const confirmEmbed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Report Submitted!')
                .setDescription(`Your ${reportType.name.toLowerCase()} has been submitted successfully.`)
                .addFields(
                    { name: 'Report ID', value: `#${ticketNumber}`, inline: true },
                    { name: 'Type', value: `${reportType.emoji} ${reportType.name}`, inline: true }
                )
                .setFooter({ text: 'Thank you for your feedback!' })
                .setTimestamp();

            await interaction.editReply({ embeds: [confirmEmbed] });
            return true;

        } catch (error) {
            console.error('[Report] Modal error:', error);
            try {
                await interaction.editReply({
                    content: '❌ An error occurred while processing your report. Please try again later.'
                });
            } catch {}
            return true;
        }
    },

    // Handle button interactions for admin responses
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('report_')) return false;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const ticketNumber = parts[2];
        const reporterUserId = parts[3];

        // Check if user has permission (admin or bot owner)
        const hasPermission = interaction.member?.permissions?.has('Administrator') || 
            ['1128296349566251068', '1362450043939979378', '1448912158367813662'].includes(interaction.user.id);
        
        if (!hasPermission) {
            return interaction.reply({ content: '❌ You need Administrator permissions to respond to reports.', ephemeral: true });
        }

        try {
            if (action === 'respond') {
                // Show modal for response
                const modal = new ModalBuilder()
                    .setCustomId(`report_response_modal_${ticketNumber}_${reporterUserId}`)
                    .setTitle(`Respond to Report #${ticketNumber}`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('response')
                            .setLabel('Your Response')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('Write your response to the user...')
                            .setRequired(true)
                            .setMaxLength(1500)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('status')
                            .setLabel('Status (resolved/pending/investigating)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('resolved')
                            .setRequired(false)
                            .setMaxLength(20)
                    )
                );

                await interaction.showModal(modal);
                return true;
            }

            if (action === 'resolve') {
                // Update the embed to show resolved
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x57F287)
                    .setTitle(`✅ ${interaction.message.embeds[0].title?.replace(/^.* /, '')} - RESOLVED`)
                    .addFields({ name: '📋 Status', value: `Resolved by ${interaction.user.tag}`, inline: false });

                await interaction.update({ embeds: [embed], components: [] });
                
                // Try to DM the reporter
                try {
                    const reporter = await interaction.client.users.fetch(reporterUserId);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(`✅ Report #${ticketNumber} Resolved`)
                        .setDescription('Your report has been resolved by our team. Thank you for your feedback!')
                        .setFooter({ text: 'FumoBOT Support Team' })
                        .setTimestamp();
                    await reporter.send({ embeds: [dmEmbed] });
                } catch {}
                return true;
            }

            if (action === 'reject') {
                // Update the embed to show rejected
                const embed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0xED4245)
                    .setTitle(`❌ ${interaction.message.embeds[0].title?.replace(/^.* /, '')} - REJECTED`)
                    .addFields({ name: '📋 Status', value: `Rejected by ${interaction.user.tag}`, inline: false });

                await interaction.update({ embeds: [embed], components: [] });
                return true;
            }

        } catch (error) {
            console.error('[Report Button Error]', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
            }
        }
        return true;
    },

    // Handle response modal submission
    async handleResponseModal(interaction) {
        if (!interaction.customId.startsWith('report_response_modal_')) return false;

        const parts = interaction.customId.split('_');
        const ticketNumber = parts[3];
        const reporterUserId = parts[4];

        try {
            await interaction.deferUpdate();

            const response = interaction.fields.getTextInputValue('response');
            const status = interaction.fields.getTextInputValue('status') || 'responded';

            // Update the original embed
            const originalEmbed = interaction.message.embeds[0];
            const statusColor = status.toLowerCase() === 'resolved' ? 0x57F287 : 
                               status.toLowerCase() === 'pending' ? 0xFEE75C : 0x5865F2;

            const updatedEmbed = EmbedBuilder.from(originalEmbed)
                .setColor(statusColor)
                .setTitle(`💬 ${originalEmbed.title?.replace(/^.* /, '')} - ${status.toUpperCase()}`)
                .addFields(
                    { name: '💬 Admin Response', value: response, inline: false },
                    { name: '👤 Responded By', value: interaction.user.tag, inline: true },
                    { name: '📋 Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true }
                );

            // Disable buttons after response
            await interaction.editReply({ embeds: [updatedEmbed], components: [] });

            // Send DM to reporter
            try {
                const reporter = await interaction.client.users.fetch(reporterUserId);
                
                const dmEmbed = new EmbedBuilder()
                    .setColor(statusColor)
                    .setTitle(`📬 Response to Report #${ticketNumber}`)
                    .setDescription(response)
                    .addFields(
                        { name: '📋 Status', value: status.charAt(0).toUpperCase() + status.slice(1), inline: true },
                        { name: '👤 From', value: 'FumoBOT Support Team', inline: true }
                    )
                    .setFooter({ text: 'Thank you for using FumoBOT!' })
                    .setTimestamp();

                await reporter.send({ embeds: [dmEmbed] });
                
                // Update embed to show DM was sent
                updatedEmbed.addFields({ name: '📨 DM Status', value: '✅ Sent to user', inline: true });
                await interaction.editReply({ embeds: [updatedEmbed], components: [] });
            } catch (dmError) {
                console.log('[Report] Could not DM reporter:', dmError.message);
                updatedEmbed.addFields({ name: '📨 DM Status', value: '❌ Could not DM user', inline: true });
                await interaction.editReply({ embeds: [updatedEmbed], components: [] });
            }

            return true;
        } catch (error) {
            console.error('[Report Response Modal Error]', error);
            return true;
        }
    }
};
