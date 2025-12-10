const { EmbedBuilder, Events, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TICKET_FILE = path.join(__dirname, '../ticketCounter.txt');
const GUILD_ID = '1255091916823986207';
const REPORT_CHANNEL_ID = '1362826913088799001';

let ticketCounter = 0;
const tickets = new Map();
const pendingTickets = new Map();

function initializeTicketSystem() {
    if (fs.existsSync(TICKET_FILE)) {
        ticketCounter = parseInt(fs.readFileSync(TICKET_FILE, 'utf8'), 10);
    } else {
        fs.writeFileSync(TICKET_FILE, '0', 'utf8');
    }
    console.log(`🎟️ Ticket system initialized. Counter: ${ticketCounter}`);
}

function incrementTicketCounter() {
    ticketCounter++;
    fs.writeFileSync(TICKET_FILE, ticketCounter.toString(), 'utf8');
    return ticketCounter;
}

async function handleReportCommand(message, client) {
    if (message.author.bot) return;
    if (!message.content.startsWith('.report')) return;

    const typeMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`ticket_type_${message.author.id}`)
            .setPlaceholder('Select report type')
            .addOptions([
                {
                    label: '🐛 Bug Report',
                    value: 'bug',
                    description: 'Report a bug or issue with the bot'
                },
                {
                    label: '🔓 Exploit Report',
                    value: 'exploit',
                    description: 'Report an exploit or abuse'
                },
                {
                    label: '💡 Suggestion',
                    value: 'suggestion',
                    description: 'Suggest a new feature or improvement'
                },
                {
                    label: '⚖️ Ban Appeal',
                    value: 'ban_appeal',
                    description: 'Appeal your ban from the bot'
                },
                {
                    label: '❓ Other',
                    value: 'other',
                    description: 'Other issues or questions'
                }
            ])
    );

    const embed = new EmbedBuilder()
        .setTitle('📩 Create a Support Ticket')
        .setDescription('Please select the type of report you want to submit:')
        .setColor(0x00aaff);

    try {
        const msg = await message.reply({ embeds: [embed], components: [typeMenu] });
        pendingTickets.set(message.author.id, { messageId: msg.id });
    } catch (err) {
        console.error('Error creating ticket prompt:', err);
    }
}

async function handleTicketTypeSelection(interaction) {
    const userId = interaction.customId.split('_').pop();
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This menu is not for you.',
            ephemeral: true
        });
    }

    const ticketType = interaction.values[0];
    
    const modal = new ModalBuilder()
        .setCustomId(`ticket_modal_${ticketType}_${userId}`)
        .setTitle(`${getTypeEmoji(ticketType)} ${getTypeName(ticketType)}`);

    const commandInput = new TextInputBuilder()
        .setCustomId('command')
        .setLabel('Command/Feature Affected')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., .roll, .farm, .trade')
        .setRequired(ticketType === 'bug' || ticketType === 'exploit');

    const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('Detailed Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe your issue, suggestion, or appeal in detail...')
        .setRequired(true)
        .setMaxLength(1000);

    const stepsInput = new TextInputBuilder()
        .setCustomId('steps')
        .setLabel('Steps to Reproduce (if applicable)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('1. Use command...\n2. Click button...\n3. Error occurs...')
        .setRequired(false)
        .setMaxLength(500);

    const expectedInput = new TextInputBuilder()
        .setCustomId('expected')
        .setLabel('Expected vs Actual Behavior')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Expected: Should work normally\nActual: Gets error message')
        .setRequired(false)
        .setMaxLength(500);

    const additionalInput = new TextInputBuilder()
        .setCustomId('additional')
        .setLabel('Additional Information')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Screenshots URL, Discord user IDs involved, timestamps, etc.')
        .setRequired(false)
        .setMaxLength(500);

    const row1 = new ActionRowBuilder().addComponents(commandInput);
    const row2 = new ActionRowBuilder().addComponents(descriptionInput);
    const row3 = new ActionRowBuilder().addComponents(stepsInput);
    const row4 = new ActionRowBuilder().addComponents(expectedInput);
    const row5 = new ActionRowBuilder().addComponents(additionalInput);

    if (ticketType === 'bug' || ticketType === 'exploit') {
        modal.addComponents(row1, row2, row3, row4, row5);
    } else if (ticketType === 'ban_appeal') {
        modal.addComponents(row2, row3, row5);
    } else {
        modal.addComponents(row2, row5);
    }

    await interaction.showModal(modal);
}

async function handleTicketModalSubmit(interaction, client) {
    const [, , ticketType, userId] = interaction.customId.split('_');

    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: '❌ This form is not for you.',
            ephemeral: true
        });
    }

    const command = interaction.fields.getTextInputValue('command') || 'N/A';
    const description = interaction.fields.getTextInputValue('description');
    const steps = interaction.fields.getTextInputValue('steps') || 'N/A';
    const expected = interaction.fields.getTextInputValue('expected') || 'N/A';
    const additional = interaction.fields.getTextInputValue('additional') || 'N/A';

    const currentTicketNumber = incrementTicketCounter();

    const guild = client.guilds.cache.get(GUILD_ID);
    const reportChannel = guild?.channels.cache.get(REPORT_CHANNEL_ID);

    if (!guild || !reportChannel?.isTextBased()) {
        console.error('Guild or report channel not found.');
        return interaction.reply({
            content: '❌ Unable to submit ticket. Please contact an administrator.',
            ephemeral: true
        });
    }

    const reportEmbed = new EmbedBuilder()
        .setTitle(`🎟️ Support Ticket #${currentTicketNumber}`)
        .setDescription(`**Type:** ${getTypeEmoji(ticketType)} ${getTypeName(ticketType)}\n\nReply to this message to respond to the user.`)
        .addFields(
            { name: '🙋 Reported by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false }
        )
        .setColor(getTypeColor(ticketType))
        .setTimestamp();

    if (command !== 'N/A') {
        reportEmbed.addFields({ name: '⚙️ Command/Feature', value: command, inline: true });
    }

    reportEmbed.addFields(
        { name: '📝 Description', value: description.length > 1024 ? description.substring(0, 1021) + '...' : description, inline: false }
    );

    if (steps !== 'N/A') {
        reportEmbed.addFields({ name: '🔄 Steps to Reproduce', value: steps.length > 1024 ? steps.substring(0, 1021) + '...' : steps, inline: false });
    }

    if (expected !== 'N/A') {
        reportEmbed.addFields({ name: '⚖️ Expected vs Actual', value: expected.length > 1024 ? expected.substring(0, 1021) + '...' : expected, inline: false });
    }

    if (additional !== 'N/A') {
        reportEmbed.addFields({ name: 'ℹ️ Additional Info', value: additional.length > 1024 ? additional.substring(0, 1021) + '...' : additional, inline: false });
    }

    try {
        const reportMsg = await reportChannel.send({ embeds: [reportEmbed] });
        tickets.set(reportMsg.id, { userId: interaction.user.id, responded: false, ticketType });

        await interaction.reply({
            content: `✅ Ticket #${currentTicketNumber} submitted successfully!\n📩 Please check your DMs for any follow-up responses.`,
            ephemeral: true
        });

        const replyFilter = response => response.reference?.messageId === reportMsg.id;

        const replyCollector = reportChannel.createMessageCollector({
            filter: replyFilter,
            time: 7 * 24 * 60 * 60 * 1000
        });

        replyCollector.on('collect', async response => {
            const ticket = tickets.get(reportMsg.id);
            if (!ticket) return;

            if (ticket.responded) {
                return await response.reply('⚠️ This ticket has already been responded to.');
            }

            const userResponse = response.content;
            const replyEmbed = new EmbedBuilder()
                .setTitle(`💬 Response to Your Ticket #${currentTicketNumber}`)
                .addFields(
                    { name: 'Responded by', value: `${response.author.tag} (${response.author.id})`, inline: false },
                    { name: 'Message', value: userResponse }
                )
                .setColor(0x0000ff)
                .setTimestamp();

            try {
                const user = await client.users.fetch(ticket.userId);
                await user.send({ embeds: [replyEmbed] });
                await response.reply('📨 Response has been sent to the user.');
                tickets.set(reportMsg.id, { ...ticket, responded: true });
            } catch (err) {
                console.error('Error DMing user:', err);
                await response.reply('❌ Failed to send the response to the user. They may have DMs disabled.');
            }
        });

        replyCollector.on('end', collected => {
            if (collected.size === 0) {
                reportChannel.send(`⌛ No reply to support ticket #${currentTicketNumber} was made in time.`);
            }
        });

    } catch (err) {
        console.error('Error submitting ticket:', err);
        await interaction.reply({
            content: '❌ Failed to submit your ticket. Please try again later.',
            ephemeral: true
        });
    }

    pendingTickets.delete(userId);
}

function getTypeEmoji(type) {
    const emojis = {
        bug: '🐛',
        exploit: '🔓',
        suggestion: '💡',
        ban_appeal: '⚖️',
        other: '❓'
    };
    return emojis[type] || '📩';
}

function getTypeName(type) {
    const names = {
        bug: 'Bug Report',
        exploit: 'Exploit Report',
        suggestion: 'Suggestion',
        ban_appeal: 'Ban Appeal',
        other: 'Other'
    };
    return names[type] || 'Support Ticket';
}

function getTypeColor(type) {
    const colors = {
        bug: 0xff0000,
        exploit: 0xff6600,
        suggestion: 0x00ff00,
        ban_appeal: 0xffaa00,
        other: 0x00aaff
    };
    return colors[type] || 0x00aaff;
}

function registerTicketSystem(client) {
    initializeTicketSystem();

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
    initializeTicketSystem,
    incrementTicketCounter
};