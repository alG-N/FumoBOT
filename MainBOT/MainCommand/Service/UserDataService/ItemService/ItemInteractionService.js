const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { createInventoryEmbed, createInventoryButtons } = require('./ItemUIService');
const { debugLog } = require('../../../Core/logger');

async function handleInventoryInteraction(interaction, inventoryData, currentPage, user, stats) {
    debugLog('INVENTORY_INTERACTION', `Handling interaction ${interaction.customId} for user ${interaction.user.id}`);

    if (!await checkButtonOwnership(interaction)) {
        return { success: false, newPage: currentPage };
    }

    const totalPages = inventoryData.pages.length;
    let newPage = currentPage;

    if (interaction.customId.startsWith('prev_page') && currentPage > 0) {
        newPage = currentPage - 1;
    } else if (interaction.customId.startsWith('next_page') && currentPage < totalPages - 1) {
        newPage = currentPage + 1;
    }

    if (newPage !== currentPage) {
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

        debugLog('INVENTORY_INTERACTION', `Updated to page ${newPage + 1}/${totalPages}`);
    }

    return { success: true, newPage };
}

async function handleInventoryRefresh(interaction, userId) {
    debugLog('INVENTORY_INTERACTION', `Refreshing inventory for user ${userId}`);

    try {
        const { getUserInventoryPaginated, getInventoryStats } = require('./InventoryQueryService');
        
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
        console.error('Error refreshing inventory:', error);
        return false;
    }
}

module.exports = {
    handleInventoryInteraction,
    handleInventoryRefresh
};