/**
 * Ticket Commands Handler
 * Handles ticket/report command registration and execution
 */

const { 
    EmbedBuilder, 
    Events, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');

const { EMBED_COLORS } = require('../Config/adminConfig');
const TicketService = require('../Service/TicketService');

// ═══════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Handle the .report command
 * @param {Message} message - Discord message
 * @param {Client} client - Discord client
 */
async function handleReportCommand(message, client) {
    if (message.author.bot) return;
    if (!message.content.startsWith('.report')) return;

    const typeOptions = TicketService.getTicketTypeOptions();
    
    const typeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`ticket_type_${message.author.id}`)
            .setPlaceholder('Select report type')
            .addOptions(typeOptions)
    );

    const embed = new EmbedBuilder()
        .setTitle('📩 Create a Support Ticket')
        .setDescription('Please select the type of report you want to submit:')
        .setColor(EMBED_COLORS.INFO);

    try {
        const msg = await message.reply({ embeds: [embed], components: [typeMenu] });
        TicketService.storePendingTicket(message.author.id, { messageId: msg.id });
    } catch (err) {
        console.error('Error creating ticket prompt:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// INTERACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * Handle ticket type selection
 * @param {Interaction} interaction - Discord interaction
 */
async function handleTicketTypeSelection(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This menu is not for you.',
            ephemeral: true
        });
    }

    const ticketType = interaction.values[0];
    const typeConfig = TicketService.getTicketType(ticketType);
    
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${ticketType}_${userId}`)
        .setTitle(`${typeConfig.emoji} ${typeConfig.name}`);

    // Build modal fields based on ticket type
    const modalFields = TicketService.getModalFieldsForType(ticketType);
    
    modalFields.forEach(field => {
        const textInput = new TextInputBuilder()
            .setCustomId(field.customId)
            .setLabel(field.label)
            .setStyle(field.style === 'Paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setPlaceholder(field.placeholder)
            .setRequired(field.required);
        
        if (field.maxLength) {
            textInput.setMaxLength(field.maxLength);
        }
        
        modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    });

    await interaction.showModal(modal);
}

/**
 * Handle ticket modal submission
 * @param {Interaction} interaction - Discord interaction
 * @param {Client} client - Discord client
 */
async function handleTicketModalSubmit(interaction, client) {
    const [, , ticketType, userId] = interaction.customId.split('_');

    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This form is not for you.',
            ephemeral: true
        });
    }

    // Extract form values
    const command = safeGetTextInput(interaction, 'command');
    const description = interaction.fields.getTextInputValue('description');
    const steps = safeGetTextInput(interaction, 'steps');
    const expected = safeGetTextInput(interaction, 'expected');
    const additional = safeGetTextInput(interaction, 'additional');

    // Create ticket
    const ticket = TicketService.createTicket({
        userId: interaction.user.id,
        ticketType,
        command,
        description,
        steps,
        expected,
        additional
    });

    // Get report channel
    const guild = client.guilds.cache.get(TicketService.SUPPORT_GUILD_ID);
    const reportChannel = guild?.channels.cache.get(TicketService.REPORT_CHANNEL_ID);

    if (!guild || !reportChannel?.isTextBased()) {
        console.error('Guild or report channel not found.');
        return interaction.reply({
            content: '❌ Unable to submit ticket. Please contact an administrator.',
            ephemeral: true
        });
    }

    // Create report embed
    const typeConfig = TicketService.getTicketType(ticketType);
    const reportEmbed = new EmbedBuilder()
        .setTitle(`🎟️ Support Ticket #${ticket.id}`)
        .setDescription(`**Type:** ${typeConfig.emoji} ${typeConfig.name}\n\nReply to this message to respond to the user.`)
        .addFields(TicketService.formatTicketFields(ticket))
        .setColor(typeConfig.color)
        .setTimestamp();

    try {
        const reportMsg = await reportChannel.send({ embeds: [reportEmbed] });
        
        // Store active ticket
        TicketService.storeActiveTicket(reportMsg.id, { 
            userId: interaction.user.id, 
            responded: false, 
            ticketType,
            ticketNumber: ticket.id
        });

        await interaction.reply({
            content: `✅ Ticket #${ticket.id} submitted successfully!\n📩 Please check your DMs for any follow-up responses.`,
            ephemeral: true
        });

        // Set up reply collector
        setupReplyCollector(reportChannel, reportMsg, ticket, client);

    } catch (err) {
        console.error('Error submitting ticket:', err);
        await interaction.reply({
            content: '❌ Failed to submit your ticket. Please try again later.',
            ephemeral: true
        });
    }

    TicketService.removePendingTicket(userId);
}

/**
 * Set up collector for staff replies
 * @param {Channel} channel - Report channel
 * @param {Message} reportMsg - Report message
 * @param {Object} ticket - Ticket data
 * @param {Client} client - Discord client
 */
function setupReplyCollector(channel, reportMsg, ticket, client) {
    const replyFilter = response => response.reference?.messageId === reportMsg.id;

    const replyCollector = channel.createMessageCollector({
        filter: replyFilter,
        time: TicketService.TICKET_EXPIRY_MS
    });

    replyCollector.on('collect', async response => {
        const activeTicket = TicketService.getActiveTicket(reportMsg.id);
        if (!activeTicket) return;

        if (activeTicket.responded) {
            return await response.reply('⚠️ This ticket has already been responded to.');
        }

        const userResponse = response.content;
        const replyEmbed = new EmbedBuilder()
            .setTitle(`💬 Response to Your Ticket #${ticket.id}`)
            .addFields(
                { name: 'Responded by', value: `${response.author.tag} (${response.author.id})`, inline: false },
                { name: 'Message', value: userResponse }
            )
            .setColor(0x0000ff)
            .setTimestamp();

        try {
            const user = await client.users.fetch(activeTicket.userId);
            await user.send({ embeds: [replyEmbed] });
            await response.reply('📨 Response has been sent to the user.');
            TicketService.markTicketResponded(reportMsg.id);
        } catch (err) {
            console.error('Error DMing user:', err);
            await response.reply('❌ Failed to send the response to the user. They may have DMs disabled.');
        }
    });

    replyCollector.on('end', collected => {
        if (collected.size === 0) {
            channel.send(`⌛ No reply to support ticket #${ticket.id} was made in time.`);
        }
    });
}

/**
 * Safely get text input value
 * @param {Interaction} interaction - Discord interaction
 * @param {string} customId - Field custom ID
 * @returns {string} - Value or 'N/A'
 */
function safeGetTextInput(interaction, customId) {
    try {
        return interaction.fields.getTextInputValue(customId) || 'N/A';
    } catch {
        return 'N/A';
    }
}

// ═══════════════════════════════════════════════════════════════
// REGISTRATION
// ═══════════════════════════════════════════════════════════════

/**
 * Register ticket system
 * @param {Client} client - Discord client
 */
function registerTicketSystem(client) {
    TicketService.initializeTicketSystem();

    client.on(Events.MessageCreate, async message => {
        await handleReportCommand(message, client);
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_type_')) {
            await handleTicketTypeSelection(interaction);
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_modal_')) {
            await handleTicketModalSubmit(interaction, client);
        }
    });
}

module.exports = {
    registerTicketSystem,
    handleReportCommand,
    handleTicketTypeSelection,
    handleTicketModalSubmit,
    
    // Re-export service functions
    initializeTicketSystem: TicketService.initializeTicketSystem,
    incrementTicketCounter: TicketService.incrementTicketCounter
};
