const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getCoinMarket, getGemMarket } = require('./MarketCacheService');
const { validateShopPurchase, processShopPurchase } = require('./MarketPurchaseService');
const { createPurchaseConfirmEmbed, createPurchaseSuccessEmbed, createErrorEmbed } = require('./MarketUIService');

async function handleFumoSelection(interaction, shopType) {
    try {
        const fumoIndex = parseInt(interaction.values[0]);
        const market = shopType === 'coin' ? getCoinMarket(interaction.user.id) : getGemMarket(interaction.user.id);
        const fumo = market.market[fumoIndex];

        if (!fumo) {
            return interaction.reply({
                embeds: [createErrorEmbed('NOT_FOUND')],
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`purchase_amount_modal_${shopType}_${fumoIndex}_${interaction.user.id}`)
            .setTitle(`Purchase ${fumo.name}`);

        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel(`How many? (Max: ${fumo.stock})`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter amount')
            .setMinLength(1)
            .setMaxLength(10);

        const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);

        const submitted = await interaction.awaitModalSubmit({
            filter: i => i.customId === modal.data.custom_id && i.user.id === interaction.user.id,
            time: 60000
        }).catch(() => null);

        if (!submitted) return;

        const amount = parseInt(submitted.fields.getTextInputValue('amount'));

        if (isNaN(amount) || amount < 1 || amount > fumo.stock) {
            return submitted.reply({
                embeds: [createErrorEmbed('INVALID_AMOUNT', { max: fumo.stock })],
                ephemeral: true
            });
        }

        const currency = shopType === 'coin' ? 'coins' : 'gems';
        const totalPrice = fumo.price * amount;
        const confirmEmbed = createPurchaseConfirmEmbed(fumo, amount, totalPrice, currency);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_purchase_${shopType}_${fumoIndex}_${amount}_${interaction.user.id}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${interaction.user.id}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await submitted.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

    } catch (error) {
        console.error('Fumo selection error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            });
        }
    }
}

async function handleConfirmPurchase(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const shopType = parts[2];
        const fumoIndex = parseInt(parts[3]);
        const amount = parseInt(parts[4]);

        const market = shopType === 'coin' ? getCoinMarket(interaction.user.id) : getGemMarket(interaction.user.id);
        const currency = shopType === 'coin' ? 'coins' : 'gems';

        const validation = await validateShopPurchase(interaction.user.id, fumoIndex, amount, market, currency);

        if (!validation.valid) {
            return interaction.update({
                embeds: [createErrorEmbed(validation.error, validation)],
                components: []
            });
        }

        const { remainingBalance } = await processShopPurchase(
            interaction.user.id,
            validation.fumo,
            amount,
            validation.totalPrice,
            currency,
            shopType
        );

        const successEmbed = createPurchaseSuccessEmbed(validation.fumo, amount, remainingBalance, currency);
        await interaction.update({ embeds: [successEmbed], components: [] });

    } catch (error) {
        console.error('Confirm purchase error:', error);
        await interaction.update({
            embeds: [createErrorEmbed('PROCESSING_ERROR')],
            components: []
        });
    }
}

async function handleCancelPurchase(interaction) {
    await interaction.update({
        content: '❌ Purchase cancelled.',
        embeds: [],
        components: []
    });
}

module.exports = {
    handleFumoSelection,
    handleConfirmPurchase,
    handleCancelPurchase
};