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

            // Get limit breaks
            const upgradesRow = await get(
                `SELECT limitBreaks FROM userUpgrades WHERE userId = ?`,
                [userId]
            );
            const limitBreaks = upgradesRow?.limitBreaks || 0;

            const farmLimit = calculateFarmLimit(fragmentUses) + limitBreaks;

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

            // Add limit break info to embed if present
            if (limitBreaks > 0) {
                embed.addFields({
                    name: '⚡ Limit Breaks',
                    value: `Active: **${limitBreaks}** (+${limitBreaks} slots)`,
                    inline: true
                });
            }

            const buttonRow = new ActionRowBuilder()
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
                    } else if (interaction.customId.startsWith('open_limitbreaker_')) {
                        await handleLimitBreakerMenu(interaction, userId, message);
                    } else if (interaction.customId.startsWith('limitbreak_confirm_')) {
                        await handleLimitBreakConfirm(interaction, userId, client, message);
                    } else if (interaction.customId.startsWith('limitbreak_back_')) {
                        // Refresh farm status
                        const [newFragmentUses, newFarmingFumos] = await Promise.all([
                            getFarmLimit(userId),
                            getUserFarmingFumos(userId)
                        ]);
                        
                        const newBoosts = await all(
                            `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
                             WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
                            [userId, Date.now()]
                        );
                        
                        let newCoinMult = 1, newGemMult = 1;
                        newBoosts.forEach(b => {
                            const type = (b.type || '').toLowerCase();
                            const mult = b.multiplier || 1;
                            if (['coin', 'income'].includes(type)) newCoinMult *= mult;
                            if (['gem', 'gems', 'income'].includes(type)) newGemMult *= mult;
                        });
                        
                        const newSeasonalMults = await getCurrentMultipliers();
                        const newActiveSeasons = await getActiveSeasonsList();
                        const newBuildingLevels = await getBuildingLevels(userId);
                        const newCoinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', newBuildingLevels.COIN_BOOST);
                        const newGemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', newBuildingLevels.GEM_BOOST);
                        const newFinalCoinMult = newCoinMult * newCoinBuildingBoost * newSeasonalMults.coinMultiplier;
                        const newFinalGemMult = newGemMult * newGemBuildingBoost * newSeasonalMults.gemMultiplier;
                        
                        const newUpgradesRow = await get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId]);
                        const newLimitBreaks = newUpgradesRow?.limitBreaks || 0;
                        const newFarmLimit = calculateFarmLimit(newFragmentUses) + newLimitBreaks;
                        
                        const newEmbed = createFarmStatusEmbed({
                            username: message.author.username,
                            farmingFumos: newFarmingFumos,
                            farmLimit: newFarmLimit,
                            fragmentUses: newFragmentUses,
                            boosts: {
                                coinMultiplier: newFinalCoinMult,
                                gemMultiplier: newFinalGemMult,
                                activeBoosts: newBoosts
                            },
                            seasons: {
                                active: newActiveSeasons,
                                multipliers: newSeasonalMults
                            }
                        });
                        
                        if (newLimitBreaks > 0) {
                            newEmbed.addFields({
                                name: '⚡ Limit Breaks',
                                value: `Active: **${newLimitBreaks}** (+${newLimitBreaks} slots)`,
                                inline: true
                            });
                        }
                        
                        await interaction.update({
                            embeds: [newEmbed],
                            components: [buttonRow]
                        });
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

async function handleLimitBreakerMenu(interaction, userId, message) {
    await interaction.deferUpdate();

    try {
        const { EmbedBuilder } = require('discord.js');
        
        // Pool of fumos that can be required for limit breaking
        const LIMIT_BREAK_FUMO_POOL = [
            'Reimu(Common)',
            'Marisa(Common)',
            'Cirno(Common)',
            'Sanae(Common)',
            'Sakuya(UNCOMMON)',
            'Meiling(UNCOMMON)',
            'Patchouli(UNCOMMON)',
            'Remilia(RARE)',
            'Youmu(RARE)',
            'Ran(EPIC)',
            'Satori(EPIC)',
            'Kasen(EPIC)'
        ];
        
        const MAX_LIMIT_BREAKS = 100;
        
        // Calculate requirements based on current break level
        function calculateRequirements(currentBreaks) {
            const baseFragments = 15;
            const baseNullified = 1;
            
            const fragmentIncrease = Math.floor(currentBreaks / 10) * 5;
            const nullifiedIncrease = Math.floor(currentBreaks / 20);
            
            return {
                fragments: baseFragments + fragmentIncrease,
                nullified: baseNullified + nullifiedIncrease
            };
        }
        
        // Get random fumo from pool
        function getRandomRequiredFumo() {
            return LIMIT_BREAK_FUMO_POOL[Math.floor(Math.random() * LIMIT_BREAK_FUMO_POOL.length)];
        }
        
        // Get user's current limit breaks
        const userRow = await get(
            `SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`,
            [userId]
        );

        const currentBreaks = userRow?.limitBreaks || 0;
        const fragmentUses = userRow?.fragmentUses || 0;

        // Get random required fumo
        const requiredFumo = getRandomRequiredFumo();

        // Calculate requirements
        const requirements = calculateRequirements(currentBreaks);

        // Check user's inventory
        const fragmentRow = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, 'FragmentOf1800s(R)']
        );

        const nullifiedRow = await get(
            `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
            [userId, 'Nullified(?)']
        );

        const fumoRow = await get(
            `SELECT COUNT(*) as count FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, requiredFumo]
        );

        const userInventory = {
            fragments: fragmentRow?.quantity || 0,
            nullified: nullifiedRow?.quantity || 0,
            hasFumo: (fumoRow?.count || 0) > 0,
            fragmentUses
        };

        // Create embed
        const nextBreakNumber = currentBreaks + 1;
        const canBreak = currentBreaks < MAX_LIMIT_BREAKS;
        
        const embed = new EmbedBuilder()
            .setTitle('⚡ Limit Breaker System')
            .setColor(canBreak ? 0xFFD700 : 0xFF0000)
            .setDescription(
                canBreak 
                    ? '**Break through your farming limits!**\n\n' +
                      'Sacrifice specific items to gain additional farming slots beyond the fragment limit.\n\n' +
                      '**Current Progress:**'
                    : '**Maximum Limit Breaks Reached!**\n\n' +
                      'You have reached the maximum of 100 limit breaks.'
            );

        if (canBreak) {
            const hasFragments = userInventory.fragments >= requirements.fragments;
            const hasNullified = userInventory.nullified >= requirements.nullified;
            const hasFumo = userInventory.hasFumo;

            embed.addFields(
                {
                    name: '📊 Limit Break Status',
                    value: `Current Breaks: **${currentBreaks} / ${MAX_LIMIT_BREAKS}**\n` +
                           `Total Farm Limit: **${5 + (userInventory.fragmentUses || 0) + currentBreaks}**`,
                    inline: false
                },
                {
                    name: `💎 Next Break Requirements (#${nextBreakNumber})`,
                    value: 
                        `${hasFragments ? '✅' : '❌'} **${requirements.fragments}x** FragmentOf1800s(R)\n` +
                        `${hasNullified ? '✅' : '❌'} **${requirements.nullified}x** Nullified(?)\n` +
                        `${hasFumo ? '✅' : '❌'} **1x** ${requiredFumo}`,
                    inline: false
                },
                {
                    name: '📦 Your Inventory',
                    value: 
                        `Fragments: **${userInventory.fragments}**\n` +
                        `Nullified: **${userInventory.nullified}**\n` +
                        `${requiredFumo}: **${hasFumo ? '✓' : 'None'}**`,
                    inline: false
                }
            );

            if (currentBreaks > 0) {
                const nextFragmentMilestone = Math.ceil((currentBreaks + 1) / 10) * 10;
                const nextNullifiedMilestone = Math.ceil((currentBreaks + 1) / 20) * 20;
                
                let milestoneText = '**Upcoming Milestones:**\n';
                if (currentBreaks < nextFragmentMilestone) {
                    const nextFragReq = calculateRequirements(nextFragmentMilestone).fragments;
                    milestoneText += `• Break #${nextFragmentMilestone}: Fragments increase to ${nextFragReq}\n`;
                }
                if (currentBreaks < nextNullifiedMilestone) {
                    const nextNullReq = calculateRequirements(nextNullifiedMilestone).nullified;
                    milestoneText += `• Break #${nextNullifiedMilestone}: Nullified increase to ${nextNullReq}\n`;
                }
                
                embed.addFields({
                    name: '🎯 Progression',
                    value: milestoneText,
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: '🏆 Achievement Unlocked',
                value: 'You have maxed out the Limit Breaker system!\n' +
                       `Your total farm limit is now: **${5 + (userInventory.fragmentUses || 0) + currentBreaks}**`,
                inline: false
            });
        }

        embed.setFooter({ 
            text: canBreak 
                ? '⚡ Click the button below to perform a Limit Break' 
                : '🎉 Congratulations on reaching the maximum!' 
        });

        // Create button
        const canBreakNow = currentBreaks < MAX_LIMIT_BREAKS &&
                           userInventory.fragments >= requirements.fragments &&
                           userInventory.nullified >= requirements.nullified &&
                           userInventory.hasFumo;

        const limitBreakRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`limitbreak_confirm_${userId}_${requiredFumo}`)
                    .setLabel('⚡ Perform Limit Break')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(!canBreakNow),
                new ButtonBuilder()
                    .setCustomId(`limitbreak_back_${userId}`)
                    .setLabel('◀️ Back to Farm')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: currentBreaks < MAX_LIMIT_BREAKS ? [limitBreakRow] : [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`limitbreak_back_${userId}`)
                        .setLabel('◀️ Back to Farm')
                        .setStyle(ButtonStyle.Secondary)
                )
            ]
        });

    } catch (error) {
        console.error('Error opening limit breaker menu:', error);
        await interaction.followUp({
            content: '❌ Failed to open Limit Breaker menu.',
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

        const { upgradeBuilding } = require('../../Service/FarmingService/BuildingService/BuildingDatabaseService');
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