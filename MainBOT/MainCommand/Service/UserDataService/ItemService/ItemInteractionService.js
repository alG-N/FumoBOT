const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { createInventoryEmbed, createInventoryButtons, createEmptyInventoryEmbed } = require('./ItemUIService');
const { debugLog } = require('../../../Core/logger');

/**
 * Handle inventory button interactions with improved error handling and new navigation
 */
async function handleInventoryInteraction(interaction, inventoryData, currentPage, user, stats) {
    try {
        // Validate button ownership
        if (!await checkButtonOwnership(interaction, null, null, false)) {
            debugLog('INTERACTION', `Ownership check failed for user ${interaction.user.id}`);
            
            try {
                await interaction.reply({
                    content: "❌ You can't use someone else's inventory buttons.",
                    ephemeral: true
                });
            } catch (error) {
                debugLog('INTERACTION', `Could not reply to ownership error (interaction expired)`);
            }
            
            return { success: false, newPage: currentPage };
        }

        // Validate inventory data
        if (!inventoryData || !inventoryData.pages || inventoryData.pages.length === 0) {
            console.error(`[INTERACTION] Invalid inventory data:`, inventoryData);
            try {
                await interaction.reply({
                    content: '❌ Error: Invalid inventory data. Try using the command again.',
                    ephemeral: true
                });
            } catch (e) {
                // Interaction already handled
            }
            return { success: false, newPage: currentPage };
        }

        const totalPages = inventoryData.pages.length;
        let newPage = currentPage;
        const customId = interaction.customId;

        // Handle different navigation buttons
        if (customId.includes('prev_page')) {
            newPage = Math.max(0, currentPage - 1);
        } else if (customId.includes('next_page')) {
            newPage = Math.min(totalPages - 1, currentPage + 1);
        } else if (customId.includes('inv_first')) {
            newPage = 0;
        } else if (customId.includes('inv_last')) {
            newPage = totalPages - 1;
        } else if (customId.includes('inv_page_info')) {
            // Page info button is disabled, but handle it gracefully
            try {
                await interaction.deferUpdate();
            } catch (e) {
                // Ignore
            }
            return { success: true, newPage: currentPage };
        } else {
            debugLog('INTERACTION', `Unknown interaction type: ${customId}`);
            return { success: false, newPage: currentPage };
        }

        // Only update if page actually changed
        if (newPage !== currentPage) {
            // Validate page exists
            if (!inventoryData.pages[newPage]) {
                console.error(`[INTERACTION] Page ${newPage} does not exist! Total pages: ${totalPages}`);
                try {
                    await interaction.reply({
                        content: '❌ Error: Invalid page number. Please try the command again.',
                        ephemeral: true
                    });
                } catch (e) {
                    // Interaction already handled
                }
                return { success: false, newPage: currentPage };
            }
            
            const embed = createInventoryEmbed(
                user,
                inventoryData.pages[newPage],
                stats,
                newPage,
                totalPages
            );

            const buttons = createInventoryButtons(interaction.user.id, newPage, totalPages);

            try {
                await interaction.update({
                    embeds: [embed],
                    components: [buttons]
                });
            } catch (updateError) {
                // If update fails (e.g., interaction expired), try to handle gracefully
                debugLog('INTERACTION', `Update failed: ${updateError.message}`);
                return { success: false, newPage: currentPage };
            }
        } else {
            // Page didn't change, just acknowledge
            try {
                await interaction.deferUpdate();
            } catch (e) {
                // Ignore
            }
        }

        return { success: true, newPage };

    } catch (error) {
        console.error('[INTERACTION] Error in handleInventoryInteraction:', error);
        
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({
                    content: '❌ An error occurred while navigating pages.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while navigating pages.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            debugLog('INTERACTION', `Failed to send error message: ${replyError.message}`);
        }

        return { success: false, newPage: currentPage };
    }
}

/**
 * Handle inventory refresh with proper empty state handling
 */
async function handleInventoryRefresh(interaction, userId) {
    try {
        const { getUserInventoryPaginated, getInventoryStats } = require('./ItemQueryService');
        
        const inventoryData = await getUserInventoryPaginated(userId, 2);
        
        if (!inventoryData.hasItems) {
            const emptyEmbed = createEmptyInventoryEmbed(interaction.user);
            await interaction.update({
                content: null,
                embeds: [emptyEmbed],
                components: []
            });
            return false;
        }

        const stats = await getInventoryStats(userId);
        const embed = createInventoryEmbed(
            interaction.user,
            inventoryData.pages[0],
            stats,
            0,
            inventoryData.pages.length
        );

        const buttons = createInventoryButtons(userId, 0, inventoryData.pages.length);

        await interaction.update({
            content: null,
            embeds: [embed],
            components: [buttons]
        });

        return true;

    } catch (error) {
        console.error('[INTERACTION] Error refreshing inventory:', error);
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: '❌ An error occurred while refreshing your inventory.',
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: '❌ An error occurred while refreshing your inventory.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            debugLog('INTERACTION', `Failed to send error message: ${replyError.message}`);
        }
        
        return false;
    }
}

/**
 * Handle rarity filter selection
 */
async function handleRarityFilter(interaction, userId, selectedRarity) {
    try {
        const { getUserInventoryPaginated, getInventoryStats, getItemsByRarity } = require('./ItemQueryService');
        
        let inventoryData;
        let stats;
        
        if (selectedRarity === 'all') {
            inventoryData = await getUserInventoryPaginated(userId, 2);
            stats = await getInventoryStats(userId);
        } else {
            // Get only items of selected rarity
            const items = await getItemsByRarity(userId, selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1));
            stats = await getInventoryStats(userId);
            
            // Create single-page data for filtered view
            const rarityCapitalized = selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1);
            inventoryData = {
                hasItems: items.length > 0,
                pages: [{ [rarityCapitalized]: items }],
                totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
                totalPages: 1
            };
        }
        
        if (!inventoryData.hasItems) {
            const emptyEmbed = createEmptyInventoryEmbed(interaction.user);
            await interaction.update({
                embeds: [emptyEmbed],
                components: []
            });
            return false;
        }

        const embed = createInventoryEmbed(
            interaction.user,
            inventoryData.pages[0],
            stats,
            0,
            inventoryData.pages.length
        );

        const buttons = createInventoryButtons(userId, 0, inventoryData.pages.length);

        await interaction.update({
            embeds: [embed],
            components: [buttons]
        });

        return true;

    } catch (error) {
        console.error('[INTERACTION] Error filtering inventory:', error);
        
        try {
            await interaction.reply({
                content: '❌ An error occurred while filtering your inventory.',
                ephemeral: true
            });
        } catch (replyError) {
            debugLog('INTERACTION', `Failed to send error message: ${replyError.message}`);
        }
        
        return false;
    }
}

module.exports = {
    handleInventoryInteraction,
    handleInventoryRefresh,
    handleRarityFilter
};