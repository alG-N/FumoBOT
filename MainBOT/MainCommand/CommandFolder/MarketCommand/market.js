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
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { get, all, run } = require('../../Core/database');
const { GLOBAL_SHOP_CONFIG } = require('../../Configuration/marketConfig');
const FumoPool = require('../../Data/FumoPool');

const CATEGORIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

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
        } else if (interaction.customId.startsWith('select_rarity_')) {
            await handleRaritySelection(interaction);
        } else if (interaction.customId.startsWith('select_variant_')) {
            await handleVariantSelection(interaction);
        } else if (interaction.customId.startsWith('select_currency_')) {
            await handleCurrencySelection(interaction);
        } else if (interaction.customId.startsWith('confirm_listing_')) {
            await handleConfirmListing(interaction);
        } else if (interaction.customId.startsWith('select_remove_listing_')) {
            await handleRemoveListingSelect(interaction);
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
        const allListings = await getAllGlobalListings();
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

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_rarity_${interaction.user.id}`)
            .setPlaceholder('Select Fumo Rarity')
            .addOptions(
                CATEGORIES.map(cat => ({
                    label: cat,
                    value: cat
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '**Step 1/4:** Select the rarity of your Fumo',
            components: [row],
            ephemeral: true
        });
    } catch (error) {
        console.error('Add listing error:', error);
        await interaction.reply({ 
            content: '❌ An error occurred.', 
            ephemeral: true 
        });
    }
}

async function handleRaritySelection(interaction) {
    try {
        const rarity = interaction.values[0];
        
        const userFumos = await all(
            `SELECT fumoName FROM userInventory WHERE userId = ? AND fumoName LIKE ?`,
            [interaction.user.id, `%(${rarity})`]
        );

        if (userFumos.length === 0) {
            return interaction.update({
                content: `❌ You don't have any **${rarity}** fumos.`,
                components: []
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_variant_${interaction.user.id}_${rarity}`)
            .setPlaceholder('Select Your Fumo')
            .addOptions(
                userFumos.slice(0, 25).map(f => ({
                    label: f.fumoName,
                    value: f.fumoName
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({
            content: '**Step 2/4:** Select which Fumo to list',
            components: [row]
        });
    } catch (error) {
        console.error('Rarity selection error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
    }
}

async function handleVariantSelection(interaction) {
    try {
        const fumoName = interaction.values[0];
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const rarity = parts[3];

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_currency_${userId}_${encodeURIComponent(fumoName)}`)
            .setPlaceholder('Select Currency')
            .addOptions([
                { label: '🪙 Coins', value: 'coins' },
                { label: '💎 Gems', value: 'gems' },
                { label: '🪙💎 Both', value: 'both' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({
            content: `**Step 3/4:** Select currency for **${fumoName}**`,
            components: [row]
        });
    } catch (error) {
        console.error('Variant selection error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
    }
}

async function handleCurrencySelection(interaction) {
    try {
        const currencyType = interaction.values[0];
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const fumoName = decodeURIComponent(parts[3]);

        if (currencyType === 'both') {
            await interaction.update({
                content: `**Step 4/4:** Enter prices for **${fumoName}**\nFormat: \`coins_amount gems_amount\`\nExample: \`1000000 50000\``,
                components: []
            });
        } else {
            await interaction.update({
                content: `**Step 4/4:** Enter the ${currencyType === 'coins' ? '🪙 coin' : '💎 gem'} price for **${fumoName}**`,
                components: []
            });
        }

        const filter = m => m.author.id === userId;
        const collected = await interaction.channel.awaitMessages({ 
            filter, 
            max: 1, 
            time: 60000 
        }).catch(() => null);

        if (!collected) {
            return interaction.followUp({ 
                content: '⏰ Time expired.', 
                ephemeral: true 
            });
        }

        const input = collected.first().content.trim();
        collected.first().delete().catch(() => {});

        let coinPrice = null;
        let gemPrice = null;

        if (currencyType === 'both') {
            const amounts = input.split(/\s+/);
            if (amounts.length !== 2 || isNaN(amounts[0]) || isNaN(amounts[1])) {
                return interaction.followUp({
                    content: '❌ Invalid format. Use: `coins_amount gems_amount`',
                    ephemeral: true
                });
            }
            coinPrice = parseInt(amounts[0]);
            gemPrice = parseInt(amounts[1]);
        } else {
            const price = parseInt(input);
            if (isNaN(price) || price < 1) {
                return interaction.followUp({
                    content: '❌ Price must be at least 1.',
                    ephemeral: true
                });
            }
            if (currencyType === 'coins') {
                coinPrice = price;
            } else {
                gemPrice = price;
            }
        }

        const confirmButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_listing_${userId}_${encodeURIComponent(fumoName)}_${coinPrice}_${gemPrice}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        let confirmText = `**Confirm Listing:**\n**Fumo:** ${fumoName}\n`;
        if (coinPrice) confirmText += `**Coin Price:** 🪙 ${coinPrice.toLocaleString()}\n`;
        if (gemPrice) confirmText += `**Gem Price:** 💎 ${gemPrice.toLocaleString()}\n`;

        await interaction.followUp({
            content: confirmText,
            components: [confirmButtons],
            ephemeral: true
        });
    } catch (error) {
        console.error('Currency selection error:', error);
        await interaction.followUp({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleConfirmListing(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const fumoName = decodeURIComponent(parts[3]);
        const coinPrice = parts[4] !== 'null' ? parseInt(parts[4]) : null;
        const gemPrice = parts[5] !== 'null' ? parseInt(parts[5]) : null;

        const userFumo = await get(
            `SELECT fumoName FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );

        if (!userFumo) {
            return interaction.update({
                content: `❌ You no longer have **${fumoName}** in your inventory.`,
                components: []
            });
        }

        await run(
            `DELETE FROM userInventory WHERE userId = ? AND fumoName = ? LIMIT 1`,
            [userId, fumoName]
        );

        if (coinPrice) {
            await addGlobalListing(userId, fumoName, coinPrice, 'coins');
        }
        if (gemPrice) {
            await addGlobalListing(userId, fumoName, gemPrice, 'gems');
        }

        let successText = `✅ Listed **${fumoName}**!\n`;
        if (coinPrice) successText += `🪙 Coin Price: ${coinPrice.toLocaleString()}\n`;
        if (gemPrice) successText += `💎 Gem Price: ${gemPrice.toLocaleString()}`;

        await interaction.update({
            content: successText,
            components: []
        });
    } catch (error) {
        console.error('Confirm listing error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
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

        const options = userListings.map((listing) => ({
            label: listing.fumoName,
            description: `${listing.price} ${listing.currency}`,
            value: `${listing.id}`
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_remove_listing_${interaction.user.id}`)
            .setPlaceholder('Select a listing to remove')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({ 
            content: 'Select a listing to remove:', 
            components: [row],
            ephemeral: true 
        });
    } catch (error) {
        console.error('Remove listing error:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleRemoveListingSelect(interaction) {
    try {
        const listingId = parseInt(interaction.values[0]);
        
        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ? AND userId = ?`,
            [listingId, interaction.user.id]
        );

        if (!listing) {
            return interaction.update({ 
                content: '❌ Listing not found.', 
                components: [] 
            });
        }

        await run(`DELETE FROM globalMarket WHERE id = ?`, [listingId]);

        await run(
            `INSERT INTO userInventory (userId, fumoName) VALUES (?, ?)`,
            [interaction.user.id, listing.fumoName]
        );

        await interaction.update({ 
            content: `✅ Removed listing for **${listing.fumoName}**. It has been returned to your inventory.`, 
            components: [] 
        });
    } catch (error) {
        console.error('Remove listing select error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
    }
}

async function handleRefreshGlobal(interaction) {
    try {
        const allListings = await getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);
        
        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        await interaction.update({ embeds: [embed], components: [buttons] });
    } catch (error) {
        console.error('Refresh global error:', error);
    }
}