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
const db = require('../../Core/Database/dbSetting');
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

const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = async (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot || (!message.content.startsWith('.usefragment') && !message.content.startsWith('.uf'))) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;
        const fragmentName = 'FragmentOf1800s(R)';

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

            const [upgradeRow] = await db.allAsync(
                `SELECT fragmentUses FROM userUpgrades WHERE userId = ?`,
                [userId]
            );
            const currentUses = upgradeRow?.fragmentUses || 0;

            if (currentUses >= 30) {
                return message.reply({
                    embeds: [new EmbedBuilder()
                        .setColor('Red')
                        .setDescription('⚠️ You\'ve already reached the maximum of 30 farming limit upgrades using fragments.')]
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
                    `INSERT INTO userUpgrades (userId, fragmentUses) VALUES (?, ?)
                     ON CONFLICT(userId) DO UPDATE SET fragmentUses = fragmentUses + ?`,
                    [userId, amountToUse, amountToUse]
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