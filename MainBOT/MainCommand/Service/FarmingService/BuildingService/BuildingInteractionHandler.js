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
const { get, run, withUserLock, atomicDeductCurrency } = require('../../../Core/database');
const { getFarmStatusData, createFarmStatusEmbed } = require('../FarmStatusHelper');
const { createCatchHandler } = require('../../../Ultility/errorHandler');

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
    try {
        if (interaction.deferred || interaction.replied) {
            return;
        }
        await interaction.deferUpdate();
    } catch (error) {
        console.log('Interaction already handled:', error.message);
        return;
    }

    try {
        const username = interaction.user.username;
        
        const farmData = await getFarmStatusData(userId, username);
        const embed = createFarmStatusEmbed(farmData);
        
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
        if (!interaction.replied && !interaction.deferred) {
            await interaction.followUp({
                content: '❌ Failed to return to farm status.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

async function handleUpgrade(interaction, userId) {
    if (!interaction.customId.startsWith('upgrade_')) {
        console.log('Not an upgrade button, ignoring');
        return;
    }

    await interaction.deferUpdate();

    try {
        const buildingType = extractBuildingType(interaction.customId);
        
        if (!buildingType || !['COIN_BOOST', 'GEM_BOOST', 'CRITICAL_FARMING', 'EVENT_BOOST'].includes(buildingType)) {
            console.error('Invalid building type:', buildingType, 'from customId:', interaction.customId);
            return await interaction.followUp({
                content: '❌ Invalid building type.',
                ephemeral: true
            });
        }

        const levels = await getBuildingLevels(userId);
        const currentLevel = levels[buildingType];

        const upgradeCheck = canUpgrade(buildingType, currentLevel);
        if (!upgradeCheck.valid) {
            return await interaction.followUp({
                embeds: [createUpgradeErrorEmbed(upgradeCheck.error, { maxLevel: upgradeCheck.maxLevel })],
                ephemeral: true
            });
        }

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

        // FIXED: Use atomic currency deduction to prevent race conditions
        const deductResult = await atomicDeductCurrency(userId, cost.coins, cost.gems);
        if (!deductResult.success) {
            const errorType = deductResult.error === 'INSUFFICIENT_COINS' ? 'INSUFFICIENT_COINS' : 'INSUFFICIENT_GEMS';
            return await interaction.followUp({
                embeds: [createUpgradeErrorEmbed(errorType, { 
                    required: deductResult.need, 
                    current: deductResult.have 
                })],
                ephemeral: true
            });
        }
        
        await upgradeBuilding(userId, buildingType);

        const newLevel = currentLevel + 1;
        const newBonus = calculateBuildingMultiplier(buildingType, newLevel);

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
        }).catch(createCatchHandler('BUILDING_UPGRADE', { userId }));
    }
}

function extractBuildingType(customId) {
    const parts = customId.split('_');
    
    if (parts.length < 3) {
        console.error('Invalid customId format:', customId);
        return null;
    }
    
    let userIdIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
            userIdIndex = i;
            break;
        }
    }
    
    if (userIdIndex === -1) {
        userIdIndex = parts.length - 1;
    }
    
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