const SellService = require('../../../Service/UserDataService/SellService/SellService');
const SellInteractiveService = require('../../../Service/UserDataService/SellService/SellInteractiveService');
const { checkRestrictions } = require('../../../Middleware/restrictions');

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.sell') && message.content !== '.s' && !message.content.startsWith('.s ')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.split(' ').slice(1);

        try {
            // If no arguments, open interactive menu
            if (args.length === 0) {
                await SellInteractiveService.openSellMenu(message, message.author.id);
            } else {
                // Legacy command support for backwards compatibility
                await SellService.handleSellCommand(message, args);
            }
        } catch (error) {
            console.error('[Sell Command] Unexpected error:', error);
            message.reply('An unexpected error occurred. Please contact the developer.');
        }
    });

    // Handle interactive sell interactions
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
        
        const { customId } = interaction;
        const userId = interaction.user.id;

        // Handle sell-related interactions
        if (customId.startsWith('sell_') || customId.startsWith('sell_quantity_modal_')) {
            if (!SellInteractiveService.hasActiveSession(userId) && !customId.includes('confirm') && !customId.includes('cancel')) {
                // Session might have expired but buttons still work
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({
                        content: '❌ Session expired. Please run `.sell` again.',
                        ephemeral: true
                    });
                }
                return;
            }

            // Handle modal submissions
            if (interaction.isModalSubmit() && customId.startsWith('sell_quantity_modal_')) {
                await handleSellQuantityModal(interaction, userId);
                return;
            }

            // Handle bulk sell confirmations
            if (customId.startsWith('sell_confirm_bulk_')) {
                await handleBulkSellConfirm(interaction, userId);
                return;
            }

            if (customId.startsWith('sell_cancel_bulk_')) {
                await handleBulkSellCancel(interaction, userId);
                return;
            }
        }
    });
};

/**
 * Handle quantity modal submission for single sell
 */
async function handleSellQuantityModal(interaction, userId) {
    const SellTransactionService = require('../../../Service/UserDataService/SellService/SellTransactionService');
    const SellValidationService = require('../../../Service/UserDataService/SellService/SellValidationService');
    const { EmbedBuilder } = require('discord.js');
    const { formatNumber } = require('../../../Ultility/formatting');
    const db = require('../../../Core/database');

    await interaction.deferUpdate();

    try {
        const quantityStr = interaction.fields.getTextInputValue('sell_quantity');
        const fumoName = interaction.fields.getTextInputValue('sell_fumo_name');
        const quantity = parseInt(quantityStr, 10);

        if (isNaN(quantity) || quantity <= 0) {
            return interaction.followUp({
                content: '❌ Please enter a valid positive number.',
                ephemeral: true
            });
        }

        // Validate
        const validation = await SellValidationService.validateSingleSell(userId, fumoName, quantity);
        if (!validation.valid) {
            return interaction.followUp({
                content: `❌ ${validation.error}: ${JSON.stringify(validation.details)}`,
                ephemeral: true
            });
        }

        // Calculate and execute
        const calculation = await SellTransactionService.calculateSellReward(userId, fumoName, quantity);
        const result = await SellTransactionService.executeSingleSell(
            userId,
            fumoName,
            quantity,
            calculation.reward,
            calculation.rewardType
        );

        if (!result.success) {
            return interaction.followUp({
                content: '❌ Transaction failed. Please try again.',
                ephemeral: true
            });
        }

        // Success - refresh the menu
        const inventory = await SellInteractiveService.getUserSellableInventory(userId);
        const embed = await SellInteractiveService.createMainMenuEmbed(userId, inventory);
        const components = SellInteractiveService.createMainMenuComponents(userId, inventory);

        await interaction.editReply({ embeds: [embed], components });

        // Send success message
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Sale Complete!')
            .setColor(0x00FF00)
            .setDescription(
                `Successfully sold **${quantity}x ${fumoName}**!\n\n` +
                `💰 **Received:** ${formatNumber(calculation.reward)} ${calculation.rewardType}`
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [successEmbed],
            ephemeral: true
        });

    } catch (error) {
        console.error('[Sell] Modal error:', error);
        await interaction.followUp({
            content: '❌ An error occurred during the sale.',
            ephemeral: true
        });
    }
}

/**
 * Handle bulk sell confirmation
 */
async function handleBulkSellConfirm(interaction, userId) {
    const SellTransactionService = require('../../../Service/UserDataService/SellService/SellTransactionService');
    const { EmbedBuilder } = require('discord.js');
    const { formatNumber } = require('../../../Ultility/formatting');

    await interaction.deferUpdate();

    try {
        const parts = interaction.customId.split('_');
        const rarity = parts[3];
        const trait = parts[4];
        const tag = trait === 'shiny' ? '[✨SHINY]' : trait === 'alg' ? '[🌟alG]' : null;

        // Re-fetch inventory to ensure current state
        const inventory = await SellInteractiveService.getUserSellableInventory(userId);
        const traitData = inventory.grouped[rarity]?.[trait] || [];

        if (traitData.length === 0) {
            return interaction.followUp({
                content: '❌ No items to sell! They may have been sold already.',
                ephemeral: true
            });
        }

        // Calculate and execute
        const fumos = traitData.map(f => ({ fumoName: f.name, count: f.count }));
        const calculation = await SellTransactionService.calculateBulkSellReward(userId, rarity, tag, fumos);
        const result = await SellTransactionService.executeBulkSell(
            userId,
            fumos,
            calculation.totalReward,
            calculation.rewardType,
            tag
        );

        if (!result.success) {
            return interaction.followUp({
                content: '❌ Transaction failed. Please try again.',
                ephemeral: true
            });
        }

        // Refresh the menu
        const newInventory = await SellInteractiveService.getUserSellableInventory(userId);
        const embed = await SellInteractiveService.createMainMenuEmbed(userId, newInventory);
        const components = SellInteractiveService.createMainMenuComponents(userId, newInventory);

        await interaction.editReply({ embeds: [embed], components });

        // Success message
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Bulk Sale Complete!')
            .setColor(0x00FF00)
            .setDescription(
                `Successfully sold all **${rarity}${tag ? ` ${tag}` : ''}** Fumos!\n\n` +
                `📦 **Sold:** ${calculation.totalFumos} Fumos\n` +
                `💰 **Received:** ${formatNumber(calculation.totalReward)} ${calculation.rewardType}`
            )
            .setTimestamp();

        await interaction.followUp({
            embeds: [successEmbed],
            ephemeral: true
        });

    } catch (error) {
        console.error('[Sell] Bulk confirm error:', error);
        await interaction.followUp({
            content: '❌ An error occurred during the bulk sale.',
            ephemeral: true
        });
    }
}

/**
 * Handle bulk sell cancel
 */
async function handleBulkSellCancel(interaction, userId) {
    await interaction.deferUpdate();

    try {
        const parts = interaction.customId.split('_');
        const rarity = parts[3];
        const trait = parts[4];

        // Go back to rarity detail view
        const inventory = await SellInteractiveService.getUserSellableInventory(userId);
        const { embed, totalPages } = await SellInteractiveService.createRarityDetailEmbed(userId, rarity, trait, inventory, 0);
        const components = SellInteractiveService.createRarityDetailComponents(userId, rarity, trait, inventory, 0, totalPages);
        
        await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
        console.error('[Sell] Cancel error:', error);
    }
}