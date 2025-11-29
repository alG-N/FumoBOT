const {
    Client,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');
const db = require('../../Core/Database/db');
const { maintenance, developerID } = require("../../Configuration/MaintenanceConfig");
const { isBanned } = require('../../Administrator/BannedList/BanUtils');

// Global shop state
const globalShop = {
    eggs: [],
    timestamp: 0,
    buyers: new Map()
};

// Egg pool
const eggs = [
    {
        name: "CommonEgg",
        emoji: "🥚",
        price: { coins: 150_000, gems: 1_000 },
        chance: 1,
        description: "A simple egg. Nothing special, but who knows what's inside?"
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

// Utility functions
const formatNumber = (num) => num.toLocaleString();
const msUntilNextHour = () => {
    const now = new Date();
    return 3600000 - (now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds());
};

// Roll weighted random egg
function rollEgg() {
    const roll = Math.random();
    if (roll < eggs[2].chance) return eggs[2];
    if (roll < eggs[1].chance + eggs[2].chance) return eggs[1];
    return eggs[0];
}

// Generate new shop
function generateShop() {
    globalShop.eggs = Array.from({ length: 5 }, rollEgg);
    globalShop.timestamp = Date.now();
    globalShop.buyers.clear();
}

// Schedule hourly rotation
function scheduleShopRotation() {
    setTimeout(() => {
        generateShop();
        setInterval(generateShop, 3600000);
    }, msUntilNextHour());
}

// Initialize shop
generateShop();
scheduleShopRotation();

// Check access and return error embed if blocked
function checkAccess(userId) {
    const banData = isBanned(userId);
    const isBlocked = (maintenance === "yes" && userId !== developerID) || banData;
    
    if (!isBlocked) return null;

    let description = '';
    let title = '';

    if (maintenance === "yes") {
        title = '🚧 Maintenance Mode';
        description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
    } else {
        title = '⛔ You Are Banned';
        description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

        if (banData.expiresAt) {
            const remaining = banData.expiresAt - Date.now();
            const days = Math.floor(remaining / 86400000);
            const hours = Math.floor((remaining % 86400000) / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);

            const timeString = [
                days && `${days}d`,
                hours && `${hours}h`,
                minutes && `${minutes}m`,
                seconds && `${seconds}s`
            ].filter(Boolean).join(' ');

            description += `\n**Time Remaining:** ${timeString}`;
        } else {
            description += `\n**Ban Type:** Permanent`;
        }
    }

    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: maintenance === "yes" ? "Thank you for your patience" : "Ban enforced by developer" })
        .setTimestamp();
}

// Build shop embed
function buildShopEmbed(userId) {
    const bought = globalShop.buyers.get(userId) || new Set();
    const now = Date.now();
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    
    const msLeft = nextHour - now;
    const countdown = `${Math.floor(msLeft / 60000)}m ${Math.floor((msLeft % 60000) / 1000)}s`;

    const rarityMap = { CommonEgg: "🥚 Common", RareEgg: "✨ Rare", DivineEgg: "🌟 Divine" };

    const eggFields = globalShop.eggs.map((egg, idx) => ({
        name: `${egg.emoji} **${egg.name}** ${bought.has(idx) ? "✅" : ""}`,
        value:
            `> **Price:** <a:coin:1130479446263644260> ${formatNumber(egg.price.coins)} | <a:gem:1130479444305707139> ${formatNumber(egg.price.gems)}\n` +
            `> **Rarity:** ${rarityMap[egg.name]}\n` +
            `> ${egg.description}${bought.has(idx) ? "\n*You've already bought this.*" : ""}`,
        inline: false
    }));

    return new EmbedBuilder()
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
}

// Build button row
function buildButtons(userId) {
    const bought = globalShop.buyers.get(userId) || new Set();
    const styleMap = { CommonEgg: ButtonStyle.Primary, RareEgg: ButtonStyle.Success, DivineEgg: ButtonStyle.Danger };

    return new ActionRowBuilder().addComponents(
        globalShop.eggs.map((egg, idx) =>
            new ButtonBuilder()
                .setCustomId(`buy_egg_${idx}`)
                .setLabel(`${egg.emoji} Buy ${egg.name}`)
                .setStyle(styleMap[egg.name])
                .setDisabled(bought.has(idx))
        )
    );
}

// Handle egg purchase
async function handlePurchase(interaction, userId, eggIndex) {
    const egg = globalShop.eggs[eggIndex];

    return new Promise((resolve) => {
        db.get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId], (err, userRow) => {
            if (err) {
                console.error("DB error:", err);
                return resolve({ success: false, message: "Database error occurred." });
            }

            if (!userRow) {
                return resolve({ success: false, message: "You don't have any coins or gems yet." });
            }

            if (userRow.coins < egg.price.coins || userRow.gems < egg.price.gems) {
                return resolve({
                    success: false,
                    message: `You don't have enough to buy this egg!\nNeed <a:coin:1130479446263644260> **${formatNumber(egg.price.coins)}** and <a:gem:1130479444305707139> **${formatNumber(egg.price.gems)}**.`
                });
            }

            db.run(`UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
                [egg.price.coins, egg.price.gems, userId],
                (err) => {
                    if (err) {
                        console.error("Error updating coins:", err);
                        return resolve({ success: false, message: "Error processing your purchase." });
                    }

                    db.run(`INSERT INTO petInventory (userId, type, name, timestamp) VALUES (?, 'egg', ?, ?)`,
                        [userId, egg.name, Date.now()],
                        (err) => {
                            if (err) {
                                console.error("Error inserting pet:", err);
                                return resolve({ success: false, message: "Error storing your egg." });
                            }

                            if (!globalShop.buyers.has(userId)) globalShop.buyers.set(userId, new Set());
                            globalShop.buyers.get(userId).add(eggIndex);

                            resolve({
                                success: true,
                                message: `You bought a ${egg.emoji} **${egg.name}** for <a:coin:1130479446263644260> **${formatNumber(egg.price.coins)}** and <a:gem:1130479444305707139> **${formatNumber(egg.price.gems)}**!`
                            });
                        }
                    );
                }
            );
        });
    });
}

// Main command handler
module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot || ![".eggshop", ".es"].includes(message.content.trim().toLowerCase())) return;

        const accessEmbed = checkAccess(message.author.id);
        if (accessEmbed) return message.reply({ embeds: [accessEmbed] });

        const userId = message.author.id;
        const embed = buildShopEmbed(userId);
        const buttonRow = buildButtons(userId);

        const sent = await message.reply({ embeds: [embed], components: [buttonRow] });

        const collector = sent.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60_000
        });

        collector.on("collect", async (interaction) => {
            if (interaction.user.id !== userId) {
                return interaction.reply({ content: "This shop was opened by someone else!", ephemeral: true });
            }

            const idx = parseInt(interaction.customId.split("_")[2]);
            if (isNaN(idx) || idx < 0 || idx >= globalShop.eggs.length) {
                return interaction.reply({ content: "Invalid egg selected.", ephemeral: true });
            }

            const result = await handlePurchase(interaction, userId, idx);
            await interaction.reply({ content: result.message, ephemeral: true });

            if (result.success) {
                const updatedButtons = buildButtons(userId);
                sent.edit({ components: [updatedButtons] }).catch(() => {});
            }
        });
    });
};