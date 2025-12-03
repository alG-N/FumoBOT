const { checkRestrictions } = require('../../Middleware/restrictions');
const { getUserCraftData } = require('../../Service/CraftService/CraftCacheService');
const { getAllRecipes } = require('../../Service/CraftService/CraftRecipeService');
const { validateFullCraft } = require('../../Service/CraftService/CraftValidationService');
const { processCraft, getQueueItems, claimQueuedCraft, claimAllReady } = require('../../Service/CraftService/CraftProcessService');
const { parseCraftCommand } = require('../../Ultility/craftParser');
const { all } = require('../../Core/database');
const { CRAFT_CATEGORIES, CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const { checkButtonOwnership, parseCustomId } = require('../../Middleware/buttonOwnership');
const {
    createCraftableItemsEmbed,
    createCraftButtons,
    createAmountModal,
    createConfirmButtons,
    createConfirmEmbed,
    createQueueEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createHistoryEmbed
} = require('../../Service/CraftService/CraftUIService');

module.exports = (client) => {
    // Main command handler
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (message.content !== '.itemCraft' && !message.content.startsWith('.itemCraft ') &&
                message.content !== '.ic' && !message.content.startsWith('.ic ')) return;

            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const args = message.content.split(' ').slice(1);
            const parsed = parseCraftCommand(args);
            const userId = message.author.id;

            // Show craft history
            if (parsed.type === 'HISTORY') {
                const history = await all(
                    `SELECT itemName, amount, craftedAt FROM craftHistory WHERE userId = ? AND craftType = ? ORDER BY craftedAt DESC LIMIT ?`,
                    [userId, 'item', CRAFT_CONFIG.HISTORY_LIMIT]
                );
                const embed = createHistoryEmbed(history, 'item');
                return message.reply({ embeds: [embed] });
            }

            // Show crafting menu
            if (parsed.type === 'MENU') {
                const userData = await getUserCraftData(userId, 'item');
                const recipes = getAllRecipes('item');
                const pages = CRAFT_CATEGORIES.ITEM.tiers;
                let currentPage = 0;
                let currentStartIndex = 0;

                const getPageData = () => {
                    const result = createCraftableItemsEmbed('item', pages[currentPage], recipes, userData);
                    return result;
                };

                const updateMessage = async () => {
                    const pageData = getPageData();
                    
                    if (pages[currentPage] === 'How to Craft') {
                        const navigationRow = require('discord.js').ActionRowBuilder;
                        const navigationButton = require('discord.js').ButtonBuilder;
                        const ButtonStyle = require('discord.js').ButtonStyle;
                        
                        const navRow = new navigationRow().addComponents(
                            new navigationButton()
                                .setCustomId(`craft_page_prev_${userId}`)
                                .setLabel('◀ Previous')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(currentPage === 0),
                            new navigationButton()
                                .setCustomId(`craft_page_next_${userId}`)
                                .setLabel('Next ▶')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(currentPage === pages.length - 1)
                        );
                        
                        return { embeds: [pageData.embed], components: [navRow] };
                    }

                    const buttons = createCraftButtons(userId, pageData.items, currentStartIndex);
                    
                    const navigationRow = require('discord.js').ActionRowBuilder;
                    const navigationButton = require('discord.js').ButtonBuilder;
                    const ButtonStyle = require('discord.js').ButtonStyle;
                    
                    const pageNavRow = new navigationRow().addComponents(
                        new navigationButton()
                            .setCustomId(`craft_page_prev_${userId}`)
                            .setLabel('◀ Prev Category')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 0),
                        new navigationButton()
                            .setCustomId(`craft_page_next_${userId}`)
                            .setLabel('Next Category ▶')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === pages.length - 1)
                    );
                    
                    return { 
                        embeds: [pageData.embed], 
                        components: [...buttons, pageNavRow] 
                    };
                };

                const sent = await message.reply(await updateMessage());

                // Button collector
                const collector = sent.createMessageComponentCollector({
                    filter: i => i.user.id === userId,
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async interaction => {
                    const { action, additionalData } = parseCustomId(interaction.customId);

                    // Page navigation
                    if (action === 'craft_page_next') {
                        currentPage = Math.min(currentPage + 1, pages.length - 1);
                        currentStartIndex = 0;
                        await interaction.update(await updateMessage());
                        return;
                    }

                    if (action === 'craft_page_prev') {
                        currentPage = Math.max(currentPage - 1, 0);
                        currentStartIndex = 0;
                        await interaction.update(await updateMessage());
                        return;
                    }

                    // Item list navigation
                    if (action === 'craft_next') {
                        currentStartIndex += 10;
                        await interaction.update(await updateMessage());
                        return;
                    }

                    if (action === 'craft_prev') {
                        currentStartIndex = Math.max(0, currentStartIndex - 10);
                        await interaction.update(await updateMessage());
                        return;
                    }

                    // View queue
                    if (action === 'craft_queue_view') {
                        const queueItems = await getQueueItems(userId);
                        const queueData = createQueueEmbed(queueItems, { userId });
                        await interaction.reply({ 
                            embeds: [queueData.embed], 
                            components: queueData.buttons, 
                            ephemeral: true 
                        });
                        return;
                    }

                    // Item selection
                    if (action === 'craft_item') {
                        const itemName = additionalData?.item;
                        if (!itemName) return;

                        const updatedUserData = await getUserCraftData(userId, 'item');
                        const validation = validateFullCraft(itemName, 1, 'item', updatedUserData);
                        
                        if (!validation.valid) {
                            const errorEmbed = createErrorEmbed(validation.error, {
                                ...validation,
                                itemName,
                                max: CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                            });
                            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                            return;
                        }

                        // Show amount modal
                        const maxCraftable = Math.min(
                            require('../../Service/CraftService/CraftValidationService').calculateMaxCraftable(
                                validation.recipe,
                                updatedUserData.inventory,
                                updatedUserData.coins,
                                updatedUserData.gems
                            ),
                            CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                        );

                        const modal = createAmountModal(itemName, userId, maxCraftable);
                        
                        // Store item data for modal submission
                        client.craftModalData = client.craftModalData || new Map();
                        client.craftModalData.set(userId, { 
                            itemName, 
                            maxCraftable,
                            recipe: validation.recipe 
                        });
                        
                        await interaction.showModal(modal);
                        return;
                    }
                });

                collector.on('end', () => {
                    sent.edit({ components: [] }).catch(() => {});
                });

                return;
            }

        } catch (err) {
            console.error('[itemCraft] Error:', err);
            message.reply('❌ An error occurred. Please try again later.');
        }
    });

    // Modal submission handler
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isModalSubmit()) return;
            if (!interaction.customId.startsWith('craft_amount_')) return;

            const userId = interaction.user.id;
            const modalData = client.craftModalData?.get(userId);
            
            if (!modalData) {
                await interaction.reply({ 
                    content: '❌ Session expired. Please try again.', 
                    ephemeral: true 
                });
                return;
            }

            const amount = parseInt(interaction.fields.getTextInputValue('amount'));
            
            if (isNaN(amount) || amount < 1 || amount > modalData.maxCraftable) {
                await interaction.reply({ 
                    content: `❌ Invalid amount. Please enter 1-${modalData.maxCraftable}`, 
                    ephemeral: true 
                });
                return;
            }

            // Get fresh user data
            const userData = await getUserCraftData(userId, 'item');
            const validation = validateFullCraft(modalData.itemName, amount, 'item', userData);
            
            if (!validation.valid) {
                const errorEmbed = createErrorEmbed(validation.error, {
                    ...validation,
                    itemName: modalData.itemName,
                    max: CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                });
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                return;
            }

            // Show confirmation
            const confirmEmbed = createConfirmEmbed(
                modalData.itemName,
                amount,
                validation.recipe,
                validation.totalCoins,
                validation.totalGems,
                userData,
                'item'
            );

            const confirmButtons = createConfirmButtons(userId, modalData.itemName, amount);

            // Store craft data
            client.craftConfirmData = client.craftConfirmData || new Map();
            client.craftConfirmData.set(userId, {
                itemName: modalData.itemName,
                amount,
                recipe: validation.recipe,
                totalCoins: validation.totalCoins,
                totalGems: validation.totalGems
            });

            await interaction.reply({ 
                embeds: [confirmEmbed], 
                components: [confirmButtons],
                ephemeral: true 
            });

        } catch (err) {
            console.error('[craftModal] Error:', err);
            await interaction.reply({ 
                content: '❌ An error occurred.', 
                ephemeral: true 
            }).catch(() => {});
        }
    });

    // Button handler for confirm/cancel/claim
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isButton()) return;
            
            const { action, additionalData } = parseCustomId(interaction.customId);
            const userId = interaction.user.id;

            // Confirm craft
            if (action === 'craft_confirm') {
                if (!checkButtonOwnership(interaction, 'craft_confirm', null, false)) {
                    await interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                    return;
                }

                const craftData = client.craftConfirmData?.get(userId);
                if (!craftData) {
                    await interaction.reply({ 
                        content: '❌ Session expired.', 
                        ephemeral: true 
                    });
                    return;
                }

                try {
                    const result = await processCraft(
                        userId,
                        craftData.itemName,
                        craftData.amount,
                        'item',
                        craftData.recipe,
                        craftData.totalCoins,
                        craftData.totalGems
                    );

                    const successEmbed = createSuccessEmbed(
                        craftData.itemName,
                        craftData.amount,
                        result.queued,
                        result
                    );

                    await interaction.update({ 
                        embeds: [successEmbed], 
                        components: [] 
                    });

                    client.craftConfirmData.delete(userId);
                    client.craftModalData?.delete(userId);

                } catch (error) {
                    const errorEmbed = createErrorEmbed(
                        error.message === 'QUEUE_FULL' ? 'QUEUE_FULL' : 'UNKNOWN',
                        { error: error.message }
                    );
                    await interaction.update({ embeds: [errorEmbed], components: [] });
                }
                return;
            }

            // Cancel craft
            if (action === 'craft_cancel') {
                client.craftConfirmData?.delete(userId);
                client.craftModalData?.delete(userId);
                await interaction.update({ 
                    content: '❌ Crafting cancelled.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }

            // Claim item
            if (action === 'craft_claim') {
                const queueId = additionalData?.id;
                if (!queueId) return;

                try {
                    const claimed = await claimQueuedCraft(queueId, userId);
                    await interaction.reply({ 
                        content: `✅ Claimed **${claimed.amount}x ${claimed.itemName}**!`, 
                        ephemeral: true 
                    });
                    
                    // Refresh queue view if exists
                    const queueItems = await getQueueItems(userId);
                    const queueData = createQueueEmbed(queueItems, { userId });
                    
                    if (interaction.message) {
                        await interaction.message.edit({
                            embeds: [queueData.embed],
                            components: queueData.buttons
                        }).catch(() => {});
                    }
                } catch (error) {
                    await interaction.reply({ 
                        content: '❌ Failed to claim item. It may have already been claimed.', 
                        ephemeral: true 
                    });
                }
                return;
            }

            // Refresh queue
            if (action === 'craft_queue_refresh') {
                const queueItems = await getQueueItems(userId);
                const queueData = createQueueEmbed(queueItems, { userId });
                await interaction.update({ 
                    embeds: [queueData.embed], 
                    components: queueData.buttons 
                });
                return;
            }

            // Back to crafting
            if (action === 'craft_back') {
                await interaction.update({ 
                    content: 'Use `.itemCraft` or `.ic` to open the crafting menu again.', 
                    embeds: [], 
                    components: [] 
                });
                return;
            }

        } catch (err) {
            console.error('[craftButtons] Error:', err);
            await interaction.reply({ 
                content: '❌ An error occurred.', 
                ephemeral: true 
            }).catch(() => {});
        }
    });
};