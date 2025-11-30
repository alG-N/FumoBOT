const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { getFarmStatusData, createFarmStatusEmbed } = require('../../Service/FarmingService/FarmStatusHelper');
const { handleBuildingInteraction } = require('../../Service/FarmingService/BuildingService/BuildingInteractionHandler');
const { handleLimitBreakerInteraction } = require('../../Service/FarmingService/LimitBreakService/LimitBreakInteractionHandler');

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
            const farmData = await getFarmStatusData(userId, message.author.username);
            
            if (!farmData.hasFumos) {
                return message.reply({
                    embeds: [createErrorEmbed('🤷‍♂️ No Fumos are currently farming. Time to get started!')]
                });
            }

            const embed = createFarmStatusEmbed(farmData);
            const buttons = createMainButtons(userId);

            const msg = await message.reply({
                embeds: [embed],
                components: [buttons]
            });

            setupInteractionCollector(msg, userId, message, client);

        } catch (error) {
            console.error('Error in .farmcheck:', error);
            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong while checking your farm.')]
            });
        }
    });
};

function createMainButtons(userId) {
    return new ActionRowBuilder()
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
}

function setupInteractionCollector(msg, userId, message, client) {
    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (interaction) => {
        if (!await checkButtonOwnership(interaction)) return;

        try {
            const { customId } = interaction;

            console.log('Interaction received:', customId);

            if (customId.startsWith('open_buildings_') || customId.startsWith('upgrade_') || customId.startsWith('building_close_')) {
                await handleBuildingInteraction(interaction, userId, client);
            } 
            else if (customId.startsWith('open_limitbreaker_') || customId.startsWith('limitbreak_')) {
                await handleLimitBreakerInteraction(interaction, userId, message, client);
            }
            else if (customId.startsWith('limitbreak_back_')) {
                await refreshFarmStatus(interaction, userId, message);
            }
        } catch (error) {
            console.error('Error in farmcheck button interaction:', error);
            console.error('CustomId:', interaction.customId);
            console.error('Stack:', error.stack);
            
            // Try to send error message to user
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
            // Message might be deleted
        }
    });
}

async function refreshFarmStatus(interaction, userId, message) {
    const farmData = await getFarmStatusData(userId, message.author.username);
    const embed = createFarmStatusEmbed(farmData);
    const buttons = createMainButtons(userId);

    await interaction.update({
        embeds: [embed],
        components: [buttons]
    });
}