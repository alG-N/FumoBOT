const {
    Client,
    GatewayIntentBits,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
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
function formatNumber(number) {
    return number.toLocaleString();
}
const { maintenance, developerID } = require("../Maintenace/MaintenaceConfig");
const { isBanned } = require('../Banned/BanUtils');
/*
// Global shop state
// This will hold the current eggs and buyers
*/
const globalShop = {
    eggs: [], // the current 5 eggs
    timestamp: 0, // when it was last refreshed
    buyers: new Map() // key = userId, value = Set of bought egg indexes
};

// Egg pool
const eggs = [
    {
        name: "CommonEgg",
        emoji: "🥚",
        price: { coins: 150_000, gems: 1_000 },
        chance: 1,
        description: "A simple egg. Nothing special, but who knows what’s inside?"
    },
    {
        name: "RareEgg",
        emoji: "✨",
        price: { coins: 1_750_000, gems: 150_000 },
        chance: 0.3,
        description: "A rare egg with a sparkling shell. Contains rare pets!"
    },
    {
        name: "DivineEgg",
        emoji: "🌟",
        price: { coins: 150_000_000, gems: 15_000_000 },
        chance: 0.05,
        description: "A legendary egg, glowing with divine energy. Only the luckiest will get this!"
    }
];

// Roll 5 eggs every hour
function rollEgg() {
    const roll = Math.random();
    if (roll < eggs[2].chance) return eggs[2];
    if (roll < eggs[1].chance + eggs[2].chance) return eggs[1];
    return eggs[0];
}

function generateShop() {
    globalShop.eggs = [];
    for (let i = 0; i < 5; i++) {
        globalShop.eggs.push(rollEgg());
    }
    globalShop.timestamp = Date.now();
    globalShop.buyers.clear();
    // console.log(`[SHOP RESET] New eggs generated at ${new Date().toLocaleTimeString()}`);
}

// Calculate ms until the top of the next hour
function msUntilNextHour() {
    const now = new Date();
    return 3600000 - (now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds());
}

// Start scheduling the hourly refresh
function scheduleShopRotation() {
    const delay = msUntilNextHour();
    setTimeout(() => {
        generateShop();
        setInterval(generateShop, 60 * 60 * 1000);
    }, delay);
}

// Run immediately and then every hour
generateShop();
scheduleShopRotation();

module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (
            message.author.bot ||
            ![".eggshop", ".es"].includes(message.content.trim().toLowerCase())
        ) return;
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
        const bought = globalShop.buyers.get(userId) || new Set();

        const now = Date.now();
        const nextHour = new Date();
        nextHour.setMinutes(0, 0, 0);
        nextHour.setHours(nextHour.getHours() + 1);
        const msLeft = nextHour - now;
        const mins = Math.floor(msLeft / 60000);
        const secs = Math.floor((msLeft % 60000) / 1000);
        const countdown = `${mins}m ${secs}s`;

        // Enhanced UI: Add emojis, rarity, and better formatting
        const eggFields = globalShop.eggs.map((egg, idx) => ({
            name: `${egg.emoji} **${egg.name}** ${bought.has(idx) ? "✅" : ""}`,
            value:
                `> **Price:** <a:coin:1130479446263644260> ${formatNumber(egg.price.coins)} | <a:gem:1130479444305707139> ${formatNumber(egg.price.gems)}\n` +
                `> **Rarity:** ${egg === eggs[2] ? "🌟 Divine" : egg === eggs[1] ? "✨ Rare" : "🥚 Common"}\n` +
                `> ${egg.description}\n` +
                (bought.has(idx) ? "*You've already bought this.*" : ""),
            inline: false
        }));

        const embed = new EmbedBuilder()
            .setTitle("🥚 **Global Egg Shop**")
            .setDescription(
                "Welcome to the **Egg Shop**!\n" +
                "Here are the current eggs available for **everyone**.\n" +
                "Shop resets **every hour on the hour**.\n\n" +
                "Click a button below to buy an egg!"
            )
            .setColor(0xFFD700)
            .addFields(eggFields)
            .setFooter({ text: `🕒 Shop resets in ${countdown}` })
            .setTimestamp();

        const buttonRow = new ActionRowBuilder().addComponents(
            globalShop.eggs.map((egg, idx) =>
                new ButtonBuilder()
                    .setCustomId(`buy_egg_${idx}`)
                    .setLabel(`${egg.emoji} Buy ${egg.name}`)
                    .setStyle(
                        egg === eggs[2]
                            ? ButtonStyle.Danger
                            : egg === eggs[1]
                                ? ButtonStyle.Success
                                : ButtonStyle.Primary
                    )
                    .setDisabled(bought.has(idx))
            )
        );

        const sent = await message.reply({ embeds: [embed], components: [buttonRow] });

        const collector = sent.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000
        });

        collector.on("collect", async (interaction) => {
            if (interaction.user.id !== userId)
                return interaction.reply({ content: "This shop was opened by someone else!", ephemeral: true });

            const idx = parseInt(interaction.customId.split("_")[2]);
            if (isNaN(idx) || idx < 0 || idx >= globalShop.eggs.length)
                return interaction.reply({ content: "Invalid egg selected.", ephemeral: true });

            const egg = globalShop.eggs[idx];

            db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId], async (err, userRow) => {
                if (err) {
                    console.error("DB error:", err);
                    return interaction.reply({ content: "Database error occurred.", ephemeral: true });
                }

                if (!userRow) {
                    return interaction.reply({ content: "You don't have any coins or gems yet.", ephemeral: true });
                }

                const hasEnoughCoins = userRow.coins >= egg.price.coins;
                const hasEnoughGems = userRow.gems >= egg.price.gems;

                if (!hasEnoughCoins || !hasEnoughGems) {
                    return interaction.reply({
                        content: `You don't have enough to buy this egg!\nNeed <a:coin:1130479446263644260> **${formatNumber(egg.price.coins)}** and <a:gem:1130479444305707139> **${formatNumber(egg.price.gems)}**.`,
                        ephemeral: true
                    });
                }

                db.run(`UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
                    [egg.price.coins, egg.price.gems, userId],
                    (err) => {
                        if (err) {
                            console.error("Error updating coins:", err);
                            return interaction.reply({ content: "Error processing your purchase.", ephemeral: true });
                        }

                        db.run(`INSERT INTO petInventory (userId, type, name, timestamp) VALUES (?, 'egg', ?, ?)`,
                            [userId, egg.name, Date.now()],
                            (err) => {
                                if (err) {
                                    console.error("Error inserting pet:", err);
                                    return interaction.reply({ content: "Error storing your egg.", ephemeral: true });
                                }

                                if (!globalShop.buyers.has(userId)) globalShop.buyers.set(userId, new Set());
                                const userBuys = globalShop.buyers.get(userId);
                                userBuys.add(idx);

                                interaction.reply({
                                    content: `You bought a ${egg.emoji} **${egg.name}** for <a:coin:1130479446263644260> **${formatNumber(egg.price.coins)}** and <a:gem:1130479444305707139> **${formatNumber(egg.price.gems)}**!`,
                                    ephemeral: true
                                });

                                const updatedRow = new ActionRowBuilder().addComponents(
                                    buttonRow.components.map((btn, i) =>
                                        ButtonBuilder.from(btn).setDisabled(userBuys.has(i))
                                    )
                                );
                                sent.edit({ components: [updatedRow] }).catch(() => { });
                            }
                        );
                    }
                );
            });
        });
    });
};
