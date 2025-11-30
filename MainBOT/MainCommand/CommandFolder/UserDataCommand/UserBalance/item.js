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
            (!['.item', '.i'].includes(message.content.split(' ')[0]))
        ) return;

        const userId = message.author.id;

        const restrictions = checkRestrictions(userId);
        if (restrictions.blocked) {
            return message.reply({ embeds: [restrictions.embed] });
        }

        let sentMessage = null;

        try {
            const inventoryData = await getUserInventoryPaginated(userId, ITEMS_PER_PAGE);
            
            console.log(`[ITEMS] Inventory data retrieved:`, {
                hasItems: inventoryData.hasItems,
                totalPages: inventoryData.pages?.length || 0,
                totalItems: inventoryData.totalItems
            });

            if (!inventoryData.hasItems) {
                return message.reply('🤷‍♂️ It appears you do not have any items at the moment.');
            }

            if (!inventoryData.pages || inventoryData.pages.length === 0) {
                console.error(`[ITEMS] No pages generated despite having items!`);
                return message.reply('❌ Error: Failed to load inventory pages.');
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

            sentMessage = await message.channel.send({
                embeds: [embed],
                components: [buttons]
            });

            const collector = sentMessage.createMessageComponentCollector({
                filter: (i) => {
                    const isOwner = i.user.id === userId;
                    const isValidButton = ['prev_page', 'next_page'].some(btn => i.customId.startsWith(btn));
                    return isOwner && isValidButton;
                },
                time: INTERACTION_TIMEOUT
            });

            collector.on('collect', async interaction => {
                
                try {
                    const result = await handleInventoryInteraction(
                        interaction,
                        inventoryData,
                        currentPage,
                        message.author,
                        stats
                    );

                    if (result.success) {
                        currentPage = result.newPage;
                    } else {
                        console.log(`[ITEMS] Page navigation failed`);
                    }
                } catch (error) {
                    console.error('[ITEMS] Error in collector:', error);
                }
            });

            collector.on('end', (collected, reason) => {
                
                sentMessage.edit({ components: [] }).catch(err => {
                    console.error('[ITEMS] Failed to remove buttons:', err.message);
                });
            });

            setTimeout(() => {
                sentMessage.delete().catch(err => {
                    console.error('[ITEMS] Failed to delete message:', err.message);
                });
            }, INTERACTION_TIMEOUT);

        } catch (error) {
            console.error('[ITEMS] Critical error:', error);
            
            const errorMessage = '❌ An error occurred while fetching your items.';
            
            if (sentMessage) {
                try {
                    await sentMessage.edit({
                        content: errorMessage,
                        embeds: [],
                        components: []
                    });
                } catch (editError) {
                    console.error('[ITEMS] Failed to edit message with error:', editError);
                }
            } else {
                try {
                    await message.reply(errorMessage);
                } catch (replyError) {
                    console.error('[ITEMS] Failed to reply with error:', replyError);
                }
            }
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const parts = interaction.customId.split('_');
        const action = parts.slice(0, -1).join('_');
        
        if (!['prev_page', 'next_page'].includes(action)) {
            return;
        }
        
    });
};