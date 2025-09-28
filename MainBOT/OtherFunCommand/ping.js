const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and status!'),

    async execute(interaction) {
        // Maintenance or ban check
        const banData = isBanned(interaction.user.id);
        if ((maintenance === "yes" && interaction.user.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && interaction.user.id !== developerID) {
                description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                footerText = "Thank you for your patience";
            } else if (banData) {
                description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;
                if (banData.expiresAt) {
                    const remaining = banData.expiresAt - Date.now();
                    const seconds = Math.floor((remaining / 1000) % 60);
                    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
                    const timeString = [
                        days ? `${days}d` : '',
                        hours ? `${hours}h` : '',
                        minutes ? `${minutes}m` : '',
                        seconds ? `${seconds}s` : ''
                    ].filter(Boolean).join(' ');
                    description += `\n**Time Remaining:** ${timeString}`;
                } else {
                    description += `\n**Ban Type:** Permanent`;
                }
                footerText = "Ban enforced by developer";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: footerText })
                .setTimestamp();

            console.log(`[${new Date().toISOString()}] Blocked user (${interaction.user.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
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
