const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { createInventoryEmbed, createInventoryButtons } = require('./ItemUIService');
const { debugLog } = require('../../../Core/logger');

async function handleInventoryInteraction(interaction, inventoryData, currentPage, user, stats) {
    try {
        if (!await checkButtonOwnership(interaction, null, null, false)) {
            console.log(`[INTERACTION] Ownership check failed`);
            
            try {
                await interaction.reply({
                    content: "❌ You can't use someone else's inventory buttons.",
                    ephemeral: true
                });
            } catch (error) {
                console.log(`[INTERACTION] Could not reply to ownership error (interaction expired)`);
            }
            
            return { success: false, newPage: currentPage };
        }

        if (!inventoryData || !inventoryData.pages || inventoryData.pages.length === 0) {
            console.error(`[INTERACTION] Invalid inventory data:`, inventoryData);
            await interaction.reply({
                content: '❌ Error: Invalid inventory data',
                ephemeral: true
            });
            return { success: false, newPage: currentPage };
        }

        const totalPages = inventoryData.pages.length;
        let newPage = currentPage;

        if (interaction.customId.startsWith('prev_page')) {
            if (currentPage > 0) {
                newPage = currentPage - 1;
            } else {
                await interaction.reply({
                    content: '⚠️ You are already on the first page.',
                    ephemeral: true
                });
                return { success: false, newPage: currentPage };
            }
        } else if (interaction.customId.startsWith('next_page')) {
            if (currentPage < totalPages - 1) {
                newPage = currentPage + 1;
            } else {
                await interaction.reply({
                    content: '⚠️ You are already on the last page.',
                    ephemeral: true
                });
                return { success: false, newPage: currentPage };
            }
        } else {
            console.log(`[INTERACTION] Unknown interaction type: ${interaction.customId}`);
            return { success: false, newPage: currentPage };
        }

        if (newPage !== currentPage) {
            if (!inventoryData.pages[newPage]) {
                console.error(`[INTERACTION] Page ${newPage} does not exist!`);
                await interaction.reply({
                    content: '❌ Error: Invalid page number',
                    ephemeral: true
                });
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

            await interaction.update({
                embeds: [embed],
                components: [buttons]
            });
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
            console.error('[INTERACTION] Failed to send error message:', replyError);
        }

        return { success: false, newPage: currentPage };
    }
}

async function handleInventoryRefresh(interaction, userId) {
    try {
        const { getUserInventoryPaginated, getInventoryStats } = require('./ItemQueryService');
        
        const inventoryData = await getUserInventoryPaginated(userId, 2);
        
        if (!inventoryData.hasItems) {
            await interaction.update({
                content: '🤷‍♂️ It appears you do not have any items at the moment.',
                embeds: [],
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
            await interaction.reply({
                content: '❌ An error occurred while refreshing your inventory.',
                ephemeral: true
            });
        } catch (replyError) {
            console.error('[INTERACTION] Failed to send error message:', replyError);
        }
        
        return false;
    }
}

module.exports = {
    handleInventoryInteraction,
    handleInventoryRefresh
};