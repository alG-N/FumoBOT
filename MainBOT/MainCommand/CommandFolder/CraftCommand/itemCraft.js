const { checkRestrictions } = require('../../Middleware/restrictions');
const { getUserCraftData } = require('../../Service/CraftService/CraftCacheService');
const { getAllRecipes } = require('../../Service/CraftService/CraftRecipeService');
const { validateFullCraft } = require('../../Service/CraftService/CraftValidationService');
const { processCraft, getQueueItems, claimQueuedCraft } = require('../../Service/CraftService/CraftProcessService');
const { CRAFT_CATEGORIES, CRAFT_CONFIG } = require('../../Configuration/craftConfig');
const { checkButtonOwnership, parseCustomId } = require('../../Middleware/buttonOwnership');
const {
    createCraftCategoryEmbed,
    createCraftNavigationButtons,
    createCraftItemSelectMenu,
    createAmountModal,
    createConfirmButtons,
    createConfirmEmbed,
    createQueueEmbed,
    createSuccessEmbed,
    createErrorEmbed
} = require('../../Service/CraftService/CraftUIService');

module.exports = (client) => {
    // Button handler for menu navigation
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isButton()) return;
            
            const { action, additionalData } = parseCustomId(interaction.customId);
            const userId = interaction.user.id;

            // Main menu - Item category selected
            if (action === 'craft_menu_item') {
                if (!checkButtonOwnership(interaction, 'craft_menu_item', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const userData = await getUserCraftData(userId, 'item');
                const recipes = getAllRecipes('item');
                const pages = CRAFT_CATEGORIES.ITEM.tiers;
                const currentPage = 0;

                const pageData = createCraftCategoryEmbed('item', currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, 'item', currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, 'item', pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Main menu - Potion category selected
            if (action === 'craft_menu_potion') {
                if (!checkButtonOwnership(interaction, 'craft_menu_potion', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const userData = await getUserCraftData(userId, 'potion');
                const recipes = getAllRecipes('potion');
                const pages = CRAFT_CATEGORIES.POTION.categories;
                const currentPage = 0;

                const pageData = createCraftCategoryEmbed('potion', currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, 'potion', currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, 'potion', pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Main menu - Queue selected
            if (action === 'craft_menu_queue') {
                if (!checkButtonOwnership(interaction, 'craft_menu_queue', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const queueItems = await getQueueItems(userId);
                const queueData = createQueueEmbed(queueItems, userId);

                await interaction.update({
                    embeds: [queueData.embed],
                    components: queueData.buttons
                });
                return;
            }

            // Navigation - First page
            if (action === 'craft_nav_first') {
                if (!checkButtonOwnership(interaction, 'craft_nav_first', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const craftType = additionalData?.type || 'item';
                const userData = await getUserCraftData(userId, craftType);
                const recipes = getAllRecipes(craftType);
                const pages = craftType === 'item' 
                    ? CRAFT_CATEGORIES.ITEM.tiers 
                    : CRAFT_CATEGORIES.POTION.categories;
                const currentPage = 0;

                const pageData = createCraftCategoryEmbed(craftType, currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, craftType, currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, craftType, pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Navigation - Previous page
            if (action === 'craft_nav_prev') {
                if (!checkButtonOwnership(interaction, 'craft_nav_prev', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const craftType = additionalData?.type || 'item';
                const userData = await getUserCraftData(userId, craftType);
                const recipes = getAllRecipes(craftType);
                const pages = craftType === 'item' 
                    ? CRAFT_CATEGORIES.ITEM.tiers 
                    : CRAFT_CATEGORIES.POTION.categories;
                
                // Extract current page from embed footer
                const currentPageMatch = interaction.message.embeds[0]?.footer?.text?.match(/Page (\d+)\//);
                const currentPage = currentPageMatch ? Math.max(0, parseInt(currentPageMatch[1]) - 2) : 0;

                const pageData = createCraftCategoryEmbed(craftType, currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, craftType, currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, craftType, pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Navigation - Next page
            if (action === 'craft_nav_next') {
                if (!checkButtonOwnership(interaction, 'craft_nav_next', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const craftType = additionalData?.type || 'item';
                const userData = await getUserCraftData(userId, craftType);
                const recipes = getAllRecipes(craftType);
                const pages = craftType === 'item' 
                    ? CRAFT_CATEGORIES.ITEM.tiers 
                    : CRAFT_CATEGORIES.POTION.categories;
                
                // Extract current page from embed footer
                const currentPageMatch = interaction.message.embeds[0]?.footer?.text?.match(/Page (\d+)\//);
                const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;

                const pageData = createCraftCategoryEmbed(craftType, currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, craftType, currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, craftType, pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Navigation - Last page
            if (action === 'craft_nav_last') {
                if (!checkButtonOwnership(interaction, 'craft_nav_last', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const craftType = additionalData?.type || 'item';
                const userData = await getUserCraftData(userId, craftType);
                const recipes = getAllRecipes(craftType);
                const pages = craftType === 'item' 
                    ? CRAFT_CATEGORIES.ITEM.tiers 
                    : CRAFT_CATEGORIES.POTION.categories;
                const currentPage = pages.length - 1;

                const pageData = createCraftCategoryEmbed(craftType, currentPage, recipes, userData);
                const navButtons = createCraftNavigationButtons(userId, craftType, currentPage, pages.length, userData.queue.length);
                const selectMenu = createCraftItemSelectMenu(userId, craftType, pageData.items);

                const components = [...navButtons];
                if (selectMenu) components.push(selectMenu);

                await interaction.update({
                    embeds: [pageData.embed],
                    components
                });
                return;
            }

            // Navigation - Return to main menu
            if (action === 'craft_nav_return') {
                if (!checkButtonOwnership(interaction, 'craft_nav_return', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                const { buildSecureCustomId } = require('../../Middleware/buttonOwnership');

                const embed = new EmbedBuilder()
                    .setTitle('🛠️ Crafting Menu')
                    .setDescription(
                        '**Welcome to the Crafting System!**\n\n' +
                        'Select a crafting category below to view available recipes.\n\n' +
                        '📊 **Queue Status:** Use the Queue button to view your crafting progress.\n' +
                        '⚠️ **Limit:** You can have up to 5 items crafting at once.\n\n' +
                        '**Categories:**\n' +
                        '💊 **Potions** - Boost your coin, gem, and income production\n' +
                        '🧰 **Items** - Craft powerful tools and materials\n' +
                        '🧸 **Fumos** - Coming soon!\n' +
                        '🌟 **Blessings** - Coming soon!'
                    )
                    .setColor('Random')
                    .setFooter({ text: 'Select a category to begin crafting!' })
                    .setTimestamp();

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(buildSecureCustomId('craft_menu_potion', userId))
                            .setLabel('💊 Potions')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(buildSecureCustomId('craft_menu_item', userId))
                            .setLabel('🧰 Items')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(buildSecureCustomId('craft_menu_fumo', userId))
                            .setLabel('🧸 Fumos')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(buildSecureCustomId('craft_menu_blessing', userId))
                            .setLabel('🌟 Blessings')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId(buildSecureCustomId('craft_menu_queue', userId))
                            .setLabel('📋 Queue')
                            .setStyle(ButtonStyle.Success)
                    );

                await interaction.update({
                    embeds: [embed],
                    components: [buttons]
                });
                return;
            }

            // Confirm craft
            if (action === 'craft_confirm') {
                if (!checkButtonOwnership(interaction, 'craft_confirm', null, false)) {
                    return interaction.reply({ 
                        content: "❌ You can't use someone else's button.", 
                        ephemeral: true 
                    });
                }

                const craftData = client.craftConfirmData?.get(userId);
                if (!craftData) {
                    return interaction.reply({ 
                        content: '❌ Session expired.', 
                        ephemeral: true 
                    });
                }

                try {
                    const result = await processCraft(
                        userId,
                        craftData.itemName,
                        craftData.amount,
                        craftData.craftType,
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
                    
                    // Refresh queue view
                    const queueItems = await getQueueItems(userId);
                    const queueData = createQueueEmbed(queueItems, userId);
                    
                    if (interaction.message) {
                        await interaction.message.edit({
                            embeds: [queueData.embed],
                            components: queueData.buttons
                        }).catch(() => {});
                    }
                } catch (error) {
                    await interaction.reply({ 
                        content: '❌ Failed to claim item. It may not be ready yet.', 
                        ephemeral: true 
                    });
                }
                return;
            }

            // Refresh queue
            if (action === 'craft_queue_refresh') {
                const queueItems = await getQueueItems(userId);
                const queueData = createQueueEmbed(queueItems, userId);
                await interaction.update({ 
                    embeds: [queueData.embed], 
                    components: queueData.buttons 
                });
                return;
            }

        } catch (err) {
            console.error('[itemCraft/buttons] Error:', err);
            await interaction.reply({ 
                content: '❌ An error occurred.', 
                ephemeral: true 
            }).catch(() => {});
        }
    });

    // String select menu handler for item selection
    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isStringSelectMenu()) return;
            
            const { action, additionalData } = parseCustomId(interaction.customId);
            
            if (action !== 'craft_select_item') return;

            const userId = interaction.user.id;
            const itemName = interaction.values[0];
            const craftType = additionalData?.type || 'item';

            const updatedUserData = await getUserCraftData(userId, craftType);
            const validation = validateFullCraft(itemName, 1, craftType, updatedUserData);
            
            if (!validation.valid) {
                const errorEmbed = createErrorEmbed(validation.error, {
                    ...validation,
                    itemName,
                    max: CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                });
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                return;
            }

            // Calculate max craftable
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
                recipe: validation.recipe,
                craftType
            });
            
            await interaction.showModal(modal);

        } catch (err) {
            console.error('[itemCraft/select] Error:', err);
            await interaction.reply({ 
                content: '❌ An error occurred.', 
                ephemeral: true 
            }).catch(() => {});
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
                return interaction.reply({ 
                    content: '❌ Session expired. Please try again.', 
                    ephemeral: true 
                });
            }

            const amount = parseInt(interaction.fields.getTextInputValue('amount'));
            
            if (isNaN(amount) || amount < 1 || amount > modalData.maxCraftable) {
                return interaction.reply({ 
                    content: `❌ Invalid amount. Please enter 1-${modalData.maxCraftable}`, 
                    ephemeral: true 
                });
            }

            // Get fresh user data
            const userData = await getUserCraftData(userId, modalData.craftType);
            const validation = validateFullCraft(modalData.itemName, amount, modalData.craftType, userData);
            
            if (!validation.valid) {
                const errorEmbed = createErrorEmbed(validation.error, {
                    ...validation,
                    itemName: modalData.itemName,
                    max: CRAFT_CONFIG.MAX_CRAFT_AMOUNT
                });
                return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }

            // Show confirmation
            const confirmEmbed = createConfirmEmbed(
                modalData.itemName,
                amount,
                validation.recipe,
                validation.totalCoins,
                validation.totalGems,
                userData,
                modalData.craftType
            );

            const confirmButtons = createConfirmButtons(userId, modalData.itemName, amount);

            // Store craft data
            client.craftConfirmData = client.craftConfirmData || new Map();
            client.craftConfirmData.set(userId, {
                itemName: modalData.itemName,
                amount,
                recipe: validation.recipe,
                totalCoins: validation.totalCoins,
                totalGems: validation.totalGems,
                craftType: modalData.craftType
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
};