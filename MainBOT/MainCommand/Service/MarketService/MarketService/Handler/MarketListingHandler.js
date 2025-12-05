const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUserGlobalListings, addGlobalListing, removeGlobalListing } = require('../MarketStorageService');
const { get, run, all } = require('../../../../Core/database');
const { GLOBAL_SHOP_CONFIG } = require('../../../../Configuration/marketConfig');
const { validateUserHasFumo, getFumoIdForRemoval, getAvailableVariants } = require('../MarketInventoryValidator');
const { createErrorEmbed } = require('../MarketUIService');
const { formatNumber } = require('../../../../Ultility/formatting')

const CATEGORIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???',
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const listingDataCache = new Map();

function parsePrice(str) {
    if (!str) return NaN;
    
    str = str.replace(/,/g, '').toLowerCase().trim();
    
    const suffixes = {
        'vg': 1e63,
        'nd': 1e60,
        'od': 1e57,
        'sd': 1e54,
        'sxd': 1e51,
        'qid': 1e48,
        'qad': 1e45,
        'td': 1e42,
        'dd': 1e39,
        'ud': 1e36,
        'dc': 1e33,
        'no': 1e30,
        'oc': 1e27,
        'sp': 1e24,
        'sx': 1e21,
        'qi': 1e18,
        'qa': 1e15,
        't': 1e12,
        'b': 1e9,
        'm': 1e6,
        'k': 1e3
    };
    
    for (const [suffix, multiplier] of Object.entries(suffixes)) {
        if (str.endsWith(suffix)) {
            const numPart = str.slice(0, -suffix.length);
            const num = parseFloat(numPart);
            if (isNaN(num)) return NaN;
            return Math.floor(num * multiplier);
        }
    }
    
    const num = parseFloat(str);
    return isNaN(num) ? NaN : Math.floor(num);
}

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
            content: '**Step 1/4:** Select the rarity of your Fumo',
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
            `SELECT 
                REPLACE(REPLACE(REPLACE(fumoName, '[✨SHINY]', ''), '[🌟alG]', ''), TRIM(fumoName), '') AS baseName,
                COUNT(*) AS variantCount
            FROM userInventory
            WHERE userId = ? AND fumoName LIKE ?
            GROUP BY REPLACE(REPLACE(REPLACE(fumoName, '[✨SHINY]', ''), '[🌟alG]', ''), TRIM(fumoName), '')`,
            [interaction.user.id, `%(${rarity})%`]
        );

        if (!baseFumos || baseFumos.length === 0) {
            return interaction.update({
                content: `❌ You don't have any **${rarity}** fumos.`,
                components: []
            });
        }

        // ✅ Remove empty names (the "250 variants" item)
        const filtered = baseFumos.filter(f => f.baseName.trim() !== "");

        if (filtered.length === 0) {
            return interaction.update({
                content: `❌ No valid fumos found for **${rarity}**.`,
                components: []
            });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_base_fumo_${interaction.user.id}_${rarity}`)
            .setPlaceholder('Select Your Fumo')
            .addOptions(
                filtered.slice(0, 25).map((f, idx) => ({
                    label: `${f.baseName.trim()} (${f.variantCount} total)`,  // <-- 🔥 changed variants → total
                    value: `${f.baseName.trim()}_${idx}`
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

        const uniqueVariants = [];
        const seen = new Set();

        for (const v of variants) {
            const key = v.fumoName;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueVariants.push(v);
            }
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_variant_${userId}_${Buffer.from(baseFumoName).toString('base64').substring(0, 30)}`)
            .setPlaceholder('Select version to list')
            .addOptions(
                uniqueVariants.map((v, idx) => {
                    const cleanName = v.fumoName.replace(/\(.*?\)/, '').trim();
                    let displayName = cleanName;
                    if (v.fumoName.includes('[✨SHINY]')) displayName = `${cleanName}`;
                    if (v.fumoName.includes('[🌟alG]')) displayName = `${cleanName}`;

                    return {
                        label: `${displayName} (x${v.count})`,
                        value: `${idx}`,
                        description: `List this version for sale`.substring(0, 100)
                    };
                })
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        listingDataCache.set(userId, { variants: uniqueVariants, baseFumoName });

        await interaction.update({
            content: `**Step 3/4:** Select which version to list`,
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

        const modal = new ModalBuilder()
            .setCustomId(`price_modal_${userId}_${variantIndex}`)
            .setTitle(`Set Prices for ${fumoName.substring(0, 30)}`);

        const coinInput = new TextInputBuilder()
            .setCustomId('coin_price')
            .setLabel('🪙 Coin Price (e.g., 1k, 500m, 2.5sp)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter coin price');

        const gemInput = new TextInputBuilder()
            .setCustomId('gem_price')
            .setLabel('💎 Gem Price (e.g., 100, 5k, 1.2qa)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Enter gem price');

        modal.addComponents(
            new ActionRowBuilder().addComponents(coinInput),
            new ActionRowBuilder().addComponents(gemInput)
        );

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Variant selection error:', error);
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

        const cached = listingDataCache.get(userId);
        if (!cached) {
            return interaction.reply({
                content: '❌ Session expired. Please start over.',
                ephemeral: true
            });
        }

        const fumoName = cached.variants[variantIndex].fumoName;

        const coinPriceStr = interaction.fields.getTextInputValue('coin_price');
        const gemPriceStr = interaction.fields.getTextInputValue('gem_price');

        const coinPrice = parsePrice(coinPriceStr);
        const gemPrice = parsePrice(gemPriceStr);

        if (isNaN(coinPrice) || coinPrice < 1) {
            return interaction.reply({
                content: '❌ Coin price must be a valid number greater than 0.',
                ephemeral: true
            });
        }

        if (isNaN(gemPrice) || gemPrice < 1) {
            return interaction.reply({
                content: '❌ Gem price must be a valid number greater than 0.',
                ephemeral: true
            });
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

        const confirmText = `**Confirm Listing:**\n**Fumo:** ${fumoName}\n` +
            `**Coin Price:** 🪙 ${formatNumber(coinPrice)}\n` +
            `**Gem Price:** 💎 ${formatNumber(gemPrice)}\n\n` +
            `✨ Buyers must pay **BOTH** currencies to purchase this fumo.`;

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
        const coinPrice = parseInt(parts[4]);
        const gemPrice = parseInt(parts[5]);

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

        const successText = `✅ Listed **${fumoName}**!\n\n` +
            `🪙 Coin Price: ${coinPrice.toLocaleString()}\n` +
            `💎 Gem Price: ${gemPrice.toLocaleString()}\n\n` +
            `Buyers must pay **BOTH** currencies to purchase!`;

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
            const coinPrice = listing.coinPrice || 0;
            const gemPrice = listing.gemPrice || 0;
            const priceText = `🪙${coinPrice.toLocaleString()} 💎${gemPrice.toLocaleString()}`;
            
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

        const coinPrice = listing.coinPrice || 0;
        const gemPrice = listing.gemPrice || 0;
        const priceText = `🪙 ${coinPrice.toLocaleString()} / 💎 ${gemPrice.toLocaleString()}`;

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
    handlePriceModal,
    handleConfirmListing,
    handleRemoveListing,
    handleRemoveListingSelect
};