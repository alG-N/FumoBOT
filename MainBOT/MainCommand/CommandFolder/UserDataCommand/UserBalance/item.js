const { checkRestrictions } = require('../../../Middleware/restrictions');
const { createInventoryEmbed, createInventoryButtons } = require('../../../Service/UserDataService/ItemService/ItemUIService');
const { getUserInventoryPaginated, getInventoryStats } = require('../../../Service/UserDataService/ItemService/ItemQueryService');
const { handleInventoryInteraction } = require('../../../Service/UserDataService/ItemService/ItemInteractionService');
const { debugLog } = require('../../../Core/logger');

const ITEMS_PER_PAGE = 2;
const INTERACTION_TIMEOUT = 300000;

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (
            message.author.bot ||
            (!['.items', '.i'].includes(message.content.split(' ')[0]))
        ) return;

        const userId = message.author.id;
        debugLog('INVENTORY', `Processing inventory request for user ${userId}`);

        const restrictions = checkRestrictions(userId);
        if (restrictions.blocked) {
            return message.reply({ embeds: [restrictions.embed] });
        }

        try {
            const inventoryData = await getUserInventoryPaginated(userId, ITEMS_PER_PAGE);
            
            if (!inventoryData.hasItems) {
                return message.reply('🤷‍♂️ It appears you do not have any items at the moment.');
            }

            const stats = await getInventoryStats(userId);

            let currentPage = 0;
            const totalPages = inventoryData.pages.length;

            const embed = createInventoryEmbed(
                message.author,
                inventoryData.pages[currentPage],
                stats,
                currentPage,
                totalPages
            );

            const buttons = createInventoryButtons(userId, currentPage, totalPages);

            const sentMessage = await message.channel.send({
                embeds: [embed],
                components: [buttons]
            });

            const collector = sentMessage.createMessageComponentCollector({
                filter: (i) => i.user.id === userId && ['prev_page', 'next_page'].includes(i.customId),
                time: INTERACTION_TIMEOUT
            });

            collector.on('collect', async interaction => {
                const result = await handleInventoryInteraction(
                    interaction,
                    inventoryData,
                    currentPage,
                    message.author,
                    stats
                );

                if (result.success) {
                    currentPage = result.newPage;
                }
            });

            collector.on('end', () => {
                sentMessage.edit({ components: [] }).catch(() => {});
            });

            setTimeout(() => {
                sentMessage.delete().catch(() => {});
            }, INTERACTION_TIMEOUT);

        } catch (error) {
            console.error('[INVENTORY ERROR]', error);
            return message.reply('❌ An error occurred while fetching your items.');
        }
    });
};