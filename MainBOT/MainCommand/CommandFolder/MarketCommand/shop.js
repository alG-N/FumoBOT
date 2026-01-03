const { EmbedBuilder, Colors } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { formatNumber } = require('../../Ultility/formatting');
const { getUserShop, forceRerollUserShop } = require('../../Service/MarketService/ShopService/ShopCacheService');
const { useReroll, getRerollData, getRerollCooldownRemaining, formatTimeRemaining, getPaidRerollCost } = require('../../Service/MarketService/ShopService/ShopRerollService');
const purchaseService = require('../../Service/MarketService/ShopService/ShopPurchaseService');
const { calculateCoinPrice, calculateGemPrice } = require('../../Service/MarketService/WealthPricingService');
const {
    createShopEmbed,
    createShopButtons,
    createSearchResultsEmbed,
    createPurchaseConfirmationEmbed,
    createPurchaseButtons,
    createRerollSuccessEmbed,
    createBuyAllConfirmationEmbed
} = require('../../Service/MarketService/ShopService/ShopUIService');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.shop') && !message.content.startsWith('.sh')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        handleShopCommand(message);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId.startsWith('shop_prev_') || interaction.customId.startsWith('shop_next_')) {
            await handlePagination(interaction);
        }
        else if (interaction.customId.startsWith('free_reroll_') || interaction.customId.startsWith('paid_reroll_')) {
            const restriction = checkRestrictions(interaction.user.id);
            if (restriction.blocked) {
                return interaction.reply({ embeds: [restriction.embed], ephemeral: true });
            }

            await handleReroll(interaction);
        }
        else if (interaction.customId.startsWith('buy_all_')) {
            await handleBuyAll(interaction);
        }
        else if (interaction.customId === 'buyall_confirm' || interaction.customId === 'buyall_cancel') {
            await handleBuyAllConfirmation(interaction);
        }
    });

    async function handlePagination(interaction) {
        if (!interaction.isButton() || interaction.replied || interaction.deferred) {
            return;
        }

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const userId = parts[2];
        const currentPage = parseInt(parts[3]);

        if (!await checkButtonOwnership(interaction, `shop_${action}`, null, false)) {
            return;
        }

        try {
            const newPage = action === 'next' ? currentPage + 1 : currentPage - 1;
            const userShop = await getUserShop(userId);
            const rerollData = await getRerollData(userId);

            const shopEmbed = await createShopEmbed(userId, userShop, newPage);
            const buttons = await createShopButtons(userId, rerollData.count, newPage);

            await Promise.race([
                interaction.update({
                    embeds: [shopEmbed],
                    components: buttons
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Update timeout')), 2500)
                )
            ]);

        } catch (error) {
            if (error.code === 10062 || error.message === 'Update timeout') {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '⚠️ This button has expired. Please run `.shop` again.',
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                }
            }
        }
    }

    async function handleReroll(interaction) {
        const isPaidReroll = interaction.customId.startsWith('paid_reroll_');

        if (!await checkButtonOwnership(interaction, isPaidReroll ? 'paid_reroll' : 'free_reroll', null, false)) {
            return;
        }

        const userId = interaction.user.id;
        const rerollData = await getRerollData(userId);

        if (!isPaidReroll) {
            if (rerollData.count <= 0) {
                const [cooldownRemaining, gemCost] = await Promise.all([
                    getRerollCooldownRemaining(userId),
                    getPaidRerollCost(userId)
                ]);
                const timeLeft = formatTimeRemaining(cooldownRemaining);

                return interaction.reply({
                    content: `❌ You have no free rerolls left! Rerolls reset in: **${timeLeft}**\n💎 Use the Gem Reroll button to reroll for **${formatNumber(gemCost)} gems**.`,
                    ephemeral: true
                });
            }

            // CRITICAL: Defer before DB operations
            await interaction.deferUpdate();
            await useReroll(userId, false);
        } else {
            if (rerollData.count > 0) {
                return interaction.reply({
                    content: `❌ You must use all free rerolls first! You have **${rerollData.count}** free reroll(s) remaining.`,
                    ephemeral: true
                });
            }

            const cost = await getPaidRerollCost(userId);
            const db = require('../../Core/Database/dbSetting');

            const userGems = await new Promise((resolve) => {
                db.get('SELECT gems FROM userCoins WHERE userId = ?', [userId], (err, row) => {
                    if (err || !row) resolve(0);
                    else resolve(row.gems || 0);
                });
            });

            if (userGems < cost) {
                return interaction.reply({
                    content: `❌ You don't have enough gems! Cost: **${formatNumber(cost)} gems**\nYou have: **${formatNumber(userGems)} gems**`,
                    ephemeral: true
                });
            }

            // CRITICAL: Defer before DB operations
            await interaction.deferUpdate();

            await new Promise((resolve) => {
                db.run('UPDATE userCoins SET gems = gems - ? WHERE userId = ?', [cost, userId], resolve);
            });

            await useReroll(userId, true);
        }

        const [newShop, updatedRerollData] = await Promise.all([
            forceRerollUserShop(userId),
            getRerollData(userId)
        ]);

        const nextGemCost = isPaidReroll ? await getPaidRerollCost(userId) : null;
        const cooldownRemaining = await getRerollCooldownRemaining(userId);

        const [rerollEmbed, shopEmbed, buttons] = await Promise.all([
            createRerollSuccessEmbed(
                updatedRerollData.count,
                cooldownRemaining,
                nextGemCost
            ),
            createShopEmbed(userId, newShop, 0),
            createShopButtons(userId, updatedRerollData.count, 0)
        ]);

        await interaction.editReply({
            content: isPaidReroll ? '💎 **Gem Reroll Complete!**' : '🔄 **Free Reroll Complete!**',
            embeds: [rerollEmbed, shopEmbed],
            components: buttons
        });
    }


    async function handleShopCommand(message) {
        try {
            const args = message.content.split(' ');
            const command = args[1]?.toLowerCase();
            const userId = message.author.id;
            
            const userShop = await getUserShop(userId);

            if (command === 'buy') {
                await handleBuyCommand(message, args, userId, userShop);
            } else if (command === 'search') {
                await handleSearchCommand(message, args, userShop, userId);
            } else {
                await handleDisplayShop(message, userId, userShop);
            }
        } catch (error) {
            console.error('[SHOP] Error in handleShopCommand:', error);
            await message.reply({
                content: '❌ An error occurred while processing your command.',
                ephemeral: true
            }).catch(console.error);
        }
    }

    async function handleBuyCommand(message, args, userId, userShop) {
        const itemName = args.slice(2, -1).join(' ') || args[2];
        const quantity = Math.max(Number(args[args.length - 1]) || 1, 1);
        const itemCost = userShop[itemName];

        if (!itemCost) {
            return message.reply({
                content: `🔍 The item "${itemName}" is not available in your shop view.`,
                ephemeral: true
            });
        }

        // Calculate wealth-scaled price for confirmation
        const priceCalc = itemCost.currency === 'coins' 
            ? await calculateCoinPrice(userId, itemCost.cost, 'itemShop')
            : await calculateGemPrice(userId, itemCost.cost, 'itemShop');
        
        const scaledTotalCost = priceCalc.finalPrice * quantity;
        const baseTotalCost = itemCost.cost * quantity;

        const confirmationEmbed = createPurchaseConfirmationEmbed(
            quantity,
            itemName,
            scaledTotalCost,
            itemCost.currency,
            baseTotalCost,
            priceCalc.scaled
        );
        const buttonRow = createPurchaseButtons();

        const confirmationMessage = await message.reply({
            embeds: [confirmationEmbed],
            components: [buttonRow],
            ephemeral: true
        });

        const filter = i => i.user.id === userId;
        const collector = confirmationMessage.createMessageComponentCollector({
            filter,
            time: 15000
        });

        collector.on('collect', async i => {
            if (i.customId === 'purchase_confirm') {
                const result = await purchaseService.processPurchase(userId, itemName, itemCost, quantity);

                if (result.success) {
                    const updatedShop = await getUserShop(userId);
                    const rerollData = await getRerollData(userId);
                    const shopEmbed = await createShopEmbed(userId, updatedShop, 0);
                    const buttons = await createShopButtons(userId, rerollData.count, 0);

                    await i.update({
                        content: `✅ You have successfully purchased **${result.quantity} ${result.itemName}(s)** for **${formatNumber(result.totalCost)} ${result.currency}**!`,
                        embeds: [shopEmbed],
                        components: buttons,
                        ephemeral: true
                    });
                } else {
                    await i.update({
                        content: result.message,
                        embeds: [],
                        components: [],
                        ephemeral: true
                    });
                }
            } else {
                await i.update({
                    content: '⏸️ Purchase canceled.',
                    embeds: [],
                    components: [],
                    ephemeral: true
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                confirmationMessage.edit({
                    content: '⏱️ Purchase timed out.',
                    embeds: [],
                    components: [],
                    ephemeral: true
                }).catch(() => { });
            }
        });
    }

    async function handleBuyAll(interaction) {
        if (!await checkButtonOwnership(interaction, 'buy_all', null, false)) {
            return;
        }

        const userId = interaction.user.id;
        const userShop = await getUserShop(userId);

        const confirmationEmbed = await createBuyAllConfirmationEmbed(userShop, userId);
        const buttonRow = createPurchaseButtons('buyall');

        await interaction.reply({
            embeds: [confirmationEmbed],
            components: [buttonRow],
            ephemeral: true
        });
    }

    async function handleBuyAllConfirmation(interaction) {
        const userId = interaction.user.id;

        await interaction.deferUpdate({ ephemeral: true });

        if (interaction.customId === 'buyall_confirm') {
            const userShop = await getUserShop(userId);
            const result = await purchaseService.processBuyAll(userId, userShop);

            if (result.success) {
                const summary = result.purchases
                    .map(p => `• ${p.quantity}x ${p.itemName} (${formatNumber(p.cost)} ${p.currency})`)
                    .join('\n');

                const purchaseEmbed = new EmbedBuilder()
                    .setTitle('✅ Bulk Purchase Complete!')
                    .setDescription(summary)
                    .addFields(
                        { name: '💰 Total Coins Spent', value: formatNumber(result.totalCoins), inline: true },
                        { name: '💎 Total Gems Spent', value: formatNumber(result.totalGems), inline: true }
                    )
                    .setColor(Colors.Green)
                    .setTimestamp();

                return interaction.editReply({
                    content: '',
                    embeds: [purchaseEmbed],
                    components: []
                });
            } else {
                return interaction.editReply({
                    content: result.message || '❌ Purchase failed.',
                    embeds: [],
                    components: []
                });
            }
        }

        return interaction.editReply({
            content: '⏸️ Bulk purchase canceled.',
            embeds: [],
            components: []
        });
    }

    async function handleSearchCommand(message, args, userShop, userId) {
        const searchQuery = args.slice(2).join(' ').toLowerCase();
        const searchEmbed = await createSearchResultsEmbed(searchQuery, userShop, userId);
        message.reply({ embeds: [searchEmbed], ephemeral: true });
    }

    async function handleDisplayShop(message, userId, userShop) {
        try {
            const rerollData = await getRerollData(userId);
            const shopEmbed = await createShopEmbed(userId, userShop, 0);
            const buttons = await createShopButtons(userId, rerollData.count, 0);

            await message.reply({ embeds: [shopEmbed], components: buttons, ephemeral: true });
        } catch (error) {
            console.error('[SHOP] Error in handleDisplayShop:', error);
            await message.reply({
                content: '❌ Failed to load shop. Please try again.',
                ephemeral: true
            }).catch(console.error);
        }
    }
};