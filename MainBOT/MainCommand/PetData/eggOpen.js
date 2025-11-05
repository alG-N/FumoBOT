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
 // Egg data with hatch times and rarity
const eggData = {
    "CommonEgg": { time: 10 * 10 * 1000, emoji: "🥚", rarity: "Common" },
    "RareEgg": { time: 90 * 60 * 1000, emoji: "🐣", rarity: "Rare" },
    "DivineEgg": { time: 6 * 60 * 60 * 1000, emoji: "🌟", rarity: "Divine" }
};

// Helper to get user's egg inventory
async function getUserEggs(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT name, COUNT(*) as count FROM petInventory WHERE userId = ? AND type = 'egg' GROUP BY name`,
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Helper to get user's hatching eggs
async function getUserHatchingEggs(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT eggName, hatchAt FROM hatchingEggs WHERE userId = ? ORDER BY hatchAt ASC`,
            [userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const content = message.content.trim().toLowerCase();
        if (
            !content.startsWith(".useegg") &&
            !content.startsWith(".ue") &&
            !content.startsWith(".eggcheck")
        ) return;
        if (message.author.bot) return;

        const userId = message.author.id;
        const args = message.content.split(" ").slice(1);
        const command = content.split(" ")[0];

        // Maintenance/ban check
        const banData = isBanned(userId);
        if ((maintenance === "yes" && userId !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && userId !== developerID) {
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

            console.log(`[${new Date().toISOString()}] Blocked user (${userId}) due to ${maintenance === "yes" ? "maintenance" : "ban"}.`);
            return message.reply({ embeds: [embed] });
        }

        // .eggcheck command: show user's hatching eggs and inventory
        if (command === ".eggcheck") {
            const [eggs, hatching] = await Promise.all([
                getUserEggs(userId),
                getUserHatchingEggs(userId)
            ]);
            let desc = "";

            if (eggs.length === 0) {
                desc += "You have no eggs in your inventory.\n";
            } else {
                desc += "**Your Egg Inventory:**\n";
                for (const egg of eggs) {
                    const data = eggData[egg.name];
                    desc += `${data ? data.emoji : "🥚"} **${egg.name}** × ${egg.count}\n`;
                }
            }

            if (hatching.length === 0) {
                desc += "\nYou have no eggs currently hatching.";
            } else {
                desc += "\n**Eggs Hatching:**\n";
                for (const egg of hatching) {
                    const data = eggData[egg.eggName];
                    desc += `${data ? data.emoji : "🥚"} **${egg.eggName}** - Hatches <t:${Math.floor(egg.hatchAt / 1000)}:R>\n`;
                }
            }

            // Add "Hatch All" button if user has eggs in inventory and less than 5 hatching
            let components = [];
            if (eggs.length > 0 && hatching.length < 5) {
                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`hatch_all_${userId}`)
                            .setLabel("Hatch All")
                            .setStyle(ButtonStyle.Success)
                    )
                );
            }

            const embed = new EmbedBuilder()
                .setColor("#FFD700")
                .setTitle("🥚 Your Eggs")
                .setDescription(desc)
                .setFooter({ text: "Use .useegg <EggName> to hatch an egg!" });

            const replyMsg = await message.reply({ embeds: [embed], components });

            // Handle "Hatch All" button
            if (components.length > 0) {
                const filter = (i) =>
                    i.customId === `hatch_all_${userId}` && i.user.id === userId;
                replyMsg
                    .awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 60_000 })
                    .then(async (interaction) => {
                        // Get up-to-date eggs and hatching count
                        const [eggsNow, hatchingNow] = await Promise.all([
                            getUserEggs(userId),
                            getUserHatchingEggs(userId)
                        ]);
                        let slotsLeft = 5 - hatchingNow.length;
                        if (slotsLeft <= 0) {
                            await interaction.update({
                                content: "❌ You have no available incubator slots.",
                                embeds: [],
                                components: []
                            });
                            return;
                        }
                        let hatched = [];
                        for (const egg of eggsNow) {
                            if (slotsLeft <= 0) break;
                            let count = Math.min(egg.count, slotsLeft);
                            for (let i = 0; i < count; i++) {
                                // Remove egg from inventory
                                await new Promise((resolve, reject) => {
                                    db.get(
                                        `SELECT rowid FROM petInventory WHERE userId = ? AND type = 'egg' AND name = ? LIMIT 1`,
                                        [userId, egg.name],
                                        (err, row) => {
                                            if (row) {
                                                db.run(
                                                    `DELETE FROM petInventory WHERE rowid = ?`,
                                                    [row.rowid],
                                                    resolve
                                                );
                                            } else {
                                                resolve();
                                            }
                                        }
                                    );
                                });
                                // Insert into hatchingEggs
                                const now = Date.now();
                                const hatchAt = now + (eggData[egg.name]?.time || 0);
                                db.run(
                                    `INSERT INTO hatchingEggs (userId, eggName, startedAt, hatchAt) VALUES (?, ?, ?, ?)`,
                                    [userId, egg.name, now, hatchAt]
                                );
                                hatched.push({ name: egg.name, hatchAt });
                                slotsLeft--;
                                if (slotsLeft <= 0) break;
                            }
                        }
                        let desc = hatched.length
                            ? hatched.map(e => `${eggData[e.name]?.emoji || "🥚"} **${e.name}** - Hatches <t:${Math.floor(e.hatchAt / 1000)}:R>`).join("\n")
                            : "No eggs were hatched.";
                        await interaction.update({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor("#00FF00")
                                    .setTitle("🥚 Eggs Hatching Started!")
                                    .setDescription(desc)
                                    .setFooter({ text: "Use .eggcheck to monitor progress." })
                            ],
                            components: []
                        });
                    })
                    .catch(() => {
                        replyMsg.edit({ components: [] }).catch(() => {});
                    });
            }
            return;
        }

        // .useegg/.ue command: hatch an egg
        const eggName = args[0];
        if (!eggName || !eggData[eggName]) {
            // Suggest available eggs
            const available = Object.keys(eggData).map(e => `\`${e}\``).join(", ");
            return message.reply(`❌ Please specify a valid egg: ${available}.\nUse \`.eggcheck\` to see your eggs.`);
        }

        // Check if user already has 5 eggs hatching
        const existingCount = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) AS count FROM hatchingEggs WHERE userId = ?`, [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });

        if (existingCount >= 5) {
            return message.reply("❌ You can only incubate up to 5 eggs at once. Use `.eggcheck` to manage them.");
        }

        // Check if user has the egg in inventory
        const egg = await new Promise((resolve, reject) => {
            db.get(
                `SELECT rowid, * FROM petInventory WHERE userId = ? AND type = 'egg' AND name = ? LIMIT 1`,
                [userId, eggName],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!egg) {
            return message.reply(`❌ You don't have any ${eggName} to hatch. Use \`.eggcheck\` to view your eggs.`);
        }

        // Remove egg from inventory
        db.run(
            `DELETE FROM petInventory WHERE rowid = ?`,
            [egg.rowid]
        );

        // Insert into hatchingEggs
        const now = Date.now();
        const hatchAt = now + eggData[eggName].time;

        db.run(
            `INSERT INTO hatchingEggs (userId, eggName, startedAt, hatchAt) VALUES (?, ?, ?, ?)`,
            [userId, egg.name, now, hatchAt]
        );

        // Add cancel button for the user to cancel hatching
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`cancel_hatch_${egg.rowid}_${userId}`)
                .setLabel("Cancel Hatching")
                .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
            .setColor("#00FF00")
            .setTitle(`${eggData[eggName].emoji} Egg Hatching Started!`)
            .setDescription(`You placed a **${egg.name}** (${eggData[eggName].rarity}) into the incubator.\nIt will hatch <t:${Math.floor(hatchAt / 1000)}:R>.`)
            .setFooter({ text: "Use .eggcheck to monitor progress." });

        const replyMsg = await message.reply({ embeds: [embed], components: [row] });

        // Button interaction for canceling hatching
        const filter = (i) =>
            i.customId === `cancel_hatch_${egg.rowid}_${userId}` && i.user.id === userId;
        replyMsg
            .awaitMessageComponent({ filter, componentType: ComponentType.Button, time: 60_000 })
            .then(async (interaction) => {
                // Remove from hatchingEggs and return egg to inventory
                db.run(
                    `DELETE FROM hatchingEggs WHERE userId = ? AND eggName = ? AND hatchAt = ?`,
                    [userId, egg.name, hatchAt]
                );
                db.run(
                    `INSERT INTO petInventory (userId, name, type) VALUES (?, ?, 'egg')`,
                    [userId, egg.name]
                );
                // Disable the button after click
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_hatch_${egg.rowid}_${userId}`)
                        .setLabel("Cancel Hatching")
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
                await interaction.update({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#FF9900")
                            .setTitle("❌ Hatching Cancelled")
                            .setDescription(`Your **${egg.name}** was returned to your inventory.`)
                    ],
                    components: [disabledRow]
                });
            })
            .catch(() => {
                // Disable button after timeout
                replyMsg.edit({ components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`cancel_hatch_${egg.rowid}_${userId}`)
                            .setLabel("Cancel Hatching")
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(true)
                    )
                ] }).catch(() => {});
            });
    });
};
