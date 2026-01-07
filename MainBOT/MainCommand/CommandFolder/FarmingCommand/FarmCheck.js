const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { getFarmStatusData, createFarmStatusEmbed } = require('../../Service/FarmingService/FarmStatusHelper');
const { handleBuildingInteraction } = require('../../Service/FarmingService/BuildingService/BuildingInteractionHandler');
const { handleLimitBreakerInteraction, handleFragmentModalSubmit } = require('../../Service/FarmingService/LimitBreakService/LimitBreakInteractionHandler');
const { get } = require('../../Core/database');
const { FEATURE_UNLOCKS } = require('../../Configuration/levelConfig');
const { REBIRTH_FEATURE_UNLOCKS } = require('../../Configuration/rebirthConfig');
const { createBiomeSelectEmbed, handleBiomeChange } = require('../../Service/FarmingService/BiomeService/BiomeUIService');
const { 
    handleOtherPlaceOpen, 
    handleSendFumo, 
    handleRetrieveFumo, 
    handleCollectIncome,
    handleFumoSelect
} = require('../../Service/FarmingService/OtherPlaceService/OtherPlaceHandlerService');

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
            // Get user level from userLevelProgress and rebirth from userRebirthProgress
            const [levelData, rebirthData] = await Promise.all([
                get(`SELECT level FROM userLevelProgress WHERE userId = ?`, [userId]),
                get(`SELECT rebirthCount FROM userRebirthProgress WHERE userId = ?`, [userId])
            ]);
            const userLevel = levelData?.level || 1;
            const userRebirth = rebirthData?.rebirthCount || 0;
            
            const farmData = await getFarmStatusData(userId, message.author.username);
            
            if (!farmData.hasFumos) {
                return message.reply({
                    embeds: [createErrorEmbed('🤷‍♂️ No Fumos are currently farming. Time to get started!')]
                });
            }

            const embed = createFarmStatusEmbed(farmData);
            const buttons = createMainButtons(userId, userLevel, userRebirth);

            const msg = await message.reply({
                embeds: [embed],
                components: [buttons]
            });

            setupInteractionCollector(msg, userId, message, client, userLevel, userRebirth);

        } catch (error) {
            console.error('Error in .farmcheck:', error);
            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong while checking your farm.')]
            });
        }
    });

    // Handle fragment modal submissions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('fragment_modal_')) return;

        const userId = interaction.customId.split('_')[2];
        
        if (interaction.user.id !== userId) {
            return interaction.reply({
                content: '❌ This modal is not for you!',
                ephemeral: true
            });
        }

        await handleFragmentModalSubmit(interaction, userId, client);
    });
};

function createMainButtons(userId, userLevel = 1, userRebirth = 0) {
    const BIOME_UNLOCK_LEVEL = FEATURE_UNLOCKS.BIOME_SYSTEM || 50;
    const OTHER_PLACE_REBIRTH = REBIRTH_FEATURE_UNLOCKS?.OTHER_PLACE || 1;
    
    const isBiomeUnlocked = userLevel >= BIOME_UNLOCK_LEVEL;
    const isOtherPlaceUnlocked = userRebirth >= OTHER_PLACE_REBIRTH;
    
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`open_buildings_${userId}`)
                .setLabel('🏗️ Farm Buildings')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`open_limitbreaker_${userId}`)
                .setLabel('⚡ Limit Breaker')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(isBiomeUnlocked ? `open_biome_${userId}` : `locked_biome_${userId}`)
                .setLabel(isBiomeUnlocked ? '🌍 Biome' : `🔒 Biome (Lv.${BIOME_UNLOCK_LEVEL})`)
                .setStyle(isBiomeUnlocked ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(isOtherPlaceUnlocked ? `open_otherplace_${userId}` : `locked_otherplace_${userId}`)
                .setLabel(isOtherPlaceUnlocked ? '🌌 Other Place' : '🔒 Other Place (♻️1)')
                .setStyle(isOtherPlaceUnlocked ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
    
    return row1;
}

function setupInteractionCollector(msg, userId, message, client, userLevel = 1, userRebirth = 0) {
    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (interaction) => {
        const ownership = checkButtonOwnership(interaction);
        if (!ownership.isOwner) {
            return interaction.reply({ content: ownership.message, ephemeral: true }).catch(() => {});
        }

        try {
            const { customId } = interaction;

            console.log('Interaction received:', customId);

            if (customId.startsWith('open_buildings_') || customId.startsWith('upgrade_') || customId.startsWith('building_close_')) {
                await handleBuildingInteraction(interaction, userId, client);
            } 
            else if (
                customId.startsWith('open_limitbreaker_') || 
                customId.startsWith('limitbreak_') ||
                customId.startsWith('fragment_use_')
            ) {
                await handleLimitBreakerInteraction(interaction, userId, message, client);
            }
            else if (customId.startsWith('limitbreak_back_')) {
                await refreshFarmStatus(interaction, userId, message, userLevel, userRebirth);
            }
            else if (customId.startsWith('open_biome_')) {
                // Show biome selection UI
                await handleBiomeOpen(interaction, userId, userLevel, userRebirth);
            }
            else if (customId.startsWith('locked_biome_')) {
                // Show locked message
                const BIOME_UNLOCK_LEVEL = FEATURE_UNLOCKS.BIOME_SYSTEM || 50;
                await interaction.reply({
                    embeds: [{
                        title: '🔒 Feature Locked',
                        description: `**Biome System** requires **Level ${BIOME_UNLOCK_LEVEL}** to unlock.\n\n` +
                                     '📈 Gain EXP by:\n' +
                                     '• Completing daily & weekly quests\n' +
                                     '• Rolling fumos in gacha\n' +
                                     '• Completing main quests\n\n' +
                                     'Keep playing to level up!',
                        color: 0xFF6B6B,
                        footer: { text: 'Use .level to check your progress' }
                    }],
                    ephemeral: true
                });
            }
            else if (customId.startsWith('open_otherplace_')) {
                // Show Other Place UI
                await handleOtherPlaceOpen(interaction, userId, userRebirth);
            }
            else if (customId.startsWith('otherplace_send_')) {
                await handleSendFumo(interaction, userId, userRebirth);
            }
            else if (customId.startsWith('otherplace_retrieve_')) {
                await handleRetrieveFumo(interaction, userId);
            }
            else if (customId.startsWith('otherplace_collect_')) {
                await handleCollectIncome(interaction, userId, userRebirth);
            }
            else if (customId.startsWith('otherplace_back_')) {
                await refreshFarmStatus(interaction, userId, message, userLevel, userRebirth);
            }
            else if (customId.startsWith('otherplace_select_')) {
                // Handle fumo selection from dropdown
                const parts = customId.split('_');
                const action = parts[2]; // 'send' or 'retrieve'
                const selected = interaction.values?.[0];
                if (selected) {
                    const fumoAction = selected.split('_')[0];
                    const fumoName = selected.substring(fumoAction.length + 1);
                    await handleFumoSelect(interaction, userId, fumoAction, fumoName, userRebirth);
                }
            }
            else if (customId.startsWith('locked_otherplace_')) {
                // Show locked message for Other Place
                await interaction.reply({
                    embeds: [{
                        title: '🔒 Feature Locked',
                        description: '**Other Place** requires **Rebirth 1** to unlock.\n\n' +
                                     '♻️ To rebirth:\n' +
                                     '• Reach Level 100\n' +
                                     '• Use `.rebirth` command\n\n' +
                                     'Rebirth resets progress but gives permanent bonuses!',
                        color: 0xFF6B6B,
                        footer: { text: 'Use .rebirth to check your rebirth status' }
                    }],
                    ephemeral: true
                });
            }
            else if (customId === 'biome_select') {
                // Handle biome selection from dropdown
                await handleBiomeChange(interaction, userId);
            }
            else if (customId === 'biome_back') {
                // Go back to farm status
                await refreshFarmStatus(interaction, userId, message, userLevel, userRebirth);
            }
        } catch (error) {
            console.error('Error in farmcheck button interaction:', error);
            console.error('CustomId:', interaction.customId);
            console.error('Stack:', error.stack);
            
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred while processing your request.',
                        ephemeral: true
                    });
                } else {
                    await interaction.followUp({
                        content: '❌ An error occurred while processing your request.',
                        ephemeral: true
                    });
                }
            } catch (err) {
                console.error('Failed to send error message:', err);
            }
        }
    });

    collector.on('end', async () => {
        try {
            await msg.edit({ components: [] });
        } catch (error) {
        }
    });
}

async function refreshFarmStatus(interaction, userId, message, userLevel = 1, userRebirth = 0) {
    // Defer immediately to prevent timeout during DB query
    await interaction.deferUpdate();

    const farmData = await getFarmStatusData(userId, message.author.username);
    const embed = createFarmStatusEmbed(farmData);
    const buttons = createMainButtons(userId, userLevel, userRebirth);

    await interaction.editReply({
        embeds: [embed],
        components: [buttons]
    });
}

async function handleBiomeOpen(interaction, userId, userLevel, userRebirth) {
    await interaction.deferUpdate();
    
    try {
        const { embed, components } = await createBiomeSelectEmbed(userId, userLevel, userRebirth);
        
        // Add a back button to return to farm status
        const backButton = new ButtonBuilder()
            .setCustomId('biome_back')
            .setLabel('⬅️ Back to Farm')
            .setStyle(ButtonStyle.Secondary);
        
        // Add back button to last row or create new row
        if (components.length > 0) {
            components[components.length - 1].addComponents(backButton);
        } else {
            components.push(new ActionRowBuilder().addComponents(backButton));
        }
        
        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        console.error('Error opening biome UI:', error);
        await interaction.followUp({
            content: '❌ Failed to load biome selection.',
            ephemeral: true
        });
    }
}