const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, Colors, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle  } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { 
    removeMultipleFumosFromFarm,
    getFarmingFumosByRarityAndTrait,
    removeAll
} = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { logToDiscord, LogLevel } = require('../../Core/logger');
const { VALID_RARITIES, VALID_TRAITS } = require('../../Service/FarmingService/FarmingParserService');

const activeRemovals = new Map();

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.endfarm') && !message.content.startsWith('.ef')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            const input = message.content.replace(/^\.endfarm\s+|^\.ef\s+/i, '').trim();
            if (input.toLowerCase() === 'all') {
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Confirm Remove All')
                    .setDescription('Are you sure you want to remove **ALL** Fumos from your farm?')
                    .setColor(Colors.Orange);

                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`endfarm_confirm_all_${userId}`)
                            .setLabel('✅ Yes, Remove All')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId(`endfarm_cancel_${userId}`)
                            .setLabel('❌ Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    );

                return message.reply({
                    embeds: [confirmEmbed],
                    components: [confirmRow]
                });
            }

            const rarityEmbed = new EmbedBuilder()
                .setTitle('🛑 Remove Fumos from Farm - Step 1/3')
                .setDescription('**Select a rarity to remove:**\n\nChoose which rarity of Fumos you want to remove from your farm.')
                .setColor(Colors.Red)
                .setFooter({ text: 'You have 60 seconds to make a selection' });

            const rarityMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`endfarm_rarity_${userId}`)
                        .setPlaceholder('Choose a rarity...')
                        .addOptions(
                            VALID_RARITIES.map(rarity => ({
                                label: rarity,
                                value: rarity,
                                description: `Remove ${rarity} Fumos from farm`
                            }))
                        )
                );

            const msg = await message.reply({
                embeds: [rarityEmbed],
                components: [rarityMenu]
            });

            activeRemovals.set(userId, {
                messageId: msg.id,
                stage: 'RARITY',
                rarity: null,
                trait: null
            });

            setTimeout(() => {
                if (activeRemovals.has(userId)) {
                    activeRemovals.delete(userId);
                    msg.edit({ components: [] }).catch(() => {});
                }
            }, 60000);

        } catch (error) {
            console.error('Error in .endfarm:', error);
            await logToDiscord(client, `Error in .endfarm for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong.')]
            });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('endfarm_confirm_all_')) return;

        if (!await checkButtonOwnership(interaction)) return;

        try {
            await interaction.deferUpdate();

            const userId = interaction.user.id;
            await removeAll(userId);

            await logToDiscord(
                client,
                `User ${interaction.user.tag} removed all Fumos from farm`,
                null,
                LogLevel.ACTIVITY
            );

            await interaction.editReply({
                embeds: [createSuccessEmbed('✅ Successfully removed all Fumos from the farm.')],
                components: []
            });

        } catch (error) {
            console.error('Error removing all fumos:', error);
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('endfarm_cancel_')) return;

        if (!await checkButtonOwnership(interaction)) return;

        await interaction.update({
            embeds: [createErrorEmbed('❌ Cancelled.')],
            components: []
        });
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('endfarm_rarity_')) return;

        const userId = interaction.user.id;
        const removal = activeRemovals.get(userId);

        if (!removal) {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            await interaction.deferUpdate();

            const selectedRarity = interaction.values[0];
            removal.rarity = selectedRarity;
            removal.stage = 'TRAIT';

            const traitEmbed = new EmbedBuilder()
                .setTitle('🛑 Remove Fumos from Farm - Step 2/3')
                .setDescription(
                    `**Selected Rarity:** ${selectedRarity}\n\n` +
                    `**Select trait type:**\n` +
                    `• **Base** - Regular Fumos (no trait)\n` +
                    `• **SHINY** - ✨ Shiny variants\n` +
                    `• **alG** - 🌟 AlterGolden variants`
                )
                .setColor(Colors.Red)
                .setFooter({ text: 'You have 60 seconds to make a selection' });

            const traitMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`endfarm_trait_${userId}`)
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
                                description: 'Shiny variants'
                            },
                            {
                                label: '🌟 alG',
                                value: 'alG',
                                description: 'AlterGolden variants'
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

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('endfarm_trait_')) return;

        const userId = interaction.user.id;
        const removal = activeRemovals.get(userId);

        if (!removal || removal.stage !== 'TRAIT') {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            await interaction.deferUpdate();

            const selectedTrait = interaction.values[0];
            removal.trait = selectedTrait;
            removal.stage = 'FUMO_LIST';

            const farmingFumos = await getFarmingFumosByRarityAndTrait(userId, removal.rarity, selectedTrait);

            if (farmingFumos.length === 0) {
                activeRemovals.delete(userId);
                return interaction.editReply({
                    embeds: [createErrorEmbed(`🔍 No ${selectedTrait === 'Base' ? '' : selectedTrait + ' '}${removal.rarity} Fumos found in your farm.`)],
                    components: []
                });
            }

            const fumoListEmbed = new EmbedBuilder()
                .setTitle('🛑 Remove Fumos from Farm - Step 3/3')
                .setDescription(
                    `**Selected Rarity:** ${removal.rarity}\n` +
                    `**Selected Trait:** ${selectedTrait === 'Base' ? 'No Trait' : selectedTrait}\n\n` +
                    `**Select which Fumo to remove:**`
                )
                .setColor(Colors.Red)
                .setFooter({ text: 'Select a Fumo from the dropdown menu' });

            const fumoSelectMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`endfarm_fumo_${userId}`)
                        .setPlaceholder('Choose a Fumo to remove...')
                        .addOptions(
                            farmingFumos.slice(0, 25).map(f => ({
                                label: f.baseName,
                                value: f.fullName,
                                description: `${f.quantity} currently farming`
                            }))
                        )
                );

            await interaction.editReply({
                embeds: [fumoListEmbed],
                components: [fumoSelectMenu]
            });

            removal.farmingFumos = farmingFumos;

        } catch (error) {
            console.error('Error handling trait selection:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your selection.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.customId.startsWith('endfarm_fumo_')) return;

        const userId = interaction.user.id;
        const removal = activeRemovals.get(userId);

        if (!removal || removal.stage !== 'FUMO_LIST') {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (!await checkButtonOwnership(interaction)) return;

        try {
            const selectedFumoName = interaction.values[0];
            const matchingFumo = removal.farmingFumos.find(f => f.fullName === selectedFumoName);

            if (!matchingFumo) {
                return interaction.reply({
                    content: '❌ Fumo not found in farm.',
                    ephemeral: true
                });
            }
            
            const modal = new ModalBuilder()
                .setCustomId(`endfarm_quantity_${userId}_${selectedFumoName}`)
                .setTitle('Enter Quantity to Remove');

            const quantityInput = new TextInputBuilder()
                .setCustomId('quantity')
                .setLabel(`How many ${matchingFumo.baseName} to remove?`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Max: ${matchingFumo.quantity} (or type "all")`)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(10);

            const row = new ActionRowBuilder().addComponents(quantityInput);
            modal.addComponents(row);

            await interaction.showModal(modal);

            removal.selectedFumo = matchingFumo;

        } catch (error) {
            console.error('Error handling fumo selection:', error);
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            }).catch(() => {});
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('endfarm_quantity_')) return;

        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const fumoName = parts.slice(3).join('_');

        const removal = activeRemovals.get(userId);

        if (!removal) {
            return interaction.reply({
                content: '❌ This selection has expired. Please run the command again.',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            const quantityStr = interaction.fields.getTextInputValue('quantity').trim().toLowerCase();
            const quantity = quantityStr === 'all' ? removal.selectedFumo.quantity : parseInt(quantityStr, 10);

            if (quantityStr !== 'all' && (isNaN(quantity) || quantity <= 0)) {
                return interaction.editReply({
                    content: '❌ Please enter a valid number greater than 0 or "all".'
                });
            }

            if (quantity > removal.selectedFumo.quantity) {
                return interaction.editReply({
                    content: `❌ You only have ${removal.selectedFumo.quantity} ${removal.selectedFumo.displayName} in farm but tried to remove ${quantity}.`
                });
            }

            const result = await removeMultipleFumosFromFarm(userId, removal.selectedFumo.fullName, quantity);

            if (!result.success) {
                return interaction.editReply({
                    content: 'Failed to remove fumos.'
                });
            }

            await logToDiscord(
                client,
                `User ${interaction.user.tag} removed ${quantity}x ${removal.selectedFumo.fullName} from farm`,
                null,
                LogLevel.ACTIVITY
            );

            activeRemovals.delete(userId);

            const originalMessage = await interaction.message.fetch();
            await originalMessage.edit({
                embeds: [createSuccessEmbed(`✅ Removed ${quantity}x ${removal.selectedFumo.displayName} from your farm!`)],
                components: []
            });

            await interaction.editReply({
                content: `✅ Successfully removed ${quantity}x ${removal.selectedFumo.displayName} from your farm!`
            });

        } catch (error) {
            console.error('Error removing fumos from farm:', error);
            await logToDiscord(client, `Error in fumo removal for ${interaction.user.tag}`, error, LogLevel.ERROR);

            await interaction.editReply({
                content: '⚠️ Something went wrong.'
            }).catch(() => {});
        }
    });
};