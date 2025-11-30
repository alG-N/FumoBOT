const { get, run } = require('../../../Core/database');
const { parseAmount } = require('../../../Ultility/formatting');
const { 
    validateExchangeRequest, 
    checkDailyLimit 
} = require('./ExchangeValidationService');
const { 
    createExchangeEmbed, 
    createHistoryEmbed 
} = require('./ExchangeUIService');
const { 
    recordExchange, 
    getUserHistory 
} = require('./ExchangeHistoryService');
const { 
    getExchangeRate, 
    calculateExchange 
} = require('./ExchangeRateService');

const MIN_EXCHANGE = 10;
const MAX_EXCHANGES_PER_DAY = 5;

async function processExchange(userId, type, amount) {
    const rate = await getExchangeRate();
    const { taxedAmount, result, taxRate } = calculateExchange(type, amount, rate);
    
    if (result < 1) {
        return { 
            success: false, 
            error: 'AMOUNT_TOO_SMALL' 
        };
    }

    const fromCol = type;
    const toCol = type === 'coins' ? 'gems' : 'coins';

    await run(
        `UPDATE userCoins 
         SET ${fromCol} = ${fromCol} - ?, 
             ${toCol} = ${toCol} + ?
         WHERE userId = ?`,
        [amount, result, userId]
    );

    await recordExchange(userId, type, amount, taxedAmount, result, taxRate);

    return {
        success: true,
        fromType: type,
        toType: toCol,
        amount,
        result,
        taxRate
    };
}

async function handleExchangeCommand(message, args) {
    const userId = message.author.id;
    
    if (args.length === 0) {
        const history = await getUserHistory(userId);
        const embed = await createHistoryEmbed(userId, history);
        return message.reply({ embeds: [embed] });
    }

    const type = args[0]?.toLowerCase();
    const amountStr = args[1];

    const userRow = await get('SELECT coins, gems FROM userCoins WHERE userId = ?', [userId]);
    if (!userRow) {
        return message.reply('❌ You do not have an account yet.');
    }

    const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
    const amount = parseAmount(amountStr, userBalance);

    const validation = await validateExchangeRequest(userId, type, amount, userBalance);
    if (!validation.valid) {
        return message.reply(validation.message);
    }

    const limitCheck = await checkDailyLimit(userId);
    if (!limitCheck.canExchange) {
        return message.reply(limitCheck.message);
    }

    const rate = await getExchangeRate();
    const { taxedAmount, result, taxRate } = calculateExchange(type, amount, rate);

    const embed = await createExchangeEmbed(
        userId,
        type,
        amount,
        result,
        taxRate,
        'confirm',
        taxedAmount
    );

    const reply = await message.reply({
        embeds: [embed.embed],
        components: [embed.buttons]
    });

    return reply;
}

async function handleExchangeInteraction(interaction) {
    const parts = interaction.customId.split('_');
    
    if (parts.length < 8) {
        return interaction.reply({ 
            content: '❌ Invalid or expired exchange.', 
            ephemeral: true 
        });
    }

    const action = parts[1];
    const userId = parts[2];
    const type = parts[3];
    const amount = parseInt(parts[4], 10);
    const taxedAmount = parseInt(parts[5], 10);
    const result = parseInt(parts[6], 10);
    const taxRate = parseFloat(parts[7]);
    
    if (interaction.user.id !== userId) {
        return interaction.reply({ 
            content: '❌ This is not your exchange.', 
            ephemeral: true 
        });
    }

    if (action === 'cancel') {
        const embed = await createExchangeEmbed(userId, type, amount, result, taxRate, 'cancel', taxedAmount);
        await interaction.update({ 
            embeds: [embed.embed], 
            components: [embed.buttons] 
        });
        return;
    }

    if (action === 'confirm') {
        const limitCheck = await checkDailyLimit(userId);
        if (!limitCheck.canExchange) {
            return interaction.reply({ 
                content: limitCheck.message, 
                ephemeral: true 
            });
        }

        const userRow = await get('SELECT coins, gems FROM userCoins WHERE userId = ?', [userId]);
        if (!userRow) {
            return interaction.reply({ 
                content: '❌ Account not found.', 
                ephemeral: true 
            });
        }

        const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
        if (userBalance < amount) {
            return interaction.reply({ 
                content: `❌ You don't have enough ${type} to exchange.`, 
                ephemeral: true 
            });
        }

        const exchangeResult = await processExchange(userId, type, amount);
        
        if (!exchangeResult.success) {
            return interaction.reply({ 
                content: '❌ Exchange failed.', 
                ephemeral: true 
            });
        }

        const embed = await createExchangeEmbed(
            userId,
            type,
            amount,
            result,
            taxRate,
            'success',
            taxedAmount
        );

        await interaction.update({ 
            embeds: [embed.embed], 
            components: [embed.buttons] 
        });
    }
}

module.exports = {
    handleExchangeCommand,
    handleExchangeInteraction,
    processExchange,
    MIN_EXCHANGE,
    MAX_EXCHANGES_PER_DAY
};