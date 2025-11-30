const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { getFarmLimit, getUserFarmingFumos } = require('../../Service/FarmingService/FarmingDatabaseService');
const { calculateFarmLimit } = require('../../Service/FarmingService/FarmingCalculationService');
const { createFarmStatusEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { getCurrentMultipliers, getActiveSeasonsList } = require('../../Service/FarmingService/SeasonService/SeasonManagerService');
const { getBuildingLevels } = require('../../Service/FarmingService/BuildingService/BuildingDatabaseService');
const { 
    getAllBuildingsInfo, 
    calculateUpgradeCost,
    canUpgrade,
    calculateBuildingMultiplier
} = require('../../Configuration/buildingConfig');
const {
    createBuildingOverviewEmbed,
    createBuildingButtons,
    createUpgradeSuccessEmbed,
    createUpgradeErrorEmbed
} = require('../../Service/FarmingService/BuildingService/BuildingUIService');
const { all, get, run } = require('../../Core/database');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.farmcheck') && !message.content.startsWith('.fc')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            const [fragmentUses, farmingFumos] = await Promise.all([
                getFarmLimit(userId),
                getUserFarmingFumos(userId)
            ]);

            if (farmingFumos.length === 0) {
                return message.reply({
                    embeds: [createErrorEmbed('🤷‍♂️ No Fumos are currently farming. Time to get started!')]
                });
            }

            const now = Date.now();
            const boosts = await all(
                `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
                 WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            );

            let coinMultiplier = 1;
            let gemMultiplier = 1;

            boosts.forEach(b => {
                const type = (b.type || '').toLowerCase();
                const mult = b.multiplier || 1;
                
                if (['coin', 'income'].includes(type)) {
                    coinMultiplier *= mult;
                }
                if (['gem', 'gems', 'income'].includes(type)) {
                    gemMultiplier *= mult;
                }
            });

            const seasonalMults = await getCurrentMultipliers();
            const activeSeasons = await getActiveSeasonsList();

            const buildingLevels = await getBuildingLevels(userId);
            const coinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', buildingLevels.COIN_BOOST);
            const gemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', buildingLevels.GEM_BOOST);

            const finalCoinMult = coinMultiplier * coinBuildingBoost * seasonalMults.coinMultiplier;
            const finalGemMult = gemMultiplier * gemBuildingBoost * seasonalMults.gemMultiplier;

            const farmLimit = calculateFarmLimit(fragmentUses);

            const embed = createFarmStatusEmbed({
                username: message.author.username,
                farmingFumos,
                farmLimit,
                fragmentUses,
                boosts: {
                    coinMultiplier: finalCoinMult,
                    gemMultiplier: finalGemMult,
                    activeBoosts: boosts
                },
                seasons: {
                    active: activeSeasons,
                    multipliers: seasonalMults
                }
            });

            const buttonRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`open_buildings_${userId}`)
                        .setLabel('🏗️ Farm Buildings')
                        .setStyle(ButtonStyle.Primary)
                );

            const msg = await message.reply({ 
                embeds: [embed],
                components: [buttonRow]
            });

            const collector = msg.createMessageComponentCollector({
                time: 300000 
            });

            collector.on('collect', async (interaction) => {
                if (!await checkButtonOwnership(interaction)) return;

                try {
                    if (interaction.customId.startsWith('open_buildings_')) {
                        await handleBuildingMenu(interaction, userId, client);
                    } else if (interaction.customId.startsWith('upgrade_')) {
                        await handleUpgrade(interaction, userId, client);
                    } else if (interaction.customId.startsWith('building_close_')) {
                        await interaction.update({
                            embeds: [embed],
                            components: [buttonRow]
                        });
                    }
                } catch (error) {
                    console.error('Error in farmcheck button interaction:', error);
                }
            });

            collector.on('end', async () => {
                try {
                    await msg.edit({ components: [] });
                } catch (error) {
                    // Message might be deleted
                }
            });

        } catch (error) {
            console.error('Error in .farmcheck:', error);
            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong while checking your farm.')]
            });
        }
    });
};

async function handleBuildingMenu(interaction, userId, client) {
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

async function handleUpgrade(interaction, userId, client) {
    await interaction.deferUpdate();

    try {
        const parts = interaction.customId.split('_');
        const buildingType = parts.slice(1, -1).join('_');
        
        const levels = await getBuildingLevels(userId);
        const currentLevel = levels[buildingType];
        
        const upgradeCheck = canUpgrade(buildingType, currentLevel);
        if (!upgradeCheck.valid) {
            const errorEmbed = createUpgradeErrorEmbed(upgradeCheck.error, {
                maxLevel: upgradeCheck.maxLevel
            });
            
            return interaction.followUp({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        const cost = calculateUpgradeCost(buildingType, currentLevel);
        
        const userRow = await get(
            `SELECT coins, gems FROM userCoins WHERE userId = ?`,
            [userId]
        );
        
        const coins = userRow?.coins || 0;
        const gems = userRow?.gems || 0;
        
        if (coins < cost.coins) {
            const errorEmbed = createUpgradeErrorEmbed('INSUFFICIENT_COINS', {
                required: cost.coins,
                current: coins
            });
            
            return interaction.followUp({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }
        
        if (gems < cost.gems) {
            const errorEmbed = createUpgradeErrorEmbed('INSUFFICIENT_GEMS', {
                required: cost.gems,
                current: gems
            });
            
            return interaction.followUp({
                embeds: [errorEmbed],
                ephemeral: true
            });
        }

        await run(
            `UPDATE userCoins SET coins = coins - ?, gems = gems - ? WHERE userId = ?`,
            [cost.coins, cost.gems, userId]
        );

        const { upgradeBuilding } = require('../../Service/FarmingService/BuildingDatabaseService');
        await upgradeBuilding(userId, buildingType);
        
        const newLevel = currentLevel + 1;
        const newBonus = calculateBuildingMultiplier(buildingType, newLevel);
        
        const successEmbed = createUpgradeSuccessEmbed(buildingType, newLevel, newBonus);
        
        const updatedLevels = await getBuildingLevels(userId);
        const updatedBuildings = getAllBuildingsInfo(updatedLevels);
        const updatedEmbed = createBuildingOverviewEmbed(userId, updatedBuildings);
        const updatedButtons = createBuildingButtons(userId, updatedBuildings);
        
        await interaction.editReply({
            embeds: [updatedEmbed],
            components: updatedButtons
        });
        
        await interaction.followUp({
            embeds: [successEmbed],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error upgrading building:', error);
        
        const errorEmbed = createUpgradeErrorEmbed('UNKNOWN');
        await interaction.followUp({
            embeds: [errorEmbed],
            ephemeral: true
        });
    }
}