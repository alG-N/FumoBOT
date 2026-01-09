const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { checkAccess, AccessType } = require('../Middleware');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and status!'),

    async execute(interaction) {
        // Check access (maintenance + ban)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        // Latency calculation
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = Math.abs(sent.createdTimestamp - interaction.createdTimestamp);
        const apiLatency = Math.round(interaction.client.ws.ping);
        const uptime = Math.floor(interaction.client.uptime / 1000);
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = uptime % 60;
        const uptimeString = [
            days ? `${days}d` : '',
            hours ? `${hours}h` : '',
            minutes ? `${minutes}m` : '',
            seconds ? `${seconds}s` : ''
        ].filter(Boolean).join(' ');

        const pingEmbed = new EmbedBuilder()
            .setColor('#ffcc00')
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true },
                { name: 'Uptime', value: uptimeString, inline: true }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ content: '', embeds: [pingEmbed] });
    }
};
