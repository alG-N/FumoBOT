const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../Core/database');
const { getUserMarket, updateMarketStock } = require('./MarketCacheService');
const { addFumoToInventory } = require('./MarketInventoryService');
const { 
    createPurchaseConfirmEmbed, 
    createPurchaseSuccessEmbed,
    createErrorEmbed 
} = require('./MarketUIService');
const { debugLog } = require('../../../Core/logger');

function parsePurchaseArgs(args) {
    let amount = 1;
    const lastArg = args[args.length - 1];
    
    if (!isNaN(lastArg) && parseInt(lastArg) > 0) {
        amount = parseInt(lastArg);
        args.pop();
    }

    const fumoName = args.join(' ');
    
    return { fumoName, amount };
}

async function validatePurchase(userId, fumoName, amount, userMarket) {
    const fumo = userMarket.market.find(f => f.name.toLowerCase() === fumoName.toLowerCase());

    if (!fumo) {
        return { 
            valid: false, 
            error: 'NOT_FOUND',
            fumoName 
        };
    }

    if (fumo.stock < amount) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_STOCK',
            fumoName,
            stock: fumo.stock,
            requested: amount
        };
    }

    const totalPrice = fumo.price * amount;
    const userRow = await get(`SELECT coins FROM userCoins WHERE userId = ?`, [userId]);

    if (!userRow) {
        return { 
            valid: false, 
            error: 'NO_ACCOUNT' 
        };
    }

    if (userRow.coins < totalPrice) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_COINS',
            required: totalPrice,
            current: userRow.coins
        };
    }

    return { 
        valid: true, 
        fumo, 
        totalPrice,
        currentCoins: userRow.coins
    };
}

async function processPurchase(userId, fumo, amount, totalPrice) {

    await run(`UPDATE userCoins SET coins = coins - ? WHERE userId = ?`, [totalPrice, userId]);
    
    const balanceRow = await get(`SELECT coins FROM userCoins WHERE userId = ?`, [userId]);
    const remainingCoins = balanceRow?.coins || 0;
    
    const luckRow = await get(`SELECT luck FROM userCoins WHERE userId = ?`, [userId]);
    const shinyMarkValue = luckRow?.luck || 0;

    for (let i = 0; i < amount; i++) {
        await addFumoToInventory(userId, fumo, shinyMarkValue);
    }

    updateMarketStock(userId, fumo.name, amount);
    
    debugLog('MARKET_PURCHASE', `User ${userId} bought ${amount}x ${fumo.name} for ${totalPrice} coins`);

    return { remainingCoins, remainingStock: fumo.stock };
}

async function handleMarketPurchase(message, args) {
    const { fumoName, amount } = parsePurchaseArgs(args);
    const userMarket = getUserMarket(message.author.id);

    const validation = await validatePurchase(message.author.id, fumoName, amount, userMarket);

    if (!validation.valid) {
        const errorEmbed = createErrorEmbed(validation.error, validation);
        return message.reply({ embeds: [errorEmbed] });
    }

    const { fumo, totalPrice } = validation;
    const confirmEmbed = createPurchaseConfirmEmbed(amount, fumo.name, totalPrice);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`confirmPurchase_${message.author.id}`)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`cancelPurchase_${message.author.id}`)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    const reply = await message.reply({ embeds: [confirmEmbed], components: [row] });

    const filter = i => {
        const isCorrectUser = i.user.id === message.author.id;
        if (!isCorrectUser) {
            i.reply({ content: 'This button is not for you!', ephemeral: true }).catch(() => {});
            return false;
        }
        return true;
    };
    
    const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 15000 });

    collector.on('collect', async (interaction) => {
        try {
            
            if (interaction.customId.startsWith('confirmPurchase')) {
                
                const freshMarket = getUserMarket(message.author.id);
                const revalidation = await validatePurchase(message.author.id, fumoName, amount, freshMarket);

                if (!revalidation.valid) {
                    console.log(`[MARKET] Revalidation failed: ${revalidation.error}`);
                    const errorEmbed = createErrorEmbed(revalidation.error, revalidation);
                    return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
                }

                const { remainingCoins, remainingStock } = await processPurchase(
                    message.author.id, 
                    revalidation.fumo, 
                    amount, 
                    revalidation.totalPrice
                );

                const successEmbed = createPurchaseSuccessEmbed(
                    amount,
                    revalidation.fumo.name,
                    remainingCoins,
                    remainingStock
                );

                await interaction.update({ embeds: [successEmbed], components: [] });
            } else {
                console.log(`[MARKET] Purchase cancelled`);
                await interaction.update({ 
                    content: 'Purchase cancelled.', 
                    embeds: [], 
                    components: [] 
                });
            }
        } catch (error) {
            console.error('[MARKET] Button handler error:', error);
            console.error('[MARKET] Stack trace:', error.stack);
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.followUp({ 
                        content: '❌ An error occurred. Please try again.', 
                        ephemeral: true 
                    });
                } else {
                    await interaction.reply({ 
                        content: '❌ An error occurred. Please try again.', 
                        ephemeral: true 
                    });
                }
            } catch (replyError) {
                console.error('[MARKET] Failed to send error reply:', replyError);
            }
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            reply.edit({ components: [] }).catch(() => {});
        }
    });
}

module.exports = {
    handleMarketPurchase,
    parsePurchaseArgs,
    validatePurchase,
    processPurchase
};