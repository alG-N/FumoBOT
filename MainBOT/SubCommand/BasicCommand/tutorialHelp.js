const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { maintenance, developerID } = require("../../MainCommand/Configuration/maintenanceConfig.js");
const { isBanned } = require('../../MainCommand/Administrator/BannedList/BanUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('othercmd')
        .setDescription('Shows a list of other fun commands.'),
    async execute(interaction) {
        // Check for maintenance mode or ban
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

        const helpEmbed = new EmbedBuilder()
            .setTitle('🛠️ FumoBOT(OtherCMD) - List of Commands')
            .setColor('#00ccff')
            .addFields(
                { name: '/anime [nameAnime]', value: 'Displays detailed information about this anime' },
                { name: '/play', value: 'Play a music of your own choice' },
                { name: '/invite', value: 'Invite the bot to other server!' },
                { name: '/reddit', value: 'Fetch post from Reddit!' },
                { name: '/groupInform', value: 'Displays detailed information about the server.' },
                { name: '/avatar help', value: 'Shows information about a user. If no user is mentioned, shows info about the command user.' },
                { name: '/ping', value: 'Checks the bot\'s latency and API latency.' },
                { name: '/roleinfo [@role]', value: 'Displays information about a specific role.' },
                { name: '/leaderboard', value: 'Displays the no-life' },
                { name: '/afk', value: 'If you want to afk sure' },
                { name: '/deathbattle [@username] [set-hp] [jjk / ??? anime]', value: 'Deathbattle with a friend in anime..' },
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [helpEmbed], ephemeral: false });
    }
};
