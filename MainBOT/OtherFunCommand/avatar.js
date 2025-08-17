const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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
        if (message.author.bot || !message.content.startsWith('.avatar')) return;

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

        const args = message.content.split(' ');
        let user;
        let avatarSize = 512; // Default avatar size
        let avatarType = 'dynamic'; // Default avatar type

        if (args[1] && args[1].toLowerCase() === 'help') {
            const helpEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('Avatar Command Help')
                .setDescription('Here are the ways you can use the `.avatar` command:')
                .addFields(
                    { name: '.avatar', value: 'Displays your own avatar.' },
                    { name: '.avatar @mention', value: 'Displays the avatar of the mentioned user.' },
                    { name: '.avatar [username]', value: 'Displays the avatar of the user with the given username.' },
                    { name: '.avatar @mention [size]', value: 'Shows avatar with specific size (128, 256, 512, 1024).' },
                    { name: '.avatar @mention static', value: 'Shows the static PNG version of the avatar.' }
                )
                .setFooter({ text: 'Use these options for more customized avatar views.' })
                .setTimestamp();
            return message.channel.send({ embeds: [helpEmbed] });
        }

        // Check for size options
        const sizeOption = args.find(arg => ['128', '256', '512', '1024'].includes(arg));
        if (sizeOption) {
            avatarSize = parseInt(sizeOption);
        }
        if (args.includes('static')) {
            avatarType = 'static';
        }

        if (message.mentions.users.size > 0) {
            user = message.mentions.users.first();
        } else if (args.length === 1 || sizeOption || args.includes('static')) {
            user = message.author;
        } else {
            const username = args.slice(1).filter(arg => !['static', sizeOption].includes(arg)).join(' ');
            user = message.guild.members.cache.find(member =>
                member.user.username.toLowerCase().includes(username.toLowerCase()) ||
                member.displayName.toLowerCase().includes(username.toLowerCase())
            )?.user;
        }

        if (user) {
            const avatarURL = avatarType === 'static'
                ? user.displayAvatarURL({ extension: 'png', size: avatarSize })
                : user.displayAvatarURL({ dynamic: true, size: avatarSize });

            const avatarEmbed = new EmbedBuilder()
                .setTitle(`${user.username}'s Avatar`)
                .setDescription(`[Click here for full size](${avatarURL})`)
                .setImage(avatarURL)
                .setColor('#3498db')
                .setFooter({ text: `Requested by ${message.author.username}, use "/avatar help" to see more command`, iconURL: message.author.displayAvatarURL() })
                .addFields(
                    { name: 'Username', value: user.username, inline: true },
                    { name: 'User ID', value: user.id, inline: true },
                    { name: 'Avatar Size', value: `${avatarSize}px`, inline: true }
                )
                .setTimestamp();
            return message.channel.send({ embeds: [avatarEmbed] });
        } else {
            return message.channel.send('**❌ User not found:** Please try again with a valid mention, username, or ID.');
        }
    });
}