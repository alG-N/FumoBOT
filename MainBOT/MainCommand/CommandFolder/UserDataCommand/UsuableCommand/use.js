const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkButtonOwnership, parseCustomId, buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { RARITY_ORDER } = require('../../../Configuration/itemConfig');
const UseService = require('../../../Service/UserDataService/UseService/UseCommandService');

async function handleUseCommand(message) {
    const restriction = checkRestrictions(message.author.id);
    if (restriction.blocked) {
        return message.reply({ embeds: [restriction.embed] });
    }

    const userId = message.author.id;
    const usableItems = await UseService.getUsableInventory(userId);

    if (usableItems.length === 0) {
        return message.reply('❌ You don\'t have any usable items in your inventory.');
    }

    const itemsByRarity = UseService.groupItemsByRarity(usableItems);
    const availableRarities = RARITY_ORDER.filter(rarity => itemsByRarity[rarity].length > 0);

    if (availableRarities.length === 0) {
        return message.reply('❌ You don\'t have any usable items in your inventory.');
    }

    const { embed, components } = UseService.buildRaritySelection(userId, availableRarities, itemsByRarity);
    await message.reply({ embeds: [embed], components });
}

async function handleRaritySelection(interaction) {
    const userId = interaction.user.id;
    const selectedRarity = interaction.values[0].replace('use_rarity_', '');

    const usableItems = await UseService.getUsableInventoryByRarity(userId, selectedRarity);

    if (usableItems.length === 0) {
        return interaction.update({
            content: `❌ No usable items found for rarity: ${selectedRarity}`,
            embeds: [],
            components: []
        });
    }

    const totalPages = Math.ceil(usableItems.length / 25);
    const { embed, components } = UseService.buildItemSelectionPage(userId, selectedRarity, usableItems, 0, totalPages);
    
    await interaction.update({ embeds: [embed], components });
}

async function handleItemSelection(interaction) {
    const { additionalData } = parseCustomId(interaction.customId);
    const rarity = additionalData?.rarity || additionalData?.r;

    if (!rarity) {
        return interaction.update({
            content: '❌ Invalid rarity data.',
            embeds: [],
            components: []
        });
    }

    const selectedIndex = parseInt(interaction.values[0].replace('use_item_', ''));
    const userId = interaction.user.id;
    const usableItems = await UseService.getUsableInventoryByRarity(userId, rarity);
    const selectedItem = usableItems[selectedIndex];

    if (!selectedItem) {
        return interaction.update({
            content: '❌ Invalid item selection.',
            embeds: [],
            components: []
        });
    }

    const { itemName, quantity } = selectedItem;
    const isOneTimeUse = UseService.ONE_TIME_USE_ITEMS.has(itemName);

    if (isOneTimeUse || quantity === 1) {
        await showConfirmation(interaction, itemName, 1, userId);
    } else {
        await showQuantityInput(interaction, itemName, quantity, userId);
    }
}

async function showQuantityInput(interaction, itemName, maxQuantity, userId) {
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🔢 Use Item - Select Quantity')
        .setDescription(
            `**Item:** ${itemName}\n` +
            `**Available:** ${maxQuantity}\n\n` +
            `How many would you like to use?\n` +
            `Reply with a number between **1** and **${maxQuantity}**.`
        )
        .setFooter({ text: 'You have 30 seconds to respond' })
        .setTimestamp();

    const cancelButton = new ButtonBuilder()
        .setCustomId(buildSecureCustomId('use_cancel', userId))
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(cancelButton);
    await interaction.update({ embeds: [embed], components: [row] });

    const filter = m => m.author.id === userId && !isNaN(m.content);
    
    try {
        const collected = await interaction.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: 30000, 
            errors: ['time'] 
        });

        const inputQuantity = parseInt(collected.first().content);
        collected.first().delete().catch(() => {});

        if (inputQuantity <= 0 || inputQuantity > maxQuantity) {
            return interaction.editReply({
                content: `❌ Invalid quantity. Please enter a number between 1 and ${maxQuantity}.`,
                embeds: [],
                components: []
            });
        }

        await showConfirmation(interaction, itemName, inputQuantity, userId);
    } catch (error) {
        return interaction.editReply({
            content: '⏱️ Quantity input timed out. Use command cancelled.',
            embeds: [],
            components: []
        }).catch(() => {});
    }
}

async function showConfirmation(interaction, itemName, quantity, userId) {
    const { embed, components } = UseService.buildConfirmation(userId, itemName, quantity);

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [embed], components });
    } else {
        await interaction.update({ embeds: [embed], components });
    }
}

async function handleConfirmation(interaction) {
    const { additionalData } = parseCustomId(interaction.customId);
    
    const itemName = additionalData?.itemName || additionalData?.i;
    const quantity = additionalData?.quantity || additionalData?.q || 1;
    
    if (!itemName) {
        return interaction.update({
            content: '❌ Invalid confirmation data.',
            embeds: [],
            components: []
        });
    }

    const userId = interaction.user.id;

    await interaction.update({
        content: '⏳ Processing item use...',
        embeds: [],
        components: []
    });

    const messageProxy = {
        author: interaction.user,
        reply: async (content) => {
            if (typeof content === 'string') {
                return interaction.followUp({ content, ephemeral: false });
            }
            return interaction.followUp({ ...content, ephemeral: false });
        },
        channel: interaction.channel
    };

    try {
        await UseService.executeItemUse(userId, itemName, quantity, messageProxy);
        
        setTimeout(() => {
            interaction.deleteReply().catch(() => {});
        }, 500);
        
    } catch (error) {
        console.error('[USE_COMMAND] Error:', error);
        return interaction.editReply({
            content: `❌ Failed to use **${itemName}**. Your items have been returned.\n\n**Error:** ${error.message}`,
            embeds: [],
            components: []
        }).catch(() => {});
    }
}

async function handleCancellation(interaction) {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Cancelled')
        .setDescription('Item use cancelled. No items were consumed.')
        .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
}

async function handlePagination(interaction, direction) {
    const { additionalData } = parseCustomId(interaction.customId);
    let currentPage = additionalData?.page || additionalData?.p || 0;
    const rarity = additionalData?.rarity || additionalData?.r;

    if (!rarity) {
        return interaction.reply({
            content: '❌ Invalid pagination data.',
            ephemeral: true
        });
    }

    currentPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

    const userId = interaction.user.id;
    const usableItems = await UseService.getUsableInventoryByRarity(userId, rarity);
    const totalPages = Math.ceil(usableItems.length / 25);

    currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));

    const { embed, components } = UseService.buildItemSelectionPage(userId, rarity, usableItems, currentPage, totalPages);
    await interaction.update({ embeds: [embed], components });
}

async function handleBackToRarity(interaction) {
    const userId = interaction.user.id;
    const usableItems = await UseService.getUsableInventory(userId);

    if (usableItems.length === 0) {
        return interaction.update({
            content: '❌ You don\'t have any usable items in your inventory.',
            embeds: [],
            components: []
        });
    }

    const itemsByRarity = UseService.groupItemsByRarity(usableItems);
    const availableRarities = RARITY_ORDER.filter(rarity => itemsByRarity[rarity].length > 0);

    const { embed, components } = UseService.buildRaritySelection(userId, availableRarities, itemsByRarity);
    await interaction.update({ embeds: [embed], components });
}

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.match(/^\.u(se)?$/i)) return;
            
            await handleUseCommand(message);
        } catch (error) {
            console.error('[USE_COMMAND] Error:', error);
            message.reply('❌ An unexpected error occurred.').catch(() => {});
        }
    });

    client.on('interactionCreate', async (interaction) => {
        try {
            if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

            const customId = interaction.customId;
            if (!customId.startsWith('use_')) return;

            const isOwner = checkButtonOwnership(interaction);
            
            if (!isOwner) {
                return interaction.reply({
                    content: "❌ You can't use someone else's item menu.",
                    ephemeral: true
                }).catch(() => {});
            }

            if (customId.startsWith('use_rarity_select')) {
                await handleRaritySelection(interaction);
            } else if (customId.startsWith('use_item_select')) {
                await handleItemSelection(interaction);
            } else if (customId.startsWith('use_confirm')) {
                await handleConfirmation(interaction);
            } else if (customId.startsWith('use_cancel')) {
                await handleCancellation(interaction);
            } else if (customId.startsWith('use_item_page_next')) {
                await handlePagination(interaction, 'next');
            } else if (customId.startsWith('use_item_page_prev')) {
                await handlePagination(interaction, 'prev');
            } else if (customId.startsWith('use_back_to_rarity')) {
                await handleBackToRarity(interaction);
            }
        } catch (error) {
            console.error('[USE_COMMAND] Interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred.',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    });

    console.log('✅ Use command handler registered');
};