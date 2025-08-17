const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { promisify } = require('util');
const db = require('../database/db');
db.getAsync = promisify(db.get).bind(db);
db.allAsync = promisify(db.all).bind(db);
db.runAsync = (...args) => new Promise((resolve, reject) => {
    db.run(...args, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});
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
module.exports = async (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || (!message.content.startsWith('.usefragment') && !message.content.startsWith('.uf'))) return;

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

        const userId = message.author.id;
        const fragmentName = 'FragmentOf1800s(R)';

        // Parse how many fragments the user wants to use
        const args = message.content.split(' ');
        let amountToUse = 1;
        if (args[1] && !isNaN(args[1])) {
            amountToUse = Math.floor(Math.abs(parseInt(args[1])));
        }

        if (amountToUse <= 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('❌ Please enter a valid number of fragments to use.')]
            });
        }

        try {
            // Get fragment quantity
            const [userRow] = await db.allAsync(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, fragmentName]
            );
            const fragments = userRow?.quantity || 0;

            if (fragments < amountToUse) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(`❌ You only have ${fragments} fragment(s), but you're trying to use ${amountToUse}.`)]
                });
            }

            // Get current fragmentUses
            const [upgradeRow] = await db.allAsync(
                `SELECT fragmentUses FROM userUpgrades WHERE userId = ?`,
                [userId]
            );
            const currentUses = upgradeRow?.fragmentUses || 0;

            if (currentUses >= 30) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⚠️ You’ve already reached the maximum of 30 farming limit upgrades using fragments.')]
                });
            }

            if (currentUses + amountToUse > 30) {
                const availableUses = 30 - currentUses;
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setDescription(`⚠️ You can only use **${availableUses}** more fragment(s). The max limit is 30 fragments upgrade only, please consider upgrading the limit to increase.`)]
                });
            }

            // Deduct fragments and update uses
            await db.runAsync(
                `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                [amountToUse, userId, fragmentName]
            );

            if (upgradeRow) {
                await db.runAsync(
                    `UPDATE userUpgrades SET fragmentUses = fragmentUses + ? WHERE userId = ?`,
                    [amountToUse, userId]
                );
            } else {
                await db.runAsync(
                    `INSERT INTO userUpgrades (userId, fragmentUses) VALUES (?, ?)`,
                    [userId, amountToUse]
                );
            }

            const newLimit = 5 + currentUses + amountToUse;

            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('Green')
                    .setDescription(`✅ Fragment(s) used! Your new farming limit is now **${newLimit}**.`)]
            });

        } catch (error) {
            console.error('Error in /usefragment:', error);
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('Red')
                    .setDescription('⚠️ Something went wrong while using the fragment.')],
            });
        }
    });
};


