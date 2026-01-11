const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
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

            // Try to send to report channel
            let sent = false;
            if (REPORT_CHANNEL_ID) {
                try {
                    const reportChannel = await interaction.client.channels.fetch(REPORT_CHANNEL_ID);
                    if (reportChannel) {
                        await reportChannel.send({ embeds: [reportEmbed] });
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
    }
};
