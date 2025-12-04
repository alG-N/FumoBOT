const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUserGlobalListings, addGlobalListing, removeGlobalListing } = require('../MarketStorageService');
const { get, run, all } = require('../../../../Core/database');
const { GLOBAL_SHOP_CONFIG } = require('../../../../Configuration/marketConfig');
const { validateUserHasFumo, getFumoIdForRemoval, getAvailableVariants } = require('../MarketInventoryValidator');
const { createErrorEmbed } = require('../MarketUIService');

const CATEGORIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const listingDataCache = new Map();

async function handleAddListing(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const userListings = await getUserGlobalListings(interaction.user.id);

        if (userListings.length >= GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER) {
            return interaction.editReply({
                embeds: [createErrorEmbed('MAX_LISTINGS')]
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

        await interaction.editReply({
            content: '**Step 1/5:** Select the rarity of your Fumo',
            components: [row]
        });
    } catch (error) {
        console.error('Add listing error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ An error occurred.'
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            });
        }
    }
}

async function handleRaritySelection(interaction) {
    try {
        const valueWithIndex = interaction.values[0];
        const rarity = valueWithIndex.split('_').slice(0, -1).join('_');

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
            return interaction.update({
                content: `❌ You don't have any copies of **${baseFumoName}**.`,
                components: []
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_variant_${userId}_${Buffer.from(baseFumoName).toString('base64').substring(0, 30)}`)
            .setPlaceholder('Select Variant (Base, SHINY, or alG)')
            .addOptions(
                variants.map((v, idx) => {
                    let variantLabel = 'Base';
                    if (v.fumoName.includes('[✨SHINY]')) variantLabel = '✨ SHINY';
                    if (v.fumoName.includes('[🌟alG]')) variantLabel = '🌟 alG';

                    return {
                        label: `${variantLabel} (x${v.count})`,
                        value: `${idx}`,
                        description: v.fumoName.substring(0, 100)
                    };
                })
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        listingDataCache.set(userId, { variants, baseFumoName });

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
        const variantIndex = parseInt(interaction.values[0]);
        const parts = interaction.customId.split('_');
        const userId = parts[2];

        const cached = listingDataCache.get(userId);
        if (!cached) {
            return interaction.update({
                content: '❌ Session expired. Please start over.',
                components: []
            });
        }

        const fumoName = cached.variants[variantIndex].fumoName;

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_currency_${userId}_${variantIndex}`)
            .setPlaceholder('Select Currency')
            .addOptions([
                { label: '🪙 Coins', value: 'coins' },
                { label: '💎 Gems', value: 'gems' },
                { label: '🪙💎 Both Coins and Gems', value: 'both' }
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
        const variantIndex = parseInt(parts[3]);

        const cached = listingDataCache.get(userId);
        if (!cached) {
            return interaction.update({
                content: '❌ Session expired. Please start over.',
                components: []
            });
        }

        const fumoName = cached.variants[variantIndex].fumoName;

        const modal = new ModalBuilder()
            .setCustomId(`price_modal_${userId}_${variantIndex}_${currencyType}`)
            .setTitle(`Set Price`);

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
        const variantIndex = parseInt(parts[3]);
        const currencyType = parts[4];

        const cached = listingDataCache.get(userId);
        if (!cached) {
            return interaction.reply({
                content: '❌ Session expired. Please start over.',
                ephemeral: true
            });
        }

        const fumoName = cached.variants[variantIndex].fumoName;

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
                .setCustomId(`confirm_listing_${userId}_${variantIndex}_${coinPrice}_${gemPrice}`)
                .setLabel('✅ Confirm')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_purchase_${userId}`)
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Danger)
        );

        let confirmText = `**Confirm Listing:**\n**Fumo:** ${fumoName}\n`;
        if (coinPrice && gemPrice) {
            confirmText += `**Coin Price:** 🪙 ${coinPrice.toLocaleString()}\n`;
            confirmText += `**Gem Price:** 💎 ${gemPrice.toLocaleString()}\n`;
            confirmText += `\n✨ This fumo will be available for purchase with either currency.`;
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
        const variantIndex = parseInt(parts[3]);
        const coinPrice = parts[4] !== 'null' ? parseInt(parts[4]) : null;
        const gemPrice = parts[5] !== 'null' ? parseInt(parts[5]) : null;

        const cached = listingDataCache.get(userId);
        if (!cached) {
            return interaction.update({
                content: '❌ Session expired. Please start over.',
                components: []
            });
        }

        const fumoName = cached.variants[variantIndex].fumoName;

        const validation = await validateUserHasFumo(userId, fumoName);

        if (!validation.found) {
            return interaction.update({
                content: `❌ You no longer have **${fumoName}** in your inventory.`,
                components: []
            });
        }

        const fumoId = await getFumoIdForRemoval(userId, fumoName);
        if (!fumoId) {
            return interaction.update({
                content: `❌ Could not find **${fumoName}** in your inventory.`,
                components: []
            });
        }

        await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
        await addGlobalListing(userId, fumoName, coinPrice, gemPrice);

        listingDataCache.delete(userId);

        let successText = `✅ Listed **${fumoName}**!\n`;
        if (coinPrice && gemPrice) {
            successText += `\n🪙 Coin Price: ${coinPrice.toLocaleString()}\n`;
            successText += `💎 Gem Price: ${gemPrice.toLocaleString()}\n`;
            successText += `\nBuyers can purchase with either currency!`;
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
        await interaction.deferReply({ ephemeral: true });

        const userListings = await getUserGlobalListings(interaction.user.id);

        if (userListings.length === 0) {
            return interaction.editReply({
                content: '⚠️ You have no active listings.'
            });
        }

        const options = userListings.map((listing, idx) => {
            let priceText = '';
            if (listing.coinPrice && listing.gemPrice) {
                priceText = `🪙${listing.coinPrice} 💎${listing.gemPrice}`;
            } else if (listing.coinPrice) {
                priceText = `🪙${listing.coinPrice}`;
            } else if (listing.gemPrice) {
                priceText = `💎${listing.gemPrice}`;
            }
            
            return {
                label: listing.fumoName.substring(0, 100),
                description: priceText,
                value: `${listing.id}_${idx}`
            };
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_remove_listing_${interaction.user.id}`)
            .setPlaceholder('Select a listing to remove')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            content: 'Select a listing to remove:',
            components: [row]
        });
    } catch (error) {
        console.error('Remove listing error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                content: '❌ An error occurred.'
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                content: '❌ An error occurred.',
                ephemeral: true
            });
        }
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

        let priceText = '';
        if (listing.coinPrice && listing.gemPrice) {
            priceText = `🪙 ${listing.coinPrice} / 💎 ${listing.gemPrice}`;
        } else if (listing.coinPrice) {
            priceText = `🪙 ${listing.coinPrice}`;
        } else if (listing.gemPrice) {
            priceText = `💎 ${listing.gemPrice}`;
        }

        await interaction.update({
            content: `✅ Removed listing for **${listing.fumoName}** (${priceText}). It has been returned to your inventory.`,
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

module.exports = {
    handleAddListing,
    handleRaritySelection,
    handleBaseFumoSelection,
    handleVariantSelection,
    handleCurrencySelection,
    handlePriceModal,
    handleConfirmListing,
    handleRemoveListing,
    handleRemoveListingSelect
};