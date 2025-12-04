const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get } = require('../../../../Core/database');
const { validateGlobalPurchase, processGlobalPurchase } = require('../MarketPurchaseService');
const { notifySellerOfSale } = require('../MarketStorageService');
const { createErrorEmbed } = require('../MarketUIService');
const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../../../Ultility/formatting');

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

        const validation = await validateGlobalPurchase(interaction.user.id, listing);

        if (!validation.valid) {
            return interaction.reply({
                embeds: [createErrorEmbed(validation.error, validation)],
                ephemeral: true
            });
        }

        const coinPrice = listing.coinPrice || 0;
        const gemPrice = listing.gemPrice || 0;

        const embed = new EmbedBuilder()
            .setTitle('🛒 Confirm Purchase')
            .setDescription(
                `**Fumo:** ${listing.fumoName}\n\n` +
                `**Required Payment:**\n` +
                `🪙 Coins: ${formatNumber(coinPrice)}\n` +
                `💎 Gems: ${formatNumber(gemPrice)}\n\n` +
                `**Your Balance:**\n` +
                `🪙 Coins: ${formatNumber(validation.currentCoins)}\n` +
                `💎 Gems: ${formatNumber(validation.currentGems)}\n\n` +
                `⚠️ You must pay **BOTH** currencies to complete this purchase.`
            )
            .setColor('#2ECC71');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_global_purchase_${listingId}_${interaction.user.id}`)
                .setLabel(`✅ Pay ${formatNumber(coinPrice)} 🪙 & ${formatNumber(gemPrice)} 💎`)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${interaction.user.id}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
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

        const validation = await validateGlobalPurchase(interaction.user.id, listing);

        if (!validation.valid) {
            return interaction.update({
                embeds: [createErrorEmbed(validation.error, validation)],
                components: []
            });
        }

        const result = await processGlobalPurchase(interaction.user.id, listing);

        const coinPrice = listing.coinPrice || 0;
        const gemPrice = listing.gemPrice || 0;

        await notifySellerOfSale(
            interaction.client,
            listing.userId,
            listing.fumoName,
            coinPrice,
            gemPrice,
            interaction.user.username
        );

        const successEmbed = new EmbedBuilder()
            .setTitle('🎉 Purchase Successful!')
            .setDescription(
                `You purchased **${listing.fumoName}**!\n\n` +
                `**Paid:**\n` +
                `🪙 ${formatNumber(coinPrice)} coins\n` +
                `💎 ${formatNumber(gemPrice)} gems\n\n` +
                `**Remaining Balance:**\n` +
                `🪙 ${formatNumber(result.remainingCoins)} coins\n` +
                `💎 ${formatNumber(result.remainingGems)} gems`
            )
            .setColor('#2ECC71');

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