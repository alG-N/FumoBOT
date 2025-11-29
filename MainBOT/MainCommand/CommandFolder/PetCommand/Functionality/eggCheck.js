const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const db = require('../../Core/Database/db');
const { EGG_POOLS, RARITY_COLORS } = require('../Configuration/petConfig');
const { pickRandomPet, getRandomWeight, getRandomQuality, getMaxHunger, generatePetName, hasAlterGoldenBonus } = require('../Utilities/petUtils');
const { getHatchingEggs, deleteHatchingEgg } = require('../Utilities/dbUtils');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const cmd = message.content.trim().toLowerCase();
        if (message.author.bot || ![".eggcheck", ".ec"].includes(cmd)) return;

        const userId = message.author.id;

        try {
            const eggs = await getHatchingEggs(db, userId);

            if (eggs.length === 0) {
                return message.reply("You aren't hatching any eggs right now.");
            }

            const embed = new EmbedBuilder()
                .setTitle("🧪 Your Incubating Eggs")
                .setColor("#FFD700")
                .setFooter({ text: "Click the buttons to hatch when ready!" })
                .setTimestamp();

            const buttons = eggs.map(egg => {
                const ready = egg.hatchAt <= Date.now();
                embed.addFields({
                    name: `🥚 ${egg.eggName}`,
                    value: ready ? `✅ Ready to hatch!` : `⏳ Hatches <t:${Math.floor(egg.hatchAt / 1000)}:R>`,
                    inline: false
                });

                return new ButtonBuilder()
                    .setCustomId(`hatch_${egg.id}_${userId}`)
                    .setLabel(ready ? "Hatch Now!" : "Not Ready")
                    .setStyle(ready ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(!ready);
            });

            const rows = [];
            for (let i = 0; i < buttons.length; i += 5) {
                rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
            }

            const reply = await message.reply({ embeds: [embed], components: rows });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 2 * 60 * 1000
            });

            collector.on("collect", async interaction => {
                const [_, eggIdStr, btnUserId] = interaction.customId.split("_");
                const eggId = parseInt(eggIdStr);

                if (interaction.user.id !== btnUserId) {
                    return interaction.reply({ content: "This incubator isn't yours.", ephemeral: true });
                }

                const egg = await new Promise((res, rej) => {
                    db.get(`SELECT * FROM hatchingEggs WHERE id = ?`, [eggId], (err, row) => 
                        err ? rej(err) : res(row)
                    );
                });

                if (!egg) {
                    return interaction.reply({ content: "This egg is no longer in your incubator.", ephemeral: true });
                }

                if (Date.now() < egg.hatchAt) {
                    return interaction.reply({ content: "This egg isn't ready yet!", ephemeral: true });
                }

                await deleteHatchingEgg(db, eggId);

                const chosen = pickRandomPet(egg.eggName, EGG_POOLS);
                const weight = getRandomWeight();
                const quality = getRandomQuality();
                const petName = generatePetName(); // Generate random name
                const timestamp = Date.now();
                const petId = uuidv4();
                const maxHunger = getMaxHunger(chosen.rarity);

                // Apply alterGolden bonus if applicable
                let finalWeight = weight;
                let finalQuality = quality;
                
                if (hasAlterGoldenBonus(petName)) {
                    finalWeight = weight * 2;
                    finalQuality = Math.min(quality * 2, 5);
                }

                await new Promise((res, rej) => {
                    db.run(`
                        INSERT INTO petInventory (
                            petId, userId, type, name, petName, rarity, weight, age, quality,
                            timestamp, level, hunger, ageXp, lastHungerUpdate
                        ) VALUES (?, ?, 'pet', ?, ?, ?, ?, 1, ?, ?, 1, ?, 0, ?)
                    `, [petId, userId, chosen.name, petName, chosen.rarity, finalWeight, finalQuality, 
                        timestamp, maxHunger, Math.floor(timestamp / 1000)], 
                        err => err ? rej(err) : res()
                    );
                });

                const hatchEmbed = new EmbedBuilder()
                    .setTitle(`🎉 Egg Hatched!`)
                    .setColor(RARITY_COLORS[chosen.rarity] || 0xFFFFFF)
                    .addFields(
                        { name: "Pet:", value: `${chosen.name} - **${chosen.rarity}**`, inline: false },
                        { name: "🏷️ Name:", value: `**${petName}**${hasAlterGoldenBonus(petName) ? ' ✨ (alterGolden Bonus!)' : ''}`, inline: false },
                        { name: "Weight", value: `**${finalWeight.toFixed(2)} kg**${hasAlterGoldenBonus(petName) ? ' (x2)' : ''}`, inline: true },
                        { name: "⭐ Quality", value: `**${finalQuality.toFixed(2)} / 5**${hasAlterGoldenBonus(petName) ? ' (x2)' : ''}`, inline: true }
                    )
                    .setFooter({ text: `Take good care of ${petName}!` })
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
                    // Message deleted or already edited
                }
            });

        } catch (error) {
            console.error("Error in eggcheck:", error);
            return message.reply("An error occurred. Please try again later.");
        }
    });
};