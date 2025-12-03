const { EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
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

            collector.on('end', collected => {
                if (collected.size === 0) {
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