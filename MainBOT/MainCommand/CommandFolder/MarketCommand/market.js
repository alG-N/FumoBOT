const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { 
    createMainShopEmbed, 
    createMainShopButtons
} = require('../../Service/MarketService/MarketService/MarketUIService');
const {
    handleCoinShop,
    handleGemShop,
    handleGlobalShop,
    handleBackToMain,
    handleFumoSelection,
    handleConfirmPurchase,
    handleCancelPurchase,
    handleAddListing,
    handleRaritySelection,
    handleBaseFumoSelection,
    handleVariantSelection,
    handleCurrencySelection,
    handlePriceModal,
    handleConfirmListing,
    handleRemoveListing,
    handleRemoveListingSelect,
    handleRefreshGlobal
} = require('../../Service/MarketService/MarketService/MarketInteractionHandler');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isMarketCommand = message.content === '.market' || message.content === '.m';
        
        if (!isMarketCommand) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        await showMainShop(message);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

        const userId = interaction.user.id;

        try {
            if (interaction.customId.startsWith('coin_shop_')) {
                if (!checkButtonOwnership(interaction, 'coin_shop')) return;
                await handleCoinShop(interaction);
            } 
            else if (interaction.customId.startsWith('gem_shop_')) {
                if (!checkButtonOwnership(interaction, 'gem_shop')) return;
                await handleGemShop(interaction);
            } 
            else if (interaction.customId.startsWith('global_shop_')) {
                if (!checkButtonOwnership(interaction, 'global_shop')) return;
                await handleGlobalShop(interaction);
            } 
            else if (interaction.customId.startsWith('back_main_')) {
                if (!checkButtonOwnership(interaction, 'back_main')) return;
                await handleBackToMain(interaction);
            } 
            else if (interaction.customId.startsWith('select_fumo_coin_')) {
                if (!checkButtonOwnership(interaction, 'select_fumo_coin')) return;
                await handleFumoSelection(interaction, 'coin');
            } 
            else if (interaction.customId.startsWith('select_fumo_gem_')) {
                if (!checkButtonOwnership(interaction, 'select_fumo_gem')) return;
                await handleFumoSelection(interaction, 'gem');
            } 
            else if (interaction.customId.startsWith('confirm_purchase_')) {
                await handleConfirmPurchase(interaction);
            } 
            else if (interaction.customId.startsWith('cancel_purchase_')) {
                await handleCancelPurchase(interaction);
            } 
            else if (interaction.customId.startsWith('add_listing_')) {
                if (!checkButtonOwnership(interaction, 'add_listing')) return;
                await handleAddListing(interaction);
            } 
            else if (interaction.customId.startsWith('remove_listing_')) {
                if (!checkButtonOwnership(interaction, 'remove_listing')) return;
                await handleRemoveListing(interaction);
            } 
            else if (interaction.customId.startsWith('refresh_global_')) {
                if (!checkButtonOwnership(interaction, 'refresh_global')) return;
                await handleRefreshGlobal(interaction);
            } 
            else if (interaction.customId.startsWith('select_rarity_')) {
                await handleRaritySelection(interaction);
            } 
            else if (interaction.customId.startsWith('select_base_fumo_')) {
                await handleBaseFumoSelection(interaction);
            }
            else if (interaction.customId.startsWith('select_variant_')) {
                await handleVariantSelection(interaction);
            } 
            else if (interaction.customId.startsWith('select_currency_')) {
                await handleCurrencySelection(interaction);
            } 
            else if (interaction.customId.startsWith('price_modal_')) {
                await handlePriceModal(interaction);
            } 
            else if (interaction.customId.startsWith('confirm_listing_')) {
                await handleConfirmListing(interaction);
            } 
            else if (interaction.customId.startsWith('select_remove_listing_')) {
                await handleRemoveListingSelect(interaction);
            }
        } catch (error) {
            console.error('Market interaction error:', error);
            
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
};

async function showMainShop(message) {
    try {
        const embed = await createMainShopEmbed(message.author.id);
        const buttons = createMainShopButtons(message.author.id);
        await message.reply({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Main shop error:', error);
        await message.reply('❌ Failed to load shop. Please try again.');
    }
}