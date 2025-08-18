const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});
client.setMaxListeners(150);
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');
module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content.startsWith('.otherCMD')) return;
        // Check for maintenance mode or ban
        const banData = isBanned(message.author.id);
        if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && message.author.id !== developerID) {
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

            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

            return message.reply({ embeds: [embed] });
        }
        const helpEmbed = new EmbedBuilder()
            .setTitle('🛠️ FumoBOT(OtherCMD) - List of Commands')
            .setColor('#00ccff')
            .addFields(
                { name: '/anime [nameAnime]', value: 'Displays detailed information about this anime' },
                { name: '/groupInform', value: 'Displays detailed information about the server.' },
                { name: '/avatar help', value: 'Shows information about a user. If no user is mentioned, shows info about the command user.' },
                { name: '/ping', value: 'Checks the bot\'s latency and API latency.' },
                { name: '/roleinfo [@role]', value: 'Displays information about a specific role.' },
                { name: '/leaderboard', value: 'Displays the no-life' },
                { name: '/afk', value: 'If you want to afk sure' },
                { name: '/deathbattle [@username] [set-hp] [jjk / ??? anime]', value: 'Deathbattle with a friend in anime..' },
            )
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() });
        await message.channel.send({ embeds: [helpEmbed] });
    });
}