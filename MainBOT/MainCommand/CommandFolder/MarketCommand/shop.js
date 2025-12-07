const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { formatNumber } = require('../../Ultility/formatting');
const { getUserShop, forceRerollUserShop, getUserShopTimeLeft } = require('../../Service/MarketService/ShopService/ShopCacheService');
const { useReroll, getRerollData, getRerollCooldownRemaining, formatTimeRemaining, getPaidRerollCost } = require('../../Service/MarketService/ShopService/ShopRerollService');
const { processPurchase, processBuyAll } = require('../../Service/MarketService/ShopService/ShopPurchaseService');
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
            console.log(`[${new Date().toISOString()}] Blocked user (${message.author.id}) due to ${restriction.reason}.`);
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
            console.log('[SHOP] Interaction already handled or expired');
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
            const userShop = getUserShop(userId);
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
            console.error('[SHOP] Pagination error:', error.message);

            if (error.code === 10062 || error.message === 'Update timeout') {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: '⚠️ This button has expired. Please run `.shop` again.',
                            ephemeral: true
                        });
                    }
                } catch (replyError) {
                    console.error('[SHOP] Could not send error message:', replyError.message);
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
                const cooldownRemaining = await getRerollCooldownRemaining(userId);
                const timeLeft = formatTimeRemaining(cooldownRemaining);
                const gemCost = await getPaidRerollCost(userId);

                return interaction.reply({
                    content: `❌ You have no free rerolls left! Rerolls reset in: **${timeLeft}**\n💎 Use the Gem Reroll button to reroll for **${formatNumber(gemCost)} gems**.`,
                    ephemeral: true
                });
            }

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

            await new Promise((resolve) => {
                db.run('UPDATE userCoins SET gems = gems - ? WHERE userId = ?', [cost, userId], resolve);
            });

            await useReroll(userId, true);
        }

        const newShop = await forceRerollUserShop(userId);
        const updatedRerollData = await getRerollData(userId);

        const rerollEmbed = await createRerollSuccessEmbed(
            updatedRerollData.count,
            await getRerollCooldownRemaining(userId),
            isPaidReroll ? await getPaidRerollCost(userId) / 5 : null
        );

        const shopEmbed = await createShopEmbed(userId, newShop, 0);
        const buttons = await createShopButtons(userId, updatedRerollData.count, 0);

        await interaction.reply({
            content: isPaidReroll ? '💎 **Gem Reroll Complete!**' : '🔄 **Free Reroll Complete!**',
            embeds: [rerollEmbed, shopEmbed],
            components: buttons,
            ephemeral: true
        });
    }


    async function handleShopCommand(message) {
        try {
            console.log('[SHOP] handleShopCommand triggered');
            const args = message.content.split(' ');
            const command = args[1]?.toLowerCase();
            const userId = message.author.id;
            
            console.log('[SHOP] Getting user shop for:', userId);
            const userShop = await getUserShop(userId);
            console.log('[SHOP] userShop retrieved, keys:', Object.keys(userShop || {}).length);

            if (command === 'buy') {
                await handleBuyCommand(message, args, userId, userShop);
            } else if (command === 'search') {
                await handleSearchCommand(message, args, userShop);
            } else {
                console.log('[SHOP] Displaying shop');
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

        const confirmationEmbed = createPurchaseConfirmationEmbed(
            quantity,
            itemName,
            itemCost.cost * quantity,
            itemCost.currency
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
                const result = await processPurchase(userId, itemName, itemCost, quantity);

                if (result.success) {
                    await i.update({
                        content: `✅ You have successfully purchased **${result.quantity} ${result.itemName}(s)** for **${formatNumber(result.totalCost)} ${result.currency}**!`,
                        embeds: [],
                        components: [],
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
        const userShop = getUserShop(userId);

        const confirmationEmbed = createBuyAllConfirmationEmbed(userShop);
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
            const userShop = getUserShop(userId);
            const result = await processBuyAll(userId, userShop);

            if (result.success) {
                const summary = result.purchases
                    .map(p => `• ${p.quantity}x ${p.itemName} (${formatNumber(p.cost)} ${p.currency})`)
                    .join('\n');

                return interaction.editReply({
                    content:
                        `✅ **Bulk Purchase Complete!**\n\n${summary}\n\n` +
                        `**Total Spent:**\n💰 ${formatNumber(result.totalCoins)} coins\n` +
                        `💎 ${formatNumber(result.totalGems)} gems`,
                    embeds: [],
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

    async function handleSearchCommand(message, args, userShop) {
        const searchQuery = args.slice(2).join(' ').toLowerCase();
        const searchEmbed = createSearchResultsEmbed(searchQuery, userShop);
        message.reply({ embeds: [searchEmbed], ephemeral: true });
    }

    async function handleDisplayShop(message, userId, userShop) {
        try {
            console.log('[SHOP] handleDisplayShop called for user:', userId);
            console.log('[SHOP] userShop data:', JSON.stringify(userShop, null, 2));

            const rerollData = await getRerollData(userId);
            console.log('[SHOP] rerollData:', rerollData);

            const shopEmbed = await createShopEmbed(userId, userShop, 0);
            console.log('[SHOP] shopEmbed created');

            const buttons = await createShopButtons(userId, rerollData.count, 0);
            console.log('[SHOP] buttons created');

            await message.reply({ embeds: [shopEmbed], components: buttons, ephemeral: true });
            console.log('[SHOP] Reply sent successfully');
        } catch (error) {
            console.error('[SHOP] Error in handleDisplayShop:', error);
            await message.reply({
                content: '❌ Failed to load shop. Please try again.',
                ephemeral: true
            }).catch(console.error);
        }
    }
};