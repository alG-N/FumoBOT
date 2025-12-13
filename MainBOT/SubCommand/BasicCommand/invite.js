const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');

const { maintenance, developerID } = require("../../MainCommand/Configuration/maintenanceConfig.js");
const { isBanned } = require('../../MainCommand/Administrator/BannedList/BanUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Invite the bot to your server!'), 
    async execute(interaction) {

        const banData = await isBanned(interaction.user.id);

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

        const inviteURL = `https://discord.com/oauth2/authorize?client_id=1254962096924397569&permissions=4292493126401985&integration_type=0&scope=bot`;

        let inviteEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Invite FumoBOT to Your Server!')
            .setDescription('Click the link below to invite FumoBOT and enjoy its features!')
            .addFields({ name: 'Invite Link', value: `[Invite FumoBOT](${inviteURL})` })
            .setFooter({ text: 'Thank you for choosing FumoBOT!' })
            .setTimestamp();

        return interaction.reply({ embeds: [inviteEmbed], ephemeral: true });
    }
};
