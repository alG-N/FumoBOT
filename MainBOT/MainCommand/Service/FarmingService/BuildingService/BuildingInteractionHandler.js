const { getBuildingLevels, upgradeBuilding } = require('./BuildingDatabaseService');
const { 
    getAllBuildingsInfo, 
    calculateUpgradeCost, 
    canUpgrade, 
    calculateBuildingMultiplier 
} = require('../../../Configuration/buildingConfig');
const {
    createBuildingOverviewEmbed,
    createBuildingButtons,
    createUpgradeSuccessEmbed,
    createUpgradeErrorEmbed
} = require('./BuildingUIService');
const { get, run } = require('../../../Core/database');

async function handleBuildingInteraction(interaction, userId, client) {
    const { customId } = interaction;

    if (customId.startsWith('open_buildings_')) {
        await openBuildingMenu(interaction, userId);
    } 
    else if (customId.startsWith('upgrade_')) {
        await handleUpgrade(interaction, userId);
    }
    else if (customId.startsWith('building_close_')) {
        // Return to main view - handled by parent
        return 'CLOSE';
    }
}

async function openBuildingMenu(interaction, userId) {
    await interaction.deferUpdate();

    try {
        const levels = await getBuildingLevels(userId);
        const buildings = getAllBuildingsInfo(levels);
        const embed = createBuildingOverviewEmbed(userId, buildings);
        const buttons = createBuildingButtons(userId, buildings);

        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    } catch (error) {
        console.error('Error opening building menu:', error);
        await interaction.followUp({
            content: '❌ Failed to load building menu.',
            ephemeral: true
        });
    }
}

async function handleUpgrade(interaction, userId) {
    await interaction.deferUpdate();

    try {
        const buildingType = extractBuildingType(interaction.customId);
        const levels = await getBuildingLevels(userId);
        const currentLevel = levels[buildingType];

        // Validate upgrade
        const upgradeCheck = canUpgrade(buildingType, currentLevel);
        if (!upgradeCheck.valid) {
            return await interaction.followUp({
                embeds: [createUpgradeErrorEmbed(upgradeCheck.error, { maxLevel: upgradeCheck.maxLevel })],
                ephemeral: true
            });
        }

        // Check resources
        const cost = calculateUpgradeCost(buildingType, currentLevel);
        const userRow = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
        const coins = userRow?.coins || 0;
        const gems = userRow?.gems || 0;

        if (coins < cost.coins) {
            return await interaction.followUp({
                embeds: [createUpgradeErrorEmbed('INSUFFICIENT_COINS', { required: cost.coins, current: coins })],
                ephemeral: true
            });
        }

        if (gems < cost.gems) {
            return await interaction.followUp({
                embeds: [createUpgradeErrorEmbed('INSUFFICIENT_GEMS', { required: cost.gems, current: gems })],
                ephemeral: true
            });
        }

        // Perform upgrade
        await run(`UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`, 
                  [cost.coins, cost.gems, userId]);
        await upgradeBuilding(userId, buildingType);

        const newLevel = currentLevel + 1;
        const newBonus = calculateBuildingMultiplier(buildingType, newLevel);

        // Refresh building menu
        const updatedLevels = await getBuildingLevels(userId);
        const updatedBuildings = getAllBuildingsInfo(updatedLevels);
        const updatedEmbed = createBuildingOverviewEmbed(userId, updatedBuildings);
        const updatedButtons = createBuildingButtons(userId, updatedBuildings);

        await interaction.editReply({
            embeds: [updatedEmbed],
            components: updatedButtons
        });

        await interaction.followUp({
            embeds: [createUpgradeSuccessEmbed(buildingType, newLevel, newBonus)],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error upgrading building:', error);
        await interaction.followUp({
            embeds: [createUpgradeErrorEmbed('UNKNOWN')],
            ephemeral: true
        });
    }
}

function extractBuildingType(customId) {
    const parts = customId.split('_');
    return parts.slice(1, -1).join('_');
}

module.exports = {
    handleBuildingInteraction,
    openBuildingMenu,
    handleUpgrade
};