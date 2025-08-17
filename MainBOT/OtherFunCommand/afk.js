const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
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
const fs = require('fs');
client.setMaxListeners(150);
const { maintenance, developerID } = require("../Command/Maintenace/MaintenaceConfig.js");
const { isBanned } = require('../Command/Banned/BanUtils.js');
const afkFilePath = 'MainBOT/SillyAFK.json';
module.exports = (client) => {
    const afkUsers = new Map();

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}h ${m}m ${s}s`;
    }

    function loadAfkUsers() {
        if (!fs.existsSync(afkFilePath)) {
            fs.writeFileSync(afkFilePath, '{}');
        }

        try {
            const rawData = fs.readFileSync(afkFilePath, 'utf-8').trim();
            if (rawData) {
                const parsed = JSON.parse(rawData);
                for (const [userId, afkData] of Object.entries(parsed)) {
                    afkUsers.set(userId, afkData);
                }
            }
        } catch (err) {
            console.error('[AFK] Failed to parse or load AFK file:', err);
        }
    }

    function saveAfkUsers() {
        const data = Object.fromEntries(afkUsers.entries());
        fs.writeFileSync(afkFilePath, JSON.stringify(data, null, 2));
    }

    loadAfkUsers();

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        // Check for maintenance mode or ban
        // const banData = isBanned(message.author.id);
        // if ((maintenance === "yes" && message.author.id !== developerID) || banData) {
        //     let description = '';
        //     let footerText = '';

        //     if (maintenance === "yes" && message.author.id !== developerID) {
        //         description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
        //         footerText = "Thank you for your patience";
        //     } else if (banData) {
        //         description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

        //         if (banData.expiresAt) {
        //             const remaining = banData.expiresAt - Date.now();
        //             const seconds = Math.floor((remaining / 1000) % 60);
        //             const minutes = Math.floor((remaining / (1000 * 60)) % 60);
        //             const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
        //             const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

        //             const timeString = [
        //                 days ? `${days}d` : '',
        //                 hours ? `${hours}h` : '',
        //                 minutes ? `${minutes}m` : '',
        //                 seconds ? `${seconds}s` : ''
        //             ].filter(Boolean).join(' ');

        //             description += `\n**Time Remaining:** ${timeString}`;
        //         } else {
        //             description += `\n**Ban Type:** Permanent`;
        //         }

        //         footerText = "Ban enforced by developer";
        //     }

        //     const embed = new EmbedBuilder()
        //         .setColor('#FF0000')
        //         .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
        //         .setDescription(description)
        //         .setFooter({ text: footerText })
        //         .setTimestamp();

        //     console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);

        //     return message.reply({ embeds: [embed] });
        // }

        const authorId = message.author.id;

        // If the user was AFK and sends a message, remove AFK status
        if (afkUsers.has(authorId)) {
            const { timestamp } = afkUsers.get(authorId);
            const timeAway = Math.floor((Date.now() - timestamp) / 1000);

            const returnEmbed = new EmbedBuilder()
                .setColor('#00CED1')
                .setTitle('Welcome Back!')
                .setDescription(`You were AFK for **${formatTime(timeAway)}**. おかえりなさい！`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setImage('https://media.tenor.com/blCLnVdO3CgAAAAd/senko-sewayaki-kitsune-no-senko-san.gif')
                .setFooter({ text: 'We missed you! 🎌', iconURL: client.user.displayAvatarURL() });

            afkUsers.delete(authorId);
            saveAfkUsers();

            return message.reply({ embeds: [returnEmbed] })
                .then(msg => setTimeout(() => msg.delete().catch(() => { }), 15000));
        }

        // If user mentions an AFK user
        const mentionedAfk = message.mentions.users.filter(u => afkUsers.has(u.id));
        mentionedAfk.forEach(user => {
            const { reason, timestamp } = afkUsers.get(user.id);
            const timeAway = Math.floor((Date.now() - timestamp) / 1000);

            const afkEmbed = new EmbedBuilder()
                .setColor('#FFA07A')
                .setTitle(`${user.username} is currently AFK 💤`)
                .setDescription(`**AFK for:** ${formatTime(timeAway)}\n**Reason:** ${reason}`)
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields([
                    {
                        name: 'While you wait...',
                        value: '🍵 Grab tea\n📺 Watch anime\n🎮 Play a game\n🈶 Practice Japanese\n🎨 Draw a fumo\n'
                    }
                ])
                .setFooter({ text: 'They’ll return soon 🌸', iconURL: client.user.displayAvatarURL() });

            message.reply({ embeds: [afkEmbed] });
        });

        // AFK command
        if (message.content.startsWith('.afk')) {
            const args = message.content.split(' ').slice(1);
            const reason = args.join(' ') || 'No reason provided.';
            const timestamp = Date.now();

            afkUsers.set(authorId, { reason, timestamp });
            saveAfkUsers();

            const afkSetEmbed = new EmbedBuilder()
                .setColor('#8A2BE2')
                .setTitle('AFK mode activated!')
                .setDescription(`**Reason:** ${reason}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setFooter({ text: 'I will let others know if they mention you 💬', iconURL: client.user.displayAvatarURL() });

            return message.reply({ embeds: [afkSetEmbed] });
        }
    });
};