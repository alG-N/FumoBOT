const { EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TICKET_FILE = path.join(__dirname, '../ticketCounter.txt');
const GUILD_ID = '1255091916823986207';
const REPORT_CHANNEL_ID = '1362826913088799001';

let ticketCounter = 0;
const tickets = new Map();

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

    const promptEmbed = new EmbedBuilder()
        .setTitle('📩 Report an Issue/Suggestion to alterGolden')
        .setDescription('Reply to this message with a brief description of your problem/suggestion.\nOr appeal for a ban if you were banned.')
        .setColor(0xff0000);

    try {
        const sentPrompt = await message.channel.send({ embeds: [promptEmbed] });

        const filter = m =>
            m.reference?.messageId === sentPrompt.id && m.author.id === message.author.id;

        const collector = message.channel.createMessageCollector({ filter, time: 60000 });

        collector.on('collect', async m => {
            const problemDescription = m.content;
            await m.delete().catch(() => null);

            const currentTicketNumber = incrementTicketCounter();

            const guild = client.guilds.cache.get(GUILD_ID);
            const reportChannel = guild?.channels.cache.get(REPORT_CHANNEL_ID);

            if (!guild || !reportChannel?.isTextBased()) {
                console.error('Guild or report channel not found.');
                return message.channel.send('❌ Unable to submit report. Please contact an administrator.');
            }

            const reportEmbed = new EmbedBuilder()
                .setTitle(`🎟️ New Support Ticket #${currentTicketNumber}`)
                .setDescription(`Please reply to this message to respond to the user.`)
                .addFields(
                    { name: '📝 Problem/Suggestion:', value: problemDescription },
                    { name: '🙋 Reported by:', value: `${m.author.tag} (${m.author.id})` }
                )
                .setColor(0x00ff00)
                .setTimestamp();

            try {
                const reportMsg = await reportChannel.send({ embeds: [reportEmbed] });
                tickets.set(reportMsg.id, { userId: m.author.id, responded: false });
                
                await sentPrompt.delete().catch(() => null);
                await message.channel.send(
                    "✅ Thank you! We'll look into your issue shortly.\n📩 Please check your DMs so we can reach out to you!"
                );

                const replyFilter = response =>
                    response.reference?.messageId === reportMsg.id;

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
                            { name: 'Responded by:', value: `${response.author.tag} (${response.author.id})` },
                            { name: 'Message:', value: userResponse }
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
                console.error('Error sending report:', err);
                await message.channel.send('❌ Failed to submit your report. Please try again later.');
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                message.channel.send('⏳ You did not respond in time. Try using `.report` again.');
                sentPrompt.delete().catch(() => null);
            }
        });

    } catch (err) {
        console.error('Error creating report prompt:', err);
        message.channel.send('⚠️ Something went wrong while starting the report process.');
    }
}

function registerTicketSystem(client) {
    initializeTicketSystem();

    client.on(Events.MessageCreate, async message => {
        await handleReportCommand(message, client);
    });
}

module.exports = {
    registerTicketSystem,
    initializeTicketSystem,
    incrementTicketCounter
};