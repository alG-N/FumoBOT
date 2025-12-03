const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getCoinMarket, getGemMarket } = require('./MarketCacheService');
const { getAllGlobalListings, getUserGlobalListings, addGlobalListing, removeGlobalListing } = require('./MarketStorageService');
const { validateShopPurchase, processShopPurchase, validateGlobalPurchase, processGlobalPurchase } = require('./MarketPurchaseService');
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
} = require('./MarketUIService');
const { get, run, all} = require('../../../Core/database');
const { GLOBAL_SHOP_CONFIG } = require('../../../Configuration/marketConfig');
const { validateUserHasFumo, getFumoIdForRemoval, getAvailableVariants } = require('./MarketInventoryValidator');

const CATEGORIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

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
                CATEGORIES.map((cat, idx) => ({
                    label: cat,
                    value: `${cat}_${idx}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.reply({
            content: '**Step 1/5:** Select the rarity of your Fumo',
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
        const valueWithIndex = interaction.values[0];
        const rarity = valueWithIndex.split('_').slice(0, -1).join('_');

        // Get all fumos with this rarity (including trait variants)
        const userFumos = await get(
            `SELECT fumoName, SUM(quantity) as count 
             FROM userInventory 
             WHERE userId = ? AND fumoName LIKE ? 
             GROUP BY fumoName
             ORDER BY fumoName`,
            [interaction.user.id, `%(${rarity})%`]
        );

        if (!userFumos || userFumos.count === 0) {
            return interaction.update({
                content: `❌ You don't have any **${rarity}** fumos.`,
                components: []
            });
        }

        // Get unique base fumo names (without traits)
        const baseFumos = await all(
            `SELECT REPLACE(REPLACE(fumoName, '[✨SHINY]', ''), '[🌟alG]', '') as baseName,
                COUNT(*) as variantCount
                FROM userInventory
                WHERE userId = ? AND fumoName LIKE ?
                GROUP BY baseName`,
            [interaction.user.id, `%(${rarity})%`]
        );

        if (!baseFumos || baseFumos.length === 0) {
            return interaction.update({
                content: `❌ You don't have any **${rarity}** fumos.`,
                components: []
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_base_fumo_${interaction.user.id}_${rarity}`)
            .setPlaceholder('Select Your Fumo')
            .addOptions(
                baseFumos.slice(0, 25).map((f, idx) => ({
                    label: `${f.baseName.trim()} (${f.variantCount} variant${f.variantCount > 1 ? 's' : ''})`,
                    value: `${f.baseName.trim()}_${idx}`
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({
            content: '**Step 2/5:** Select which Fumo to list',
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

async function handleBaseFumoSelection(interaction) {
    try {
        const valueWithIndex = interaction.values[0];
        const baseFumoName = valueWithIndex.split('_').slice(0, -1).join('_');
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const rarity = parts[3];

        // Get all variants of this base fumo
        const variants = await getAvailableVariants(userId, baseFumoName);

        if (variants.length === 0) {
            return interaction.update({
                content: `❌ You don't have any copies of **${baseFumoName}**.`,
                components: []
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_variant_${userId}_${encodeURIComponent(baseFumoName)}`)
            .setPlaceholder('Select Variant (Base, SHINY, or alG)')
            .addOptions(
                variants.map((v, idx) => {
                    let variantLabel = 'Base';
                    if (v.fumoName.includes('[✨SHINY]')) variantLabel = '✨ SHINY';
                    if (v.fumoName.includes('[🌟alG]')) variantLabel = '🌟 alG';

                    return {
                        label: `${variantLabel} (x${v.count})`,
                        value: `${v.fumoName}_${idx}`,
                        description: v.fumoName
                    };
                })
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({
            content: `**Step 3/5:** Select variant for **${baseFumoName}**`,
            components: [row]
        });
    } catch (error) {
        console.error('Base fumo selection error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
    }
}

async function handleVariantSelection(interaction) {
    try {
        const valueWithIndex = interaction.values[0];
        const fumoName = valueWithIndex.split('_').slice(0, -1).join('_');
        const parts = interaction.customId.split('_');
        const userId = parts[2];

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
            content: `**Step 4/5:** Select currency for **${fumoName}**`,
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

        const modal = new ModalBuilder()
            .setCustomId(`price_modal_${userId}_${encodeURIComponent(fumoName)}_${currencyType}`)
            .setTitle(`Set Price for ${fumoName.substring(0, 30)}`);

        if (currencyType === 'both') {
            const coinInput = new TextInputBuilder()
                .setCustomId('coin_price')
                .setLabel('🪙 Coin Price')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Enter coin price');

            const gemInput = new TextInputBuilder()
                .setCustomId('gem_price')
                .setLabel('💎 Gem Price')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('Enter gem price');

            modal.addComponents(
                new ActionRowBuilder().addComponents(coinInput),
                new ActionRowBuilder().addComponents(gemInput)
            );
        } else {
            const priceInput = new TextInputBuilder()
                .setCustomId('price')
                .setLabel(`${currencyType === 'coins' ? '🪙 Coin' : '💎 Gem'} Price`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder(`Enter ${currencyType} price`);

            modal.addComponents(new ActionRowBuilder().addComponents(priceInput));
        }

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Currency selection error:', error);
        await interaction.update({
            content: '❌ An error occurred.',
            components: []
        });
    }
}

async function handlePriceModal(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const fumoName = decodeURIComponent(parts[3]);
        const currencyType = parts[4];

        let coinPrice = null;
        let gemPrice = null;

        if (currencyType === 'both') {
            coinPrice = parseInt(interaction.fields.getTextInputValue('coin_price'));
            gemPrice = parseInt(interaction.fields.getTextInputValue('gem_price'));

            if (isNaN(coinPrice) || isNaN(gemPrice) || coinPrice < 1 || gemPrice < 1) {
                return interaction.reply({
                    content: '❌ Both prices must be valid numbers greater than 0.',
                    ephemeral: true
                });
            }
        } else {
            const price = parseInt(interaction.fields.getTextInputValue('price'));

            if (isNaN(price) || price < 1) {
                return interaction.reply({
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

        await interaction.reply({
            content: confirmText,
            components: [confirmButtons],
            ephemeral: true
        });
    } catch (error) {
        console.error('Price modal error:', error);
        await interaction.reply({
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

        // Validate user has this fumo (including any variant)
        const validation = await validateUserHasFumo(userId, fumoName);

        if (!validation.found) {
            return interaction.update({
                content: `❌ You no longer have **${fumoName}** (or any variant) in your inventory.`,
                components: []
            });
        }

        // Get the ID of one copy to remove
        const fumoId = await getFumoIdForRemoval(userId, fumoName);

        if (!fumoId) {
            return interaction.update({
                content: `❌ Could not find **${fumoName}** in your inventory.`,
                components: []
            });
        }

        // Remove from inventory
        await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);

        // Add listing(s)
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

        const options = userListings.map((listing, idx) => ({
            label: listing.fumoName,
            description: `${listing.price} ${listing.currency}`,
            value: `${listing.id}_${idx}`
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
        const valueWithIndex = interaction.values[0];
        const listingId = parseInt(valueWithIndex.split('_')[0]);

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

module.exports = {
    handleCoinShop,
    handleGemShop,
    handleGlobalShop,
    handleBackToMain,
    handleFumoSelection,
    handleConfirmPurchase,
    handleCancelPurchase,
    handleAddListing,
    handleRaritySelection,
    handleBaseFumoSelection,
    handleVariantSelection,
    handleCurrencySelection,
    handlePriceModal,
    handleConfirmListing,
    handleRemoveListing,
    handleRemoveListingSelect,
    handleRefreshGlobal
};