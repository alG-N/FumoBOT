const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../Core/Database/dbSetting');
const { EGG_DATA } = require('../../Configuration/petConfig');
const PetDatabase = require('../../Service/PetService/PetDatabaseService');
const PetHatch = require('../../Service/PetService/PetHatchService');

module.exports = async (client) => {
    client.on("messageCreate", async message => {
        const content = message.content.trim().toLowerCase();
        const cmd = content.split(" ")[0];
        
        if (message.author.bot) return;
        if (cmd !== ".useegg") return;

        const userId = message.author.id;
        const args = message.content.split(" ").slice(1);

        try {
            const eggName = args[0];
            if (!eggName || !EGG_DATA[eggName]) {
                const available = Object.keys(EGG_DATA).map(e => `\`${e}\``).join(", ");
                return message.reply(`❌ Please specify a valid egg: ${available}.\nUse \`.eggcheck\` to see your eggs.`);
            }

            const hatching = await PetDatabase.getHatchingEggs(userId, false);
            if (hatching.length >= 5) {
                return message.reply("❌ You can only incubate up to 5 eggs at once. Use `.eggcheck` to manage them.");
            }

            const eggs = await PetDatabase.getUserEggs(userId, false);
            const hasEgg = eggs.find(e => e.name === eggName);
            if (!hasEgg || hasEgg.count < 1) {
                return message.reply(`❌ You don't have any ${eggName} to hatch. Use \`.eggcheck\` to view your eggs.`);
            }

            const { startedAt, hatchAt } = await PetHatch.startHatching(userId, eggName);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel_hatch_${startedAt}_${userId}`)
                    .setLabel("Cancel Hatching")
                    .setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle(`${EGG_DATA[eggName].emoji} Egg Hatching Started!`)
                .setDescription(`You placed a **${eggName}** (${EGG_DATA[eggName].rarity}) into the incubator.\nIt will hatch <t:${Math.floor(hatchAt / 1000)}:R>.`)
                .setFooter({ text: "Use .eggcheck to monitor progress." });

            const replyMsg = await message.reply({ embeds: [embed], components: [row] });

            const filter = i => i.customId === `cancel_hatch_${startedAt}_${userId}` && i.user.id === userId;
            
            replyMsg.awaitMessageComponent({ 
                filter, 
                componentType: ComponentType.Button, 
                time: 60_000 
            }).then(async interaction => {
                await handleCancelHatch(interaction, userId, eggName, hatchAt, startedAt);
            }).catch(() => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`cancel_hatch_${startedAt}_${userId}`)
                        .setLabel("Cancel Hatching")
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
                replyMsg.edit({ components: [disabledRow] }).catch(() => {});
            });

        } catch (error) {
            console.error("Error in eggOpen:", error);
            return message.reply("An error occurred. Please try again later.");
        }
    });
};

async function handleCancelHatch(interaction, userId, eggName, hatchAt, timestamp) {
    // Defer immediately to prevent timeout during DB queries
    await interaction.deferUpdate();

    const hatching = await PetDatabase.getHatchingEggs(userId, false);
    const egg = hatching.find(e => e.eggName === eggName && Math.abs(e.hatchAt - hatchAt) < 1000);
    
    if (!egg) {
        return interaction.editReply({
            content: "❌ Could not find this egg in your incubator.",
            embeds: [],
            components: []
        });
    }

    await PetHatch.cancelHatching(userId, egg.id, eggName);

    const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cancel_hatch_${timestamp}_${userId}`)
            .setLabel("Cancel Hatching")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(true)
    );

    await interaction.editReply({
        embeds: [
            new EmbedBuilder()
                .setColor("#FF9900")
                .setTitle("❌ Hatching Cancelled")
                .setDescription(`Your **${eggName}** was returned to your inventory.`)
        ],
        components: [disabledRow]
    });
}