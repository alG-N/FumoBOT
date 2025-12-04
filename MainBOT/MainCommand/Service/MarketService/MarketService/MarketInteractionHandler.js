const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getCoinMarket, getGemMarket } = require('./MarketCacheService');
const { getAllGlobalListings, getUserGlobalListings, addGlobalListing, removeGlobalListing, notifySellerOfSale } = require('./MarketStorageService');
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
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`global_purchase_select_${interaction.user.id}`)
            .setPlaceholder('Select a fumo to purchase')
            .setDisabled(display.length === 0);

        if (display.length > 0) {
            const options = display.map((listing, idx) => {
                const currencyEmoji = listing.currency === 'coins' ? '🪙' : '💎';
                return {
                    label: listing.fumoName.substring(0, 100),
                    value: `${listing.id}`,
                    description: `${currencyEmoji} ${listing.price.toLocaleString()}`.substring(0, 100)
                };
            });
            selectMenu.addOptions(options);
        } else {
            selectMenu.addOptions({
                label: 'No listings available',
                value: 'none'
            });
        }

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({ embeds: [embed], components: [selectRow, buttons] });
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

        const userFumos = await all(
            `SELECT fumoName, SUM(quantity) as count 
             FROM userInventory 
             WHERE userId = ? AND fumoName LIKE ? 
             GROUP BY fumoName
             ORDER BY fumoName`,
            [interaction.user.id, `%(${rarity})%`]
        );

        if (!userFumos || userFumos.length === 0) {
            return interaction.update({
                content: `❌ You don't have any **${rarity}** fumos.`,
                components: []
            });
        }

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
        const userId = parts[3];
        const rarity = parts.slice(4).join('_');

        const variants = await getAvailableVariants(userId, baseFumoName);

        if (variants.length === 0) {
            const allUserFumos = await all(
                `SELECT fumoName FROM userInventory WHERE userId = ? LIMIT 10`,
                [userId]
            );            
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
                { label: '🪙💎 Both (creates 2 listings)', value: 'both' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.update({
            content: `**Step 4/5:** Select currency for **${fumoName}**\n\n⚠️ **Note:** Selecting "Both" will create TWO separate listings (one for coins, one for gems) and will require TWO copies of this fumo.`,
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
            const validation = await validateUserHasFumo(userId, fumoName);
            const totalCopies = validation.variants.reduce((sum, v) => sum + v.count, 0);
            
            if (totalCopies < 2) {
                return interaction.update({
                    content: `❌ You need at least 2 copies of **${fumoName}** to list with both currencies. You have ${totalCopies}.`,
                    components: []
                });
            }
        }

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
        if (coinPrice && gemPrice) {
            confirmText += `\n⚠️ **This will create 2 separate listings and use 2 copies of your fumo:**\n`;
            confirmText += `**Coin Listing:** 🪙 ${coinPrice.toLocaleString()}\n`;
            confirmText += `**Gem Listing:** 💎 ${gemPrice.toLocaleString()}\n`;
        } else if (coinPrice) {
            confirmText += `**Coin Price:** 🪙 ${coinPrice.toLocaleString()}\n`;
        } else if (gemPrice) {
            confirmText += `**Gem Price:** 💎 ${gemPrice.toLocaleString()}\n`;
        }

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

        const validation = await validateUserHasFumo(userId, fumoName);

        if (!validation.found) {
            return interaction.update({
                content: `❌ You no longer have **${fumoName}** in your inventory.`,
                components: []
            });
        }

        const totalCopies = validation.variants.reduce((sum, v) => sum + v.count, 0);
        const requiredCopies = (coinPrice && gemPrice) ? 2 : 1;

        if (totalCopies < requiredCopies) {
            return interaction.update({
                content: `❌ You need ${requiredCopies} copies but only have ${totalCopies} of **${fumoName}**.`,
                components: []
            });
        }

        if (coinPrice) {
            const fumoId = await getFumoIdForRemoval(userId, fumoName);
            if (!fumoId) {
                return interaction.update({
                    content: `❌ Could not find **${fumoName}** in your inventory.`,
                    components: []
                });
            }
            await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
            await addGlobalListing(userId, fumoName, coinPrice, 'coins');
        }

        if (gemPrice) {
            const fumoId = await getFumoIdForRemoval(userId, fumoName);
            if (!fumoId) {
                return interaction.update({
                    content: `❌ Could not find **${fumoName}** in your inventory.`,
                    components: []
                });
            }
            await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
            await addGlobalListing(userId, fumoName, gemPrice, 'gems');
        }

        let successText = `✅ Listed **${fumoName}**!\n`;
        if (coinPrice && gemPrice) {
            successText += `\n🪙 Coin Listing: ${coinPrice.toLocaleString()}\n`;
            successText += `💎 Gem Listing: ${gemPrice.toLocaleString()}\n`;
            successText += `\n(2 copies used, 2 listings created)`;
        } else if (coinPrice) {
            successText += `🪙 Coin Price: ${coinPrice.toLocaleString()}`;
        } else if (gemPrice) {
            successText += `💎 Gem Price: ${gemPrice.toLocaleString()}`;
        }

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
            label: listing.fumoName.substring(0, 100),
            description: `${listing.currency === 'coins' ? '🪙' : '💎'} ${listing.price}`,
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
            content: `✅ Removed listing for **${listing.fumoName}** (${listing.currency === 'coins' ? '🪙' : '💎'} ${listing.price}). It has been returned to your inventory.`,
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
        await interaction.deferUpdate();

        const allListings = await getAllGlobalListings();
        const shuffled = allListings.sort(() => Math.random() - 0.5);
        const display = shuffled.slice(0, 5);

        const embed = createGlobalShopEmbed(display);
        const buttons = createGlobalShopButtons(interaction.user.id);
        
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`global_purchase_select_${interaction.user.id}`)
            .setPlaceholder('Select a fumo to purchase')
            .setDisabled(display.length === 0);

        if (display.length > 0) {
            const options = display.map((listing, idx) => {
                const currencyEmoji = listing.currency === 'coins' ? '🪙' : '💎';
                return {
                    label: listing.fumoName.substring(0, 100),
                    value: `${listing.id}`,
                    description: `${currencyEmoji} ${listing.price.toLocaleString()}`.substring(0, 100)
                };
            });
            selectMenu.addOptions(options);
        } else {
            selectMenu.addOptions({
                label: 'No listings available',
                value: 'none'
            });
        }

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({ embeds: [embed], components: [selectRow, buttons] });
    } catch (error) {
        console.error('Refresh global error:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Failed to refresh.', ephemeral: true });
        }
    }
}

async function handleGlobalPurchaseSelect(interaction) {
    try {
        const listingId = parseInt(interaction.values[0]);

        if (isNaN(listingId)) {
            return interaction.reply({
                content: '❌ Invalid selection.',
                ephemeral: true
            });
        }

        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ?`,
            [listingId]
        );

        if (!listing) {
            return interaction.reply({
                content: '❌ This listing is no longer available.',
                ephemeral: true
            });
        }

        if (listing.userId === interaction.user.id) {
            return interaction.reply({
                content: '❌ You cannot buy your own listing.',
                ephemeral: true
            });
        }

        const validation = await validateGlobalPurchase(interaction.user.id, listing);

        if (!validation.valid) {
            return interaction.reply({
                embeds: [createErrorEmbed(validation.error, validation)],
                ephemeral: true
            });
        }

        const confirmEmbed = createPurchaseConfirmEmbed(
            { name: listing.fumoName, price: listing.price },
            1,
            listing.price,
            listing.currency
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_global_purchase_${listingId}_${interaction.user.id}`)
                .setLabel('✅ Confirm Purchase')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${interaction.user.id}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            embeds: [confirmEmbed],
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Global purchase select error:', error);
        await interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true
        });
    }
}

async function handleConfirmGlobalPurchase(interaction) {
    try {
        const parts = interaction.customId.split('_');
        const listingId = parseInt(parts[3]);

        const listing = await get(
            `SELECT * FROM globalMarket WHERE id = ?`,
            [listingId]
        );

        if (!listing) {
            return interaction.update({
                content: '❌ This listing is no longer available.',
                embeds: [],
                components: []
            });
        }

        const validation = await validateGlobalPurchase(interaction.user.id, listing);

        if (!validation.valid) {
            return interaction.update({
                embeds: [createErrorEmbed(validation.error, validation)],
                components: []
            });
        }

        const { remainingBalance } = await processGlobalPurchase(interaction.user.id, listing);

        await notifySellerOfSale(
            interaction.client,
            listing.userId,
            listing.fumoName,
            listing.price,
            listing.currency,
            interaction.user.username
        );

        const successEmbed = createPurchaseSuccessEmbed(
            { name: listing.fumoName, price: listing.price },
            1,
            remainingBalance,
            listing.currency
        );

        await interaction.update({
            embeds: [successEmbed],
            components: []
        });

    } catch (error) {
        console.error('Confirm global purchase error:', error);
        await interaction.update({
            embeds: [createErrorEmbed('PROCESSING_ERROR')],
            components: []
        });
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
    handleRefreshGlobal,
    handleGlobalPurchaseSelect,
    handleConfirmGlobalPurchase
};