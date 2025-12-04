const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get } = require('../../../Core/database');
const { validateGlobalPurchase, processGlobalPurchase } = require('./MarketPurchaseService');
const { notifySellerOfSale } = require('./MarketStorageService');
const { createPurchaseConfirmEmbed, createPurchaseSuccessEmbed, createErrorEmbed } = require('./MarketUIService');

async function handleGlobalPurchaseSelect(interaction) {
    try {
        const listingId = parseInt(interaction.values[0]);

        if (isNaN(listingId)) {
            return interaction.reply({
                content: '❌ Invalid selection.',
                ephemeral: true
            });
        }

        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ?`,
            [listingId]
        );

        if (!listing) {
            return interaction.reply({
                content: '❌ This listing is no longer available.',
                ephemeral: true
            });
        }

        if (listing.userId === interaction.user.id) {
            return interaction.reply({
                content: '❌ You cannot buy your own listing.',
                ephemeral: true
            });
        }

        const coinValidation = listing.coinPrice ? await validateGlobalPurchase(interaction.user.id, listing, 'coins') : null;
        const gemValidation = listing.gemPrice ? await validateGlobalPurchase(interaction.user.id, listing, 'gems') : null;

        const canBuyWithCoins = coinValidation?.valid;
        const canBuyWithGems = gemValidation?.valid;

        if (!canBuyWithCoins && !canBuyWithGems) {
            const error = coinValidation?.error || gemValidation?.error;
            const details = coinValidation || gemValidation;
            return interaction.reply({
                embeds: [createErrorEmbed(error, details)],
                ephemeral: true
            });
        }

        let confirmText = `**Purchase ${listing.fumoName}**\n\nSelect payment method:\n`;
        const buttons = [];

        if (canBuyWithCoins && listing.coinPrice) {
            confirmText += `🪙 **Coin Price:** ${listing.coinPrice.toLocaleString()}\n`;
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`confirm_global_purchase_${listingId}_coins_${interaction.user.id}`)
                    .setLabel(`Pay 🪙 ${listing.coinPrice.toLocaleString()}`)
                    .setStyle(ButtonStyle.Success)
            );
        }

        if (canBuyWithGems && listing.gemPrice) {
            confirmText += `💎 **Gem Price:** ${listing.gemPrice.toLocaleString()}\n`;
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`confirm_global_purchase_${listingId}_gems_${interaction.user.id}`)
                    .setLabel(`Pay 💎 ${listing.gemPrice.toLocaleString()}`)
                    .setStyle(ButtonStyle.Success)
            );
        }

        buttons.push(
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${interaction.user.id}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        await interaction.reply({
            content: confirmText,
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Global purchase select error:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleConfirmGlobalPurchase(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const listingId = parseInt(parts[3]);
        const paymentMethod = parts[4];

        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ?`,
            [listingId]
        );

        if (!listing) {
            return interaction.update({
                content: '❌ This listing is no longer available.',
                embeds: [],
                components: []
            });
        }

        const validation = await validateGlobalPurchase(interaction.user.id, listing, paymentMethod);

        if (!validation.valid) {
            return interaction.update({
                embeds: [createErrorEmbed(validation.error, validation)],
                components: []
            });
        }

        const { remainingBalance } = await processGlobalPurchase(interaction.user.id, listing, paymentMethod);

        await notifySellerOfSale(
            interaction.client,
            listing.userId,
            listing.fumoName,
            paymentMethod === 'coins' ? listing.coinPrice : listing.gemPrice,
            paymentMethod,
            interaction.user.username
        );

        const successEmbed = createPurchaseSuccessEmbed(
            { name: listing.fumoName, price: paymentMethod === 'coins' ? listing.coinPrice : listing.gemPrice },
            1,
            remainingBalance,
            paymentMethod
        );

        await interaction.update({
            embeds: [successEmbed],
            components: []
        });

    } catch (error) {
        console.error('Confirm global purchase error:', error);
        await interaction.update({
            embeds: [createErrorEmbed('PROCESSING_ERROR')],
            components: []
        });
    }
}

module.exports = {
    handleGlobalPurchaseSelect,
    handleConfirmGlobalPurchase
};