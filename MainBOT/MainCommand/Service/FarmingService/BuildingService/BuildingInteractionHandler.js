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
const { getFarmStatusData, createFarmStatusEmbed } = require('../FarmStatusHelper');

async function handleBuildingInteraction(interaction, userId, client) {
    const { customId } = interaction;

    if (customId.startsWith('open_buildings_')) {
        await openBuildingMenu(interaction, userId);
    } 
    else if (customId.startsWith('upgrade_')) {
        await handleUpgrade(interaction, userId);
    }
    else if (customId.startsWith('building_close_')) {
        await handleClose(interaction, userId);
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

async function handleClose(interaction, userId) {
    await interaction.deferUpdate();

    try {
        // Get the username from the interaction
        const username = interaction.user.username;
        
        // Refresh farm status
        const farmData = await getFarmStatusData(userId, username);
        const embed = createFarmStatusEmbed(farmData);
        
        // Create main buttons (Farm Buildings and Limit Breaker)
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const mainButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_buildings_${userId}`)
                    .setLabel('🏗️ Farm Buildings')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`open_limitbreaker_${userId}`)
                    .setLabel('⚡ Limit Breaker')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [mainButtons]
        });
    } catch (error) {
        console.error('Error closing building menu:', error);
        await interaction.followUp({
            content: '❌ Failed to return to farm status.',
            ephemeral: true
        });
    }
}

async function handleUpgrade(interaction, userId) {
    // Add this check at the very beginning
    if (!interaction.customId.startsWith('upgrade_')) {
        console.log('Not an upgrade button, ignoring');
        return;
    }

    await interaction.deferUpdate();

    try {
        const buildingType = extractBuildingType(interaction.customId);
        
        // Add validation for building type
        if (!buildingType || !['COIN_BOOST', 'GEM_BOOST', 'CRITICAL_FARMING', 'EVENT_BOOST'].includes(buildingType)) {
            console.error('Invalid building type:', buildingType, 'from customId:', interaction.customId);
            return await interaction.followUp({
                content: '❌ Invalid building type.',
                ephemeral: true
            });
        }

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
        console.error('Stack:', error.stack);
        await interaction.followUp({
            embeds: [createUpgradeErrorEmbed('UNKNOWN')],
            ephemeral: true
        }).catch(err => console.error('Failed to send error message:', err));
    }
}

function extractBuildingType(customId) {
    // customId format: upgrade_BUILDING_TYPE_userId
    // Example: upgrade_COIN_BOOST_123456789
    const parts = customId.split('_');
    
    // Remove 'upgrade' from the beginning and userId from the end
    if (parts.length < 3) {
        console.error('Invalid customId format:', customId);
        return null;
    }
    
    // Find the userId (all digits, 17-19 chars)
    let userIdIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
            userIdIndex = i;
            break;
        }
    }
    
    if (userIdIndex === -1) {
        // Fallback: assume last part is userId
        userIdIndex = parts.length - 1;
    }
    
    // Building type is everything between 'upgrade' and userId
    const buildingType = parts.slice(1, userIdIndex).join('_');
    
    console.log('Extracted building type:', buildingType, 'from customId:', customId);
    return buildingType;
}

module.exports = {
    handleBuildingInteraction,
    openBuildingMenu,
    handleUpgrade,
    handleClose
};