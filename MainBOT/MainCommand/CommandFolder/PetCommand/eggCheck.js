const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { EGG_DATA } = require('../../Configuration/petConfig');
const PetDatabase = require('../../Service/PetService/PetDatabaseService');
const PetHatch = require('../../Service/PetService/PetHatchService');
const PetUI = require('../../Service/PetService/PetUIService');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const cmd = message.content.trim().toLowerCase();
        if (message.author.bot || ![".eggcheck", ".ec"].includes(cmd)) return;

        const userId = message.author.id;

        try {
            const eggs = await PetDatabase.getHatchingEggs(userId, false);

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

                await PetDatabase.deleteHatchingEgg(userId, eggId);

                const { pet, chosen, hasAlterGolden } = await PetHatch.hatchEgg(userId, egg.eggName);

                const hatchEmbed = PetUI.createHatchEmbed(pet, chosen, hasAlterGolden);

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
                } catch (e) {}
            });

        } catch (error) {
            console.error("Error in eggcheck:", error);
            return message.reply("An error occurred. Please try again later.");
        }
    });
};