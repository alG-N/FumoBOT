/**
 * Ticket Command - Bot Owner Only
 * View and manage user tickets/reports
 */

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { OWNER_IDS, DEVELOPER_ID, TICKET_TYPES, REPORT_CHANNEL_ID, FILE_PATHS } = require('../Config/ownerConfig');
const fs = require('fs');
const path = require('path');

function isAuthorized(userId) {
    return userId === DEVELOPER_ID || OWNER_IDS.includes(userId);
}

function getTicketCounter() {
    try {
        if (fs.existsSync(FILE_PATHS.TICKET_COUNTER)) {
            return parseInt(fs.readFileSync(FILE_PATHS.TICKET_COUNTER, 'utf8')) || 0;
        }
    } catch {}
    return 0;
}

function incrementTicketCounter() {
    const current = getTicketCounter();
    const newCount = current + 1;
    const dir = path.dirname(FILE_PATHS.TICKET_COUNTER);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE_PATHS.TICKET_COUNTER, String(newCount));
    return newCount;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket management (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('stats')
            .setDescription('View ticket statistics'))
        .addSubcommand(sub => sub
            .setName('types')
            .setDescription('View available ticket types')),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        if (!isAuthorized(userId)) {
            return interaction.reply({ content: '❌ This command is restricted to bot owners only.', ephemeral: true });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            switch (subcommand) {
                case 'stats': {
                    const totalTickets = getTicketCounter();
                    
                    const embed = new EmbedBuilder()
                        .setColor('Blue')
                        .setTitle('📊 Ticket Statistics')
                        .addFields(
                            { name: 'Total Tickets', value: String(totalTickets), inline: true },
                            { name: 'Report Channel', value: REPORT_CHANNEL_ID ? `<#${REPORT_CHANNEL_ID}>` : 'Not configured', inline: true }
                        )
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                
                case 'types': {
                    const typeList = Object.values(TICKET_TYPES)
                        .map(t => `${t.emoji} **${t.name}** - ${t.description}`)
                        .join('\n');
                    
                    const embed = new EmbedBuilder()
                        .setColor('Blue')
                        .setTitle('📋 Ticket Types')
                        .setDescription(typeList)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('[Ticket] Error:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    },
    
    // Export helpers
    getTicketCounter,
    incrementTicketCounter,
    TICKET_TYPES
};
