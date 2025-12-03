const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { getFumoOwnershipData } = require('../../Service/FumoDataService/InformService/InformCacheService');
const { getFumoData } = require('../../Service/FumoDataService/InformService/InformDataService');
const { 
    createVariantButtons, 
    createSelectionEmbed, 
    createInformEmbed, 
    createTutorialEmbed, 
    createNotFoundEmbed 
} = require('../../Service/FumoDataService/InformService/InformUIService');

module.exports = (client) => {
    // Handle initial command
    client.on('messageCreate', async message => {
        try {
            if (!/^\.(inform|in)(\s|$)/.test(message.content)) return;

            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const fumoName = message.content.split(' ').slice(1).join(' ').trim();

            if (!fumoName) {
                const tutorialEmbed = createTutorialEmbed();
                return message.reply({ embeds: [tutorialEmbed] });
            }

            const fumoData = getFumoData(fumoName);

            if (!fumoData.found) {
                const notFoundEmbed = createNotFoundEmbed();
                return message.reply({ embeds: [notFoundEmbed] });
            }

            const selectionEmbed = createSelectionEmbed(fumoData.fumo);
            const variantButtons = createVariantButtons(message.author.id);

            const variantMessage = await message.reply({
                embeds: [selectionEmbed],
                components: [variantButtons]
            });

            const collector = variantMessage.createMessageComponentCollector({
                time: 60000
            });

            // THIS IS THE MISSING PART - Handle button clicks
            collector.on('collect', async interaction => {
                try {
                    // Verify ownership
                    const isOwner = await checkButtonOwnership(interaction, null, null, false);
                    if (!isOwner) {
                        return interaction.reply({
                            content: "❌ You can't use someone else's button. Run the command yourself.",
                            ephemeral: true
                        });
                    }

                    // Determine which variant was selected
                    let variant = 'NORMAL';
                    if (interaction.customId.includes('shiny')) {
                        variant = 'SHINY';
                    } else if (interaction.customId.includes('alg')) {
                        variant = 'ALG';
                    }

                    // Get ownership data
                    const ownershipData = await getFumoOwnershipData(
                        message.author.id, 
                        `${fumoData.fumo.name}(${fumoData.fumo.rarity})`
                    );

                    // Create and send the inform embed
                    const informEmbed = createInformEmbed(fumoData, ownershipData, variant);

                    await interaction.update({
                        embeds: [informEmbed],
                        components: []
                    });

                    // Stop the collector since we got a response
                    collector.stop('completed');

                } catch (error) {
                    console.error('[inform] Error handling button interaction:', error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing your selection.',
                            ephemeral: true
                        }).catch(console.error);
                    }
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    variantMessage.edit({
                        content: 'Selection timed out.',
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error(`[inform] Unexpected error:`, error);
        }
    });
};