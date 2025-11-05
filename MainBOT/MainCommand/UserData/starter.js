const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../Database/db');
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
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.starter')) return;

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

        db.get('SELECT coins, gems FROM userCoins WHERE userId = ?', [message.author.id], async (err, row) => {
            if (err) return console.error(err);

            if (row) {
                const embed = new EmbedBuilder()
                    .setTitle('⚠️ Starter Pack Already Claimed!')
                    .setDescription('You have already received your starter pack! Try `.daily` instead.')
                    .setColor('#FF0000');
                return message.reply({ embeds: [embed], ephemeral: true }).catch(console.error);
            }

            console.log(`Received /starter command from ${message.author.tag}`);

            const chance = Math.random() * 100;
            let coins, gems, description;

            if (chance < 70) {
                coins = 1000;
                gems = 100;
                description = '💠 "You got the **Common** gift, quite average, isn’t it?" - alterSliver';
            } else if (chance < 90) {
                coins = 2000;
                gems = 200;
                description = '🔷 "An **Uncommon** gift! Better than the common one, at least." - alterSliver';
            } else if (chance < 99) {
                coins = 5000;
                gems = 500;
                description = '🔶 "A **Rare** gift! Luck is on your side today!" - alterSliver';
            } else if (chance < 99.9) {
                coins = 10000;
                gems = 1000;
                description = '✨ "Go buy a lottery ticket! This gift is 0.1% chance!" - alterSliver';
            } else {
                coins = 100000;
                gems = 10000;
                description = '💎 "The **Ultimate** gift! This was supposed to be impossible to obtain!" - alterSliver';
            }

            db.run('INSERT INTO userCoins (userId, coins, gems, joinDate) VALUES (?, ?, ?, ?)',
                [message.author.id, coins, gems, new Date().toISOString()], (err) => {
                    if (err) return console.error(err);
                });

            const resultEmbed = new EmbedBuilder()
                .setTitle('🎁 Starter Pack Reward 🎁')
                .setDescription(`${description}\n\n🎉 **You received:**\n💰 **${coins.toLocaleString()}** coins\n💎 **${gems.toLocaleString()}** gems`)
                .setColor('#FFD700');

            const reply = await message.reply({ embeds: [resultEmbed], ephemeral: true }).catch(console.error);

            setTimeout(() => message.delete().catch(console.error), 30000); // Delete message after 30 seconds
        });
    });
}