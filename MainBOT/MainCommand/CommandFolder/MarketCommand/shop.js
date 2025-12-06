const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { getUserShop, forceRerollUserShop, getUserShopTimeLeft } = require('../../Service/MarketService/ShopService/ShopCacheService');
const { processPurchase, processBuyAll } = require('../../Service/MarketService/ShopService/ShopPurchaseService');
const { 
    createShopEmbed, 
    createShopButtons,
    createSearchResultsEmbed,
    createPurchaseConfirmationEmbed,
    createBuyAllConfirmationEmbed,
    createPurchaseButtons,
    createRerollSuccessEmbed,
    RARITY_PAGES
} = require('../../Service/MarketService/ShopService/ShopUIService');
const { 
    getRerollData, 
    useReroll, 
    initializeRerollData,
    getPaidRerollCost,
    getRerollCooldownRemaining
} = require('../../Service/MarketService/ShopService/ShopRerollService');
const { getUserCurrency, deductCurrency } = require('../../Service/MarketService/ShopService/ShopDatabaseService');

const pendingPurchases = new Map();
const pendingBuyAll = new Map();

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.trim().split(/\s+/);
        const command = args[0].toLowerCase();

        if (command === '.shop' || command === '.s') {
            await handleShopCommand(message, args.slice(1));
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        try {
            if (interaction.customId.startsWith('shop_prev_') || interaction.customId.startsWith('shop_next_')) {
                await handleShopPagination(interaction);
            }
            else if (interaction.customId.startsWith('free_reroll_')) {
                if (!checkButtonOwnership(interaction, 'free_reroll')) {
                    return interaction.reply({
                        content: "❌ You can't use someone else's button. Run `.shop` yourself.",
                        ephemeral: true
                    });
                }
                await handleFreeReroll(interaction);
            }
            else if (interaction.customId.startsWith('paid_reroll_')) {
                if (!checkButtonOwnership(interaction, 'paid_reroll')) {
                    return interaction.reply({
                        content: "❌ You can't use someone else's button. Run `.shop` yourself.",
                        ephemeral: true
                    });
                }
                await handlePaidReroll(interaction);
            }
            else if (interaction.customId.startsWith('buy_all_')) {
                if (!checkButtonOwnership(interaction, 'buy_all')) {
                    return interaction.reply({
                        content: "❌ You can't use someone else's button. Run `.shop` yourself.",
                        ephemeral: true
                    });
                }
                await handleBuyAllButton(interaction);
            }
            else if (interaction.customId === 'purchase_confirm') {
                await handlePurchaseConfirmation(interaction);
            }
            else if (interaction.customId === 'purchase_cancel') {
                await handlePurchaseCancel(interaction);
            }
            else if (interaction.customId === 'buyall_confirm') {
                await handleBuyAllConfirmation(interaction);
            }
            else if (interaction.customId === 'buyall_cancel') {
                await handleBuyAllCancel(interaction);
            }
        } catch (error) {
            console.error('Shop interaction error:', error);

            const errorMsg = { content: '❌ An error occurred.', ephemeral: true };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMsg).catch(() => {});
            } else if (!interaction.replied) {
                await interaction.reply(errorMsg).catch(() => {});
            }
        }
    });
};

async function handleShopCommand(message, args) {
    const userId = message.author.id;

    if (args.length === 0) {
        await initializeRerollData(userId);
        const userShop = getUserShop(userId);
        const rerollData = getRerollData(userId);
        const embed = createShopEmbed(userId, userShop, 0);
        const buttons = createShopButtons(userId, rerollData.count, 0);
        return message.reply({ embeds: [embed], components: buttons });
    }

    const subcommand = args[0].toLowerCase();

    if (subcommand === 'buy') {
        if (args.length < 3) {
            return message.reply('❌ Usage: `.shop buy <ItemName> <Quantity>`');
        }

        const quantity = parseInt(args[args.length - 1]);
        if (isNaN(quantity) || quantity < 1) {
            return message.reply('❌ Please provide a valid quantity.');
        }

        const itemName = args.slice(1, -1).join(' ');
        const userShop = getUserShop(userId);
        const itemData = userShop[itemName];

        if (!itemData) {
            return message.reply(`❌ Item "${itemName}" not found in your shop.`);
        }

        const totalCost = itemData.cost * quantity;
        const confirmEmbed = createPurchaseConfirmationEmbed(quantity, itemName, totalCost, itemData.currency);
        const buttons = createPurchaseButtons('purchase');

        const reply = await message.reply({ embeds: [confirmEmbed], components: [buttons] });

        pendingPurchases.set(userId, { itemName, itemData, quantity, messageId: reply.id });

        setTimeout(() => {
            if (pendingPurchases.has(userId) && pendingPurchases.get(userId).messageId === reply.id) {
                pendingPurchases.delete(userId);
            }
        }, 60000);
    }
    else if (subcommand === 'search') {
        if (args.length < 2) {
            return message.reply('❌ Usage: `.shop search <ItemName>`');
        }

        const searchQuery = args.slice(1).join(' ').toLowerCase();
        const userShop = getUserShop(userId);
        const searchEmbed = createSearchResultsEmbed(searchQuery, userShop);
        return message.reply({ embeds: [searchEmbed] });
    }
}

async function handleShopPagination(interaction) {
    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const currentPage = parseInt(parts[3]);
    
    if (interaction.user.id !== userId) {
        return interaction.reply({
            content: "❌ You can't use someone else's shop.",
            ephemeral: true
        });
    }

    const direction = parts[1];
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    if (newPage < 0 || newPage >= RARITY_PAGES.length) {
        return interaction.reply({
            content: '❌ Invalid page.',
            ephemeral: true
        });
    }

    const userShop = getUserShop(userId);
    const rerollData = getRerollData(userId);
    const embed = createShopEmbed(userId, userShop, newPage);
    const buttons = createShopButtons(userId, rerollData.count, newPage);

    await interaction.update({ embeds: [embed], components: buttons });
}

async function handleFreeReroll(interaction) {
    const userId = interaction.user.id;
    await initializeRerollData(userId);
    
    const rerollData = getRerollData(userId);

    if (rerollData.count <= 0) {
        return interaction.reply({
            content: '❌ You have no free rerolls left. Use a gem reroll instead.',
            ephemeral: true
        });
    }

    useReroll(userId, false);

    const newShop = forceRerollUserShop(userId);
    const updatedRerollData = getRerollData(userId);
    const cooldownRemaining = getRerollCooldownRemaining(userId);

    const successEmbed = createRerollSuccessEmbed(updatedRerollData.count, cooldownRemaining);
    const shopEmbed = createShopEmbed(userId, newShop, 0);
    const buttons = createShopButtons(userId, updatedRerollData.count, 0);

    await interaction.update({ embeds: [successEmbed, shopEmbed], components: buttons });
}

async function handlePaidReroll(interaction) {
    const userId = interaction.user.id;
    await initializeRerollData(userId);

    const gemCost = getPaidRerollCost(userId);
    const currency = await getUserCurrency(userId);

    if (currency.gems < gemCost) {
        return interaction.reply({
            content: `❌ You need ${gemCost.toLocaleString()} gems for this reroll.`,
            ephemeral: true
        });
    }

    await deductCurrency(userId, 'gems', gemCost);
    useReroll(userId, true);

    const newShop = forceRerollUserShop(userId);
    const rerollData = getRerollData(userId);
    const cooldownRemaining = getRerollCooldownRemaining(userId);

    const successEmbed = createRerollSuccessEmbed(rerollData.count, cooldownRemaining, gemCost);
    const shopEmbed = createShopEmbed(userId, newShop, 0);
    const buttons = createShopButtons(userId, rerollData.count, 0);

    await interaction.update({ embeds: [successEmbed, shopEmbed], components: buttons });
}

async function handleBuyAllButton(interaction) {
    const userId = interaction.user.id;
    const userShop = getUserShop(userId);

    const confirmEmbed = createBuyAllConfirmationEmbed(userShop);
    const buttons = createPurchaseButtons('buyall');

    await interaction.reply({ 
        embeds: [confirmEmbed], 
        components: [buttons],
        ephemeral: true
    });

    pendingBuyAll.set(userId, { userShop, timestamp: Date.now() });

    setTimeout(() => {
        pendingBuyAll.delete(userId);
    }, 60000);
}

async function handlePurchaseConfirmation(interaction) {
    const userId = interaction.user.id;
    const pending = pendingPurchases.get(userId);

    if (!pending) {
        return interaction.update({
            content: '❌ Purchase expired. Please try again.',
            embeds: [],
            components: []
        });
    }

    const result = await processPurchase(userId, pending.itemName, pending.itemData, pending.quantity);

    pendingPurchases.delete(userId);

    if (!result.success) {
        return interaction.update({
            content: result.message,
            embeds: [],
            components: []
        });
    }

    await interaction.update({
        content: `✅ Successfully purchased **${result.quantity}x ${result.itemName}** for **${result.totalCost.toLocaleString()} ${result.currency}**!`,
        embeds: [],
        components: []
    });
}

async function handlePurchaseCancel(interaction) {
    const userId = interaction.user.id;
    pendingPurchases.delete(userId);

    await interaction.update({
        content: '❌ Purchase cancelled.',
        embeds: [],
        components: []
    });
}

async function handleBuyAllConfirmation(interaction) {
    const userId = interaction.user.id;
    const pending = pendingBuyAll.get(userId);

    if (!pending) {
        return interaction.update({
            content: '❌ Purchase expired. Please try again.',
            embeds: [],
            components: []
        }).catch(() => {});
    }

    const result = await processBuyAll(userId, pending.userShop);

    pendingBuyAll.delete(userId);

    if (!result.success) {
        return interaction.update({
            content: result.message || '❌ Bulk purchase failed.',
            embeds: [],
            components: []
        }).catch(() => {});
    }

    const purchaseList = result.purchases.map(p => 
        `• ${p.quantity}x ${p.itemName} - ${p.cost.toLocaleString()} ${p.currency}`
    ).slice(0, 10).join('\n');

    const moreItems = result.purchases.length > 10 ? `\n...and ${result.purchases.length - 10} more items` : '';

    await interaction.update({
        content: 
            `✅ **Bulk Purchase Complete!**\n\n` +
            `${purchaseList}${moreItems}\n\n` +
            `**Total Spent:**\n` +
            `💰 ${result.totalCoins.toLocaleString()} coins\n` +
            `💎 ${result.totalGems.toLocaleString()} gems`,
        embeds: [],
        components: []
    }).catch(() => {});
}

async function handleBuyAllCancel(interaction) {
    const userId = interaction.user.id;
    pendingBuyAll.delete(userId);

    await interaction.update({
        content: '❌ Bulk purchase cancelled.',
        embeds: [],
        components: []
    });
}