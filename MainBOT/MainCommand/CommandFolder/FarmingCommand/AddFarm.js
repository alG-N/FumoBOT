const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, Colors } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { 
    addMultipleFumosToFarm, 
    getAvailableFumosByRarityAndTrait 
} = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { logToDiscord, LogLevel } = require('../../Core/logger');
const { VALID_RARITIES, VALID_TRAITS } = require('../../Service/FarmingService/FarmingParserService');

const activeSelections = new Map();

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.addfarm') && !message.content.startsWith('.af')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            // Show rarity selection menu
            const rarityEmbed = new EmbedBuilder()
                .setTitle('🌾 Add Fumos to Farm - Step 1/3')
                .setDescription('**Select a rarity to farm:**\n\nChoose which rarity of Fumos you want to add to your farm.')
                .setColor(Colors.Blue)
                .setFooter({ text: 'You have 60 seconds to make a selection' });

            const rarityMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`addfarm_rarity_${userId}`)
                        .setPlaceholder('Choose a rarity...')
                        .addOptions(
                            VALID_RARITIES.map(rarity => ({
                                label: rarity,
                                value: rarity,
                                description: `Add ${rarity} Fumos to farm`
                            }))
                        )
                );

            const msg = await message.reply({
                embeds: [rarityEmbed],
                components: [rarityMenu]
            });

            // Initialize selection state
            activeSelections.set(userId, {
                messageId: msg.id,
                stage: 'RARITY',
                rarity: null,
                trait: null
            });

            // Set timeout to clean up
            setTimeout(() => {
                if (activeSelections.has(userId)) {
                    activeSelections.delete(userId);
                    msg.edit({ components: [] }).catch(() => {});
                }
            }, 60000);

        } catch (error) {
            console.error('Error in .addfarm:', error);
            await logToDiscord(client, `Error in .addfarm for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong.')]
            });
        }
    });

    // Handle rarity selection
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('addfarm_rarity_')) return;

        const userId = interaction.user.id;
        const selection = activeSelections.get(userId);

        if (!selection) {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            await interaction.deferUpdate();

            const selectedRarity = interaction.values[0];
            selection.rarity = selectedRarity;
            selection.stage = 'TRAIT';

            // Show trait selection menu
            const traitEmbed = new EmbedBuilder()
                .setTitle('🌾 Add Fumos to Farm - Step 2/3')
                .setDescription(
                    `**Selected Rarity:** ${selectedRarity}\n\n` +
                    `**Select trait type:**\n` +
                    `• **Base** - Regular Fumos (no trait)\n` +
                    `• **SHINY** - ✨ Shiny variants (2x multiplier)\n` +
                    `• **alG** - 🌟 AlterGolden variants (100x multiplier)`
                )
                .setColor(Colors.Blue)
                .setFooter({ text: 'You have 60 seconds to make a selection' });

            const traitMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`addfarm_trait_${userId}`)
                        .setPlaceholder('Choose a trait type...')
                        .addOptions([
                            {
                                label: 'Base (No Trait)',
                                value: 'Base',
                                description: 'Regular Fumos without special traits'
                            },
                            {
                                label: '✨ SHINY',
                                value: 'SHINY',
                                description: 'Shiny variants (2x multiplier)'
                            },
                            {
                                label: '🌟 alG',
                                value: 'alG',
                                description: 'AlterGolden variants (100x multiplier)'
                            }
                        ])
                );

            await interaction.editReply({
                embeds: [traitEmbed],
                components: [traitMenu]
            });

        } catch (error) {
            console.error('Error handling rarity selection:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your selection.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    // Handle trait selection
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('addfarm_trait_')) return;

        const userId = interaction.user.id;
        const selection = activeSelections.get(userId);

        if (!selection || selection.stage !== 'TRAIT') {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            await interaction.deferUpdate();

            const selectedTrait = interaction.values[0];
            selection.trait = selectedTrait;
            selection.stage = 'FUMO_LIST';

            // Get available fumos
            const availableFumos = await getAvailableFumosByRarityAndTrait(userId, selection.rarity, selectedTrait);

            if (availableFumos.length === 0) {
                activeSelections.delete(userId);
                return interaction.editReply({
                    embeds: [createErrorEmbed(`🔍 No ${selectedTrait === 'Base' ? '' : selectedTrait + ' '}${selection.rarity} Fumos found in your inventory.`)],
                    components: []
                });
            }

            // Show fumo selection menu
            const fumoListEmbed = new EmbedBuilder()
                .setTitle('🌾 Add Fumos to Farm - Step 3/3')
                .setDescription(
                    `**Selected Rarity:** ${selection.rarity}\n` +
                    `**Selected Trait:** ${selectedTrait === 'Base' ? 'No Trait' : selectedTrait}\n\n` +
                    `**Select which Fumo to add:**`
                )
                .setColor(Colors.Green)
                .setFooter({ text: 'Select a Fumo from the dropdown menu' });

            const fumoSelectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`addfarm_fumo_${userId}`)
                        .setPlaceholder('Choose a Fumo to add...')
                        .addOptions(
                            availableFumos.slice(0, 25).map(f => ({
                                label: f.baseName,
                                value: f.fullName,
                                description: `${f.count} available in inventory`
                            }))
                        )
                );

            await interaction.editReply({
                embeds: [fumoListEmbed],
                components: [fumoSelectMenu]
            });

            // Store available fumos for validation
            selection.availableFumos = availableFumos;

        } catch (error) {
            console.error('Error handling trait selection:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your selection.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    // Handle fumo selection
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('addfarm_fumo_')) return;

        const userId = interaction.user.id;
        const selection = activeSelections.get(userId);

        if (!selection || selection.stage !== 'FUMO_LIST') {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            const selectedFumoName = interaction.values[0];
            const matchingFumo = selection.availableFumos.find(f => f.fullName === selectedFumoName);

            if (!matchingFumo) {
                return interaction.reply({
                    content: '❌ Fumo not found.',
                    ephemeral: true
                });
            }

            // Show modal for quantity input
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
            
            const modal = new ModalBuilder()
                .setCustomId(`addfarm_quantity_${userId}_${selectedFumoName}`)
                .setTitle('Enter Quantity to Add');

            const quantityInput = new TextInputBuilder()
                .setCustomId('quantity')
                .setLabel(`How many ${matchingFumo.baseName} to add?`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Max: ${matchingFumo.count}`)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(10);

            const row = new ActionRowBuilder().addComponents(quantityInput);
            modal.addComponents(row);

            await interaction.showModal(modal);

            // Store selected fumo info
            selection.selectedFumo = matchingFumo;

        } catch (error) {
            console.error('Error handling fumo selection:', error);
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    // Handle quantity modal submission
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('addfarm_quantity_')) return;

        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const fumoName = parts.slice(3).join('_');

        const selection = activeSelections.get(userId);

        if (!selection) {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const quantityStr = interaction.fields.getTextInputValue('quantity');
            const quantity = parseInt(quantityStr, 10);

            if (isNaN(quantity) || quantity <= 0) {
                return interaction.editReply({
                    content: '❌ Please enter a valid number greater than 0.'
                });
            }

            if (quantity > selection.selectedFumo.count) {
                return interaction.editReply({
                    content: `❌ You only have ${selection.selectedFumo.count} ${selection.selectedFumo.displayName} but tried to add ${quantity}.`
                });
            }

            // Add fumos to farm
            const result = await addMultipleFumosToFarm(userId, selection.selectedFumo.fullName, quantity);

            if (!result.success) {
                const errorMessages = {
                    FARM_FULL: `🚜 Your farm is full. Max ${result.limit} Fumos allowed.`,
                    INSUFFICIENT_INVENTORY: `🔍 You don't have enough ${selection.selectedFumo.displayName} in your inventory.`
                };

                return interaction.editReply({
                    content: errorMessages[result.error] || 'Failed to add fumos.'
                });
            }

            await logToDiscord(
                client,
                `User ${interaction.user.tag} added ${quantity}x ${selection.selectedFumo.fullName} to farm`,
                null,
                LogLevel.ACTIVITY
            );

            activeSelections.delete(userId);

            // Update the original message
            const originalMessage = await interaction.message.fetch();
            await originalMessage.edit({
                embeds: [createSuccessEmbed(`✅ Added ${quantity}x ${selection.selectedFumo.displayName} to your farm!`)],
                components: []
            });

            await interaction.editReply({
                content: `✅ Successfully added ${quantity}x ${selection.selectedFumo.displayName} to your farm!`
            });

        } catch (error) {
            console.error('Error adding fumos to farm:', error);
            await logToDiscord(client, `Error in fumo addition for ${interaction.user.tag}`, error, LogLevel.ERROR);

            await interaction.editReply({
                content: '⚠️ Something went wrong.'
            }).catch(() => {});
        }
    });
};