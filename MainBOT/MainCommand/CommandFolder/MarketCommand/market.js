const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');
const { getCoinMarket, getGemMarket } = require('../../Service/MarketService/MarketService/MarketCacheService');
const { getAllGlobalListings, getUserGlobalListings, addGlobalListing, removeGlobalListing } = require('../../Service/MarketService/MarketService/MarketStorageService');
const { validateShopPurchase, processShopPurchase, validateGlobalPurchase, processGlobalPurchase } = require('../../Service/MarketService/MarketService/MarketPurchaseService');
const { 
    createMainShopEmbed, 
    createCoinShopEmbed, 
    createGemShopEmbed,
    createGlobalShopEmbed,
    createMainShopButtons,
    createShopSelectMenu,
    createBackButton,
    createGlobalShopButtons,
    createPurchaseConfirmEmbed,
    createPurchaseSuccessEmbed,
    createErrorEmbed
} = require('../../Service/MarketService/MarketService/MarketUIService');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, all } = require('../../Core/database');
const { GLOBAL_SHOP_CONFIG } = require('../../Configuration/marketConfig');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const isMarketCommand = message.content === '.market' || message.content === '.m';
        
        if (!isMarketCommand) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        await showMainShop(message);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

        const userId = interaction.user.id;

        if (interaction.customId.startsWith('coin_shop_')) {
            if (!checkButtonOwnership(interaction, 'coin_shop')) return;
            await handleCoinShop(interaction);
        } else if (interaction.customId.startsWith('gem_shop_')) {
            if (!checkButtonOwnership(interaction, 'gem_shop')) return;
            await handleGemShop(interaction);
        } else if (interaction.customId.startsWith('global_shop_')) {
            if (!checkButtonOwnership(interaction, 'global_shop')) return;
            await handleGlobalShop(interaction);
        } else if (interaction.customId.startsWith('back_main_')) {
            if (!checkButtonOwnership(interaction, 'back_main')) return;
            await handleBackToMain(interaction);
        } else if (interaction.customId.startsWith('select_fumo_coin_')) {
            if (!checkButtonOwnership(interaction, 'select_fumo_coin')) return;
            await handleFumoSelection(interaction, 'coin');
        } else if (interaction.customId.startsWith('select_fumo_gem_')) {
            if (!checkButtonOwnership(interaction, 'select_fumo_gem')) return;
            await handleFumoSelection(interaction, 'gem');
        } else if (interaction.customId.startsWith('confirm_purchase_')) {
            await handleConfirmPurchase(interaction);
        } else if (interaction.customId.startsWith('cancel_purchase_')) {
            await handleCancelPurchase(interaction);
        } else if (interaction.customId.startsWith('add_listing_')) {
            if (!checkButtonOwnership(interaction, 'add_listing')) return;
            await handleAddListing(interaction);
        } else if (interaction.customId.startsWith('remove_listing_')) {
            if (!checkButtonOwnership(interaction, 'remove_listing')) return;
            await handleRemoveListing(interaction);
        } else if (interaction.customId.startsWith('refresh_global_')) {
            if (!checkButtonOwnership(interaction, 'refresh_global')) return;
            await handleRefreshGlobal(interaction);
        }
    });
};

async function showMainShop(message) {
    try {
        const embed = await createMainShopEmbed(message.author.id);
        const buttons = createMainShopButtons(message.author.id);
        await message.reply({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Main shop error:', error);
        await message.reply('❌ Failed to load shop. Please try again.');
    }
}

async function handleCoinShop(interaction) {
    try {
        const market = getCoinMarket(interaction.user.id);
        const embed = await createCoinShopEmbed(interaction.user.id, market.market, market.resetTime);
        const selectMenu = createShopSelectMenu(interaction.user.id, market.market, 'coin');
        const backButton = createBackButton(interaction.user.id);
        
        await interaction.update({ embeds: [embed], components: [selectMenu, backButton] });
    } catch (error) {
        console.error('Coin shop error:', error);
        await interaction.reply({ content: '❌ Failed to load coin shop.', ephemeral: true });
    }
}

async function handleGemShop(interaction) {
    try {
        const market = getGemMarket(interaction.user.id);
        const embed = await createGemShopEmbed(interaction.user.id, market.market, market.resetTime);
        const selectMenu = createShopSelectMenu(interaction.user.id, market.market, 'gem');
        const backButton = createBackButton(interaction.user.id);
        
        await interaction.update({ embeds: [embed], components: [selectMenu, backButton] });
    } catch (error) {
        console.error('Gem shop error:', error);
        await interaction.reply({ content: '❌ Failed to load gem shop.', ephemeral: true });
    }
}

async function handleGlobalShop(interaction) {
    try {
        const allListings = getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);
        
        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Global shop error:', error);
        await interaction.reply({ content: '❌ Failed to load global shop.', ephemeral: true });
    }
}

async function handleBackToMain(interaction) {
    try {
        const embed = await createMainShopEmbed(interaction.user.id);
        const buttons = createMainShopButtons(interaction.user.id);
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Back to main error:', error);
    }
}

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
        
        await interaction.reply({
            content: `How many **${fumo.name}** do you want to buy? (Max: ${fumo.stock})`,
            ephemeral: true
        });
        
        const filter = m => m.author.id === interaction.user.id;
        const collected = await interaction.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: 30000,
            errors: ['time']
        }).catch(() => null);
        
        if (!collected) {
            return interaction.followUp({ 
                content: '⏰ Time expired.', 
                ephemeral: true 
            });
        }
        
        const amount = parseInt(collected.first().content);
        
        if (isNaN(amount) || amount < 1 || amount > fumo.stock) {
            return interaction.followUp({ 
                embeds: [createErrorEmbed('INVALID_AMOUNT', { max: fumo.stock })], 
                ephemeral: true 
            });
        }
        
        collected.first().delete().catch(() => {});
        
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
        
        await interaction.followUp({ embeds: [confirmEmbed], components: [row], ephemeral: true });
        
    } catch (error) {
        console.error('Fumo selection error:', error);
        await interaction.followUp({ 
            content: '❌ An error occurred.', 
            ephemeral: true 
        });
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

async function handleAddListing(interaction) {
    try {
        const userListings = await getUserGlobalListings(interaction.user.id);
        
        if (userListings.length >= GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER) {
            return interaction.reply({ 
                embeds: [createErrorEmbed('MAX_LISTINGS')], 
                ephemeral: true 
            });
        }

        await interaction.reply({
            content: 'Type the name of the Fumo you want to sell (e.g., `Reimu(Common)` or `Sakuya(UNCOMMON)[✨SHINY]`)',
            ephemeral: true
        });

        const filter = m => m.author.id === interaction.user.id;
        const nameCollected = await interaction.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: 30000 
        }).catch(() => null);

        if (!nameCollected) {
            return interaction.followUp({ 
                content: '⏰ Time expired.', 
                ephemeral: true 
            });
        }

        const fumoName = nameCollected.first().content.trim();
        nameCollected.first().delete().catch(() => {});

        const userFumo = await get(
            `SELECT fumoName FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [interaction.user.id, fumoName]
        );

        if (!userFumo) {
            return interaction.followUp({ 
                content: `❌ You don't have **${fumoName}** in your inventory.`, 
                ephemeral: true 
            });
        }

        await interaction.followUp({
            content: 'Enter the price (e.g., `1000 coins` or `500 gems`)',
            ephemeral: true
        });

        const priceCollected = await interaction.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: 30000 
        }).catch(() => null);

        if (!priceCollected) {
            return interaction.followUp({ 
                content: '⏰ Time expired.', 
                ephemeral: true 
            });
        }

        const priceInput = priceCollected.first().content.trim().toLowerCase();
        priceCollected.first().delete().catch(() => {});

        const match = priceInput.match(/^(\d+)\s*(coins?|gems?)$/);
        if (!match) {
            return interaction.followUp({ 
                content: '❌ Invalid format. Use: `1000 coins` or `500 gems`', 
                ephemeral: true 
            });
        }

        const price = parseInt(match[1]);
        const currency = match[2].startsWith('gem') ? 'gems' : 'coins';

        if (price < 1) {
            return interaction.followUp({ 
                content: '❌ Price must be at least 1.', 
                ephemeral: true 
            });
        }

        await run(
            `DELETE FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [interaction.user.id, fumoName]
        );

        await addGlobalListing(interaction.user.id, fumoName, price, currency);

        await interaction.followUp({ 
            content: `✅ Listed **${fumoName}** for **${price} ${currency}**!`, 
            ephemeral: true 
        });

    } catch (error) {
        console.error('Add listing error:', error);
        await interaction.followUp({ 
            content: '❌ An error occurred.', 
            ephemeral: true 
        }).catch(() => {});
    }
}

async function handleRemoveListing(interaction) {
    try {
        const userListings = await getUserGlobalListings(interaction.user.id);
        
        if (userListings.length === 0) {
            return interaction.reply({ 
                content: '⚠️ You have no active listings.', 
                ephemeral: true 
            });
        }

        const options = userListings.map((listing, idx) => ({
            label: listing.fumoName,
            description: `${listing.price} ${listing.currency}`,
            value: `${listing.id}`
        }));

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`remove_listing_select_${interaction.user.id}`)
                .setPlaceholder('Select a listing to remove')
                .addOptions(options)
        );

        await interaction.reply({ 
            content: 'Select a listing to remove:', 
            components: [selectMenu],
            ephemeral: true 
        });

        const selectFilter = i => i.customId === `remove_listing_select_${interaction.user.id}` && i.user.id === interaction.user.id;
        const selectCollected = await interaction.channel.awaitMessageComponent({ 
            filter: selectFilter, 
            time: 30000 
        }).catch(() => null);

        if (!selectCollected) {
            return interaction.editReply({ 
                content: '⏰ Time expired.', 
                components: [] 
            });
        }

        const listingId = parseInt(selectCollected.values[0]);
        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ? AND userId = ?`,
            [listingId, interaction.user.id]
        );

        if (!listing) {
            return selectCollected.update({ 
                content: '❌ Listing not found.', 
                components: [] 
            });
        }

        await run(`DELETE FROM globalMarket WHERE id = ?`, [listingId]);

        await run(
            `INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`,
            [interaction.user.id, listing.fumoName]
        );

        await selectCollected.update({ 
            content: `✅ Removed listing for **${listing.fumoName}**. It has been returned to your inventory.`, 
            components: [] 
        });

    } catch (error) {
        console.error('Remove listing error:', error);
    }
}

async function handleRefreshGlobal(interaction) {
    try {
        const allListings = getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);
        
        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Refresh global error:', error);
    }
}