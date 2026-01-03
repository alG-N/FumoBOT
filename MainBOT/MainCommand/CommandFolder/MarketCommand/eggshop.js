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

        const embed = await createShopEmbed(userId, eggs);
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
            // Defer immediately to prevent timeout
            try {
                await interaction.deferReply({ ephemeral: true });
            } catch (e) {
                console.error('[EGGSHOP] Failed to defer:', e);
                return;
            }

            if (!verifyButtonOwnership(interaction)) {
                return interaction.editReply({ 
                    content: "This shop was opened by someone else!"
                }).catch(() => {});
            }

            const parts = interaction.customId.split('_');
            const eggIndex = parseInt(parts[2]);

            if (isNaN(eggIndex) || eggIndex < 0 || eggIndex >= eggs.length) {
                return interaction.editReply({ 
                    content: "Invalid egg selected."
                }).catch(() => {});
            }

            try {
                const result = await processPurchase(userId, eggIndex, eggs[eggIndex]);

                if (result.success) {
                    const successEmbed = createPurchaseSuccessEmbed(
                        result.egg,
                        result.remainingCoins,
                        result.remainingGems,
                        result.paidCoins,
                        result.paidGems
                    );
                    
                    await interaction.editReply({ 
                        embeds: [successEmbed]
                    });

                    const updatedButtons = createButtonRows(userId, eggs);
                    sent.edit({ components: updatedButtons }).catch(() => {});
                } else {
                    const errorEmbed = createErrorEmbed(result.error, result.message);
                    await interaction.editReply({ 
                        embeds: [errorEmbed]
                    });
                }
            } catch (error) {
                console.error('[EGGSHOP] Purchase error:', error);
                await interaction.editReply({ 
                    content: '❌ An error occurred while processing your purchase.'
                }).catch(() => {});
            }
        });

        collector.on("end", () => {
            sent.edit({ components: [] }).catch(() => {});
        });
    });
};