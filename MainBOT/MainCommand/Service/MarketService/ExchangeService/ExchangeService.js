const { get, run } = require('../../../Core/database');
const { parseAmount } = require('../../../Ultility/formatting');
const { parseCustomId } = require('../../../Middleware/buttonOwnership');
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
const exchangeCache = require('./ExchangeCacheService');

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

    // Store exchange in cache to prevent expiration issues
    const customIdConfirm = embed.buttons.components[0].data.custom_id;
    exchangeCache.store(customIdConfirm, {
        userId,
        type,
        amount,
        taxedAmount,
        result,
        taxRate,
        rate,
        messageId: reply.id
    });

    return reply;
}

async function handleExchangeInteraction(interaction) {
    const parsed = parseCustomId(interaction.customId);
    const { action, userId, additionalData } = parsed;
    
    // Check cache first for valid exchange data
    const cachedExchange = exchangeCache.get(interaction.customId);
    
    if (!cachedExchange && !additionalData) {
        return interaction.reply({ 
            content: '❌ This exchange has expired or is invalid. Please start a new exchange using `.exchange <type> <amount>`', 
            ephemeral: true 
        });
    }

    // Use cached data if available, otherwise fall back to additionalData
    const exchangeData = cachedExchange || additionalData;
    const { type, amount, taxedAmount, result, taxRate } = exchangeData;
    
    if (interaction.user.id !== userId) {
        return interaction.reply({ 
            content: '❌ This is not your exchange.', 
            ephemeral: true 
        });
    }

    if (action === 'exchange_cancel') {
        // Remove from cache
        exchangeCache.remove(interaction.customId);
        
        const embed = await createExchangeEmbed(userId, type, amount, result, taxRate, 'cancel', taxedAmount);
        await interaction.update({ 
            embeds: [embed.embed], 
            components: [embed.buttons] 
        });
        return;
    }

    if (action === 'exchange_confirm') {
        // Validate exchange is still in cache
        if (!exchangeCache.isValid(interaction.customId)) {
            return interaction.reply({
                content: '❌ This exchange has expired. Please start a new exchange.',
                ephemeral: true
            });
        }

        const limitCheck = await checkDailyLimit(userId);
        if (!limitCheck.canExchange) {
            exchangeCache.remove(interaction.customId);
            return interaction.reply({ 
                content: limitCheck.message, 
                ephemeral: true 
            });
        }

        const userRow = await get('SELECT coins, gems FROM userCoins WHERE userId = ?', [userId]);
        if (!userRow) {
            exchangeCache.remove(interaction.customId);
            return interaction.reply({ 
                content: '❌ Account not found.', 
                ephemeral: true 
            });
        }

        const userBalance = type === 'coins' ? userRow.coins : userRow.gems;
        if (userBalance < amount) {
            exchangeCache.remove(interaction.customId);
            return interaction.reply({ 
                content: `❌ You don't have enough ${type} to exchange.`, 
                ephemeral: true 
            });
        }

        const exchangeResult = await processExchange(userId, type, amount);
        
        if (!exchangeResult.success) {
            exchangeCache.remove(interaction.customId);
            return interaction.reply({ 
                content: '❌ Exchange failed.', 
                ephemeral: true 
            });
        }

        // Remove from cache after successful exchange
        exchangeCache.remove(interaction.customId);

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

/**
 * Get cache statistics (useful for debugging)
 */
function getExchangeCacheStats() {
    return exchangeCache.getStats();
}

/**
 * Clear expired exchanges from cache (can be called manually if needed)
 */
function cleanupExpiredExchanges() {
    return exchangeCache.cleanup();
}

module.exports = {
    handleExchangeCommand,
    handleExchangeInteraction,
    processExchange,
    getExchangeCacheStats,
    cleanupExpiredExchanges,
    MIN_EXCHANGE,
    MAX_EXCHANGES_PER_DAY
};