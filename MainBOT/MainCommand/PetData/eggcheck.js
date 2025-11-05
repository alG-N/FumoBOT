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
const { v4: uuidv4 } = require('uuid');
module.exports = async (client) => {
    client.on("messageCreate", async message => {
        if (
            message.author.bot ||
            ![".eggcheck", ".ec"].includes(message.content.trim().toLowerCase())
        ) return;

        const userId = message.author.id;

        // Check for maintenance mode or ban
        let banData;
        try {
            banData = await isBanned(message.author.id);
        } catch (e) {
            console.error("Error checking ban:", e);
            return message.reply("An error occurred while checking your ban status. Please try again later.");
        }

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
                    if (remaining > 0) {
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

        let eggs;
        try {
            eggs = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM hatchingEggs WHERE userId = ?`, [userId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        } catch (e) {
            console.error("DB error:", e);
            return message.reply("An error occurred while fetching your eggs. Please try again later.");
        }

        if (!eggs || eggs.length === 0)
            return message.reply("You aren't hatching any eggs right now.");

        const embed = new EmbedBuilder()
            .setTitle("🧪 Your Incubating Eggs")
            .setColor("#FFD700")
            .setFooter({ text: "Click the buttons to hatch when ready!" })
            .setTimestamp();

        const buttons = eggs.map(egg => {
            const ready = egg.hatchAt <= Date.now();
            embed.addFields({
                name: `🥚 ${egg.eggName}`,
                value: ready
                    ? `✅ Ready to hatch!`
                    : `⏳ Hatches <t:${Math.floor(egg.hatchAt / 1000)}:R>`,
                inline: false
            });

            return new ButtonBuilder()
                .setCustomId(`hatch_${egg.id}_${userId}`)
                .setLabel(ready ? "Hatch Now!" : "Not Ready")
                .setStyle(ready ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!ready);
        });

        // Only 5 buttons per ActionRow allowed
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }

        let reply;
        try {
            reply = await message.reply({ embeds: [embed], components: rows });
        } catch (e) {
            console.error("Failed to send reply:", e);
            return;
        }

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 2 * 60 * 1000
        });

        collector.on("collect", async interaction => {
            const [_, eggIdStr, btnUserId] = interaction.customId.split("_");
            const eggId = parseInt(eggIdStr);

            if (interaction.user.id !== btnUserId)
                return interaction.reply({ content: "This incubator isn't yours.", ephemeral: true });

            let egg;
            try {
                egg = await new Promise((resolve, reject) => {
                    db.get(`SELECT * FROM hatchingEggs WHERE id = ?`, [eggId], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
            } catch (e) {
                console.error("DB error:", e);
                return interaction.reply({ content: "An error occurred while fetching your egg.", ephemeral: true });
            }

            if (!egg)
                return interaction.reply({ content: "This egg is no longer in your incubator.", ephemeral: true });

            if (Date.now() < egg.hatchAt)
                return interaction.reply({ content: "This egg isn't ready yet!", ephemeral: true });

            // Remove from hatchingEggs
            db.run(`DELETE FROM hatchingEggs WHERE id = ?`, [eggId], (err) => {
                if (err) console.error("Failed to delete egg:", err);
            });

            const gacha = {
                CommonEgg: [
                    { name: "Dog", rarity: "Common", chance: 33 },
                    { name: "Bunny", rarity: "Common", chance: 33 },
                    { name: "Cat", rarity: "Common", chance: 34 }
                ],
                RareEgg: [
                    { name: "Monkey", rarity: "Rare", chance: 45 },
                    { name: "Bear", rarity: "Rare", chance: 30 },
                    { name: "Pig", rarity: "Epic", chance: 15 },
                    { name: "Chicken", rarity: "Legendary", chance: 6 },
                    { name: "Owl", rarity: "Mythical", chance: 4 } // Done?
                ],
                DivineEgg: [
                    { name: "SilverMonkey", rarity: "Legendary", chance: 50 },
                    { name: "PolarBear", rarity: "Legendary", chance: 45 },
                    { name: "NightOwl", rarity: "Mythical", chance: 4 },
                    { name: "Butterfly", rarity: "Mythical", chance: 0.8 },
                    { name: "GoldenLab", rarity: "Divine", chance: 0.2 }
                ]
            };

            function pickRandomPet(eggType) {
                const pool = gacha[eggType];
                if (!pool) return { name: "Unknown", rarity: "Common", chance: 100 };
                const roll = Math.random() * 100;
                let cumulative = 0;
                for (const pet of pool) {
                    cumulative += pet.chance;
                    if (roll <= cumulative) return pet;
                }
                return pool[pool.length - 1];
            }

            function getRandomWeight() {
                const roll = Math.random();
                if (roll <= 0.95) return +(Math.random() * 3.9 + 0.1).toFixed(2);
                if (roll <= 0.99) return +(Math.random() * 30 + 5).toFixed(2);
                return +(Math.random() * 14 + 36).toFixed(2);
            }

            function getRandomQuality() {
                return +(Math.random() * 4 + 1).toFixed(2);
            }

            const chosen = pickRandomPet(egg.eggName);
            const weight = getRandomWeight();
            const quality = getRandomQuality();
            const timestamp = Date.now();
            const petId = uuidv4();

            // Max hunger values by rarity (e.g., 100 per hour)
            const hungerMaxMap = {
                Common: 1500,
                Rare: 1800,
                Epic: 2160,
                Legendary: 2880,
                Mythical: 3600,
                Divine: 4320
            };

            const maxHunger = hungerMaxMap[chosen.rarity] || 1200;

            db.run(`
                INSERT INTO petInventory (
                    petId, userId, type, name, rarity, weight, age, quality,
                    timestamp, level, hunger, ageXp, lastHungerUpdate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                petId,
                userId,
                "pet",
                chosen.name,
                chosen.rarity,
                weight,
                1,                // age
                quality,
                timestamp,
                1,                // level
                maxHunger,        // hunger
                0,                // ageXp
                Math.floor(timestamp / 1000)
            ], (err) => {
                if (err) {
                    console.error("❌ Failed to insert new pet:", err);
                } else {
                    console.log(`✅ Pet hatched: ${petId} (${chosen.rarity} ${chosen.name})`);
                }
            });

            const rarityColors = {
                Common: 0xA0A0A0,
                Rare: 0x3498DB,
                Epic: 0x9B59B6,
                Legendary: 0xE67E22,
                Mythical: 0xE91E63,
                Divine: 0xFFD700
            };

            const hatchEmbed = new EmbedBuilder()
                .setTitle(`🎉 Egg Hatched!`)
                .setColor(rarityColors[chosen.rarity] || 0xFFFFFF)
                .addFields(
                    { name: "Pet:", value: `${chosen.name} - **${chosen.rarity}**`, inline: false },
                    { name: "Weight", value: `**${weight} kg**`, inline: true },
                    { name: "⭐ Quality", value: `**${quality} / 5**`, inline: true },
                    { name: "🔢 ID", value: `\`${petId}\``, inline: false }
                )
                .setFooter({ text: `Take good care of your new pet!` })
                .setTimestamp();

            await interaction.reply({ embeds: [hatchEmbed], ephemeral: true });
        });

        collector.on("end", async () => {
            const disabledRows = rows.map(row => {
                return new ActionRowBuilder().addComponents(
                    row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
                );
            });

            try {
                await reply.edit({ components: disabledRows });
            } catch (e) {
                // Message may have been deleted or already edited
            }
        });
    });
};

