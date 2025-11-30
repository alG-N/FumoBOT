const { ComponentType } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { getGlobalShop } = require('../../Service/MarketService/EggShopService/EggShopCacheService');
const { processPurchase } = require('../../Service/MarketService/EggShopService/EggShopPurchaseService');
const { 
    createShopEmbed, 
    createButtonRows, 
    createPurchaseSuccessEmbed,
    createErrorEmbed 
} = require('../../Service/MarketService/EggShopService/EggShopUIService');
const { INTERACTION_TIMEOUT } = require('../../Configuration/eggConfig');
const { verifyButtonOwnership } = require('../../Middleware/buttonOwnership');

module.exports = async (client) => {
    client.on("messageCreate", async (message) => {
        if (message.author.bot) return;
        
        const content = message.content.trim().toLowerCase();
        if (![".eggshop", ".es"].includes(content)) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;
        const { eggs } = getGlobalShop();

        const embed = createShopEmbed(userId, eggs);
        const buttonRows = createButtonRows(userId, eggs);

        const sent = await message.reply({ 
            embeds: [embed], 
            components: buttonRows
        });

        const collector = sent.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: INTERACTION_TIMEOUT
        });

        collector.on("collect", async (interaction) => {
            if (!verifyButtonOwnership(interaction)) {
                return interaction.reply({ 
                    content: "This shop was opened by someone else!", 
                    ephemeral: true 
                });
            }

            const parts = interaction.customId.split('_');
            const eggIndex = parseInt(parts[2]);

            if (isNaN(eggIndex) || eggIndex < 0 || eggIndex >= eggs.length) {
                return interaction.reply({ 
                    content: "Invalid egg selected.", 
                    ephemeral: true 
                });
            }

            const result = await processPurchase(userId, eggIndex, eggs[eggIndex]);

            if (result.success) {
                const successEmbed = createPurchaseSuccessEmbed(
                    result.egg,
                    result.remainingCoins,
                    result.remainingGems
                );
                
                await interaction.reply({ 
                    embeds: [successEmbed], 
                    ephemeral: true 
                });

                const updatedButtons = createButtonRows(userId, eggs);
                sent.edit({ components: updatedButtons }).catch(() => {});
            } else {
                const errorEmbed = createErrorEmbed(result.error, result.message);
                await interaction.reply({ 
                    embeds: [errorEmbed], 
                    ephemeral: true 
                });
            }
        });

        collector.on("end", () => {
            sent.edit({ components: [] }).catch(() => {});
        });
    });
};