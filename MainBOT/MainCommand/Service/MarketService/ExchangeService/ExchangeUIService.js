const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { getResetTimeText } = require('./ExchangeValidationService');
const { MAX_EXCHANGES_PER_DAY } = require('./ExchangeValidationService');
const { get } = require('../../../Core/database');

function createExchangeButtons(userId, type, amount, taxedAmount, result, taxRate, disabled = false) {
    const data = `${userId}_${type}_${amount}_${taxedAmount}_${result}_${taxRate}`;
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`exchange_confirm_${data}`)
            .setLabel('Confirm Exchange')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`exchange_cancel_${data}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    );
}

async function createExchangeEmbed(userId, type, amount, result, taxRate, state = 'confirm', taxedAmount = 0) {
    const exchangeType = type === 'coins' ? 'gems' : 'coins';

    if (state === 'confirm') {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('💱 Exchange Center')
            .setDescription(
                `You are about to exchange **${formatNumber(amount)} ${type}** for ` +
                `**${formatNumber(result)} ${exchangeType}** ` +
                `*(after ${(taxRate * 100).toFixed(0)}% tax)*.\n\nPlease confirm your action below.`
            )
            .setFooter({ text: 'Proceed with caution!' });

        return {
            embed,
            buttons: createExchangeButtons(userId, type, amount, taxedAmount, result, taxRate, false)
        };
    }

    if (state === 'success') {
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Exchange Successful!')
            .setDescription(`You received **${formatNumber(result)} ${exchangeType}**.`)
            .setFooter({ text: 'Thank you for using the Exchange Center!' });

        return {
            embed,
            buttons: createExchangeButtons(userId, type, amount, taxedAmount, result, taxRate, true)
        };
    }

    if (state === 'cancel') {
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Exchange Cancelled')
            .setDescription('Your exchange has been cancelled.')
            .setFooter({ text: 'No changes were made to your balance.' });

        return {
            embed,
            buttons: createExchangeButtons(userId, type, amount, taxedAmount, result, taxRate, true)
        };
    }

    return {
        embed: new EmbedBuilder().setDescription('Unknown state'),
        buttons: createExchangeButtons(userId, type, 0, 0, 0, 0, true)
    };
}

async function createHistoryEmbed(userId, history) {
    const today = new Date().toISOString().split('T')[0];
    
    const limitRow = await get(
        'SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?',
        [userId, today]
    );

    const used = limitRow?.count || 0;
    const remaining = MAX_EXCHANGES_PER_DAY - used;
    
    let limitText = `You have **${remaining}** exchanges left for today.`;
    if (remaining === 0) {
        limitText += `\n⏳ Limit resets in **${getResetTimeText()} hour(s)** (at 00:00 UTC).`;
    }

    const historyText = history.length > 0
        ? history.map(entry => {
            const symbol = entry.type === 'coins' ? '🪙' : '💎';
            const target = entry.type === 'coins' ? 'gems' : 'coins';
            const tax = Math.round(((entry.amount - entry.taxedAmount) / entry.amount) * 100);
            return `${symbol} ${formatNumber(entry.amount)} ${entry.type} ➡️ ${formatNumber(entry.result)} ${target} (${tax}% tax)`;
        }).join('\n')
        : 'No exchange history found yet.';

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('💱 Exchange Center Guide')
        .setDescription(
            'To exchange coins or gems, use the command:\n`.exchange <type> <amount>`\n\n' +
            '💰 **Base Exchange Rate:**\n10 coins = 1 gem\n\n' +
            'You can also use `all` to exchange your entire balance.'
        )
        .addFields(
            { name: '📜 Your Recent Exchanges', value: historyText },
            { name: '📆 Daily Exchange Limit', value: limitText }
        )
        .setFooter({ text: 'Make sure to check your balance before exchanging!' });

    return embed;
}

module.exports = {
    createExchangeButtons,
    createExchangeEmbed,
    createHistoryEmbed
};