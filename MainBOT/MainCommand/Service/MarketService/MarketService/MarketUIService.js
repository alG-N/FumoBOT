const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { get } = require('../../../Core/database');
const { rarityLevels, gemShopRarityLevels, GLOBAL_SHOP_CONFIG } = require('../../../Configuration/marketConfig');
const { formatNumber } = require('../../../Ultility/formatting');

async function createMainShopEmbed(userId) {
    const row = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
    
    const embed = new EmbedBuilder()
        .setTitle("🎪 Golden's Market Extravaganza 🎪")
        .setDescription(
            `✨ **Welcome to the market!** ✨\n\n` +
            `**🪙 Coin Shop** - Refreshes hourly\n` +
            `**💎 Gem Shop** - Refreshes every 6 hours\n` +
            `**🌐 Global Shop** - Player marketplace\n`
        )
        .setColor('#f5b042')
        .setThumbnail('https://media.tenor.com/rFFZ4WbQq3EAAAAC/fumo.gif');
    
    if (row) {
        embed.addFields(
            { name: '🪙 Your Coins', value: `\`${formatNumber(row.coins)}\``, inline: true },
            { name: '💎 Your Gems', value: `\`${formatNumber(row.gems)}\``, inline: true }
        );
    }
    
    return embed;
}

async function createCoinShopEmbed(userId, market, resetTime) {
    const remainingTime = Math.max(Math.floor((resetTime - Date.now()) / 60000), 0);
    const row = await get(`SELECT coins FROM userCoins WHERE userId = ?`, [userId]);
    
    const embed = new EmbedBuilder()
        .setTitle("🪙 Coin Shop")
        .setDescription(
            `Use the dropdown to select a Fumo to purchase!\n` +
            `⏳ **Resets in:** \`${remainingTime} minute(s)\`\n`
        )
        .setColor('#FFD700');
    
    rarityLevels.forEach(rarity => {
        const fumos = market.filter(f => f.rarity === rarity.name);
        if (fumos.length === 0) return;
        
        const fumoText = fumos.map(fumo =>
            `**${fumo.name}** - 💵 ${formatNumber(fumo.price)} | 📦 Stock: ${fumo.stock}`
        ).join('\n');
        
        embed.addFields({ name: `${rarity.emoji} ${rarity.name}`, value: fumoText });
    });
    
    if (row) {
        embed.addFields({ name: '🪙 Your Coins', value: `\`${formatNumber(row.coins)}\`` });
    }
    
    return embed;
}

async function createGemShopEmbed(userId, market, resetTime) {
    const remainingHours = Math.max(Math.floor((resetTime - Date.now()) / 3600000), 0);
    const remainingMinutes = Math.max(Math.floor(((resetTime - Date.now()) % 3600000) / 60000), 0);
    const row = await get(`SELECT gems FROM userCoins WHERE userId = ?`, [userId]);
    
    const embed = new EmbedBuilder()
        .setTitle("💎 Gem Shop")
        .setDescription(
            `Premium Fumos available for gems!\n` +
            `⏳ **Resets in:** \`${remainingHours}h ${remainingMinutes}m\`\n`
        )
        .setColor('#9B59B6');
    
    gemShopRarityLevels.forEach(rarity => {
        const fumos = market.filter(f => f.rarity === rarity.name);
        if (fumos.length === 0) return;
        
        const fumoText = fumos.map(fumo =>
            `**${fumo.name}** - 💎 ${formatNumber(fumo.price)} | 📦 Stock: ${fumo.stock}`
        ).join('\n');
        
        embed.addFields({ name: `${rarity.emoji} ${rarity.name}`, value: fumoText });
    });
    
    if (row) {
        embed.addFields({ name: '💎 Your Gems', value: `\`${formatNumber(row.gems)}\`` });
    }
    
    return embed;
}

function createGlobalShopEmbed(listings, page = 0) {
    const itemsPerPage = 5;
    
    const groupedListings = {};
    listings.forEach(listing => {
        const key = `${listing.userId}_${listing.fumoName}`;
        if (!groupedListings[key]) {
            groupedListings[key] = {
                userId: listing.userId,
                fumoName: listing.fumoName,
                coinPrice: listing.coinPrice,
                gemPrice: listing.gemPrice,
                id: listing.id
            };
        }
    });
    
    const combinedListings = Object.values(groupedListings);
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    const displayListings = combinedListings.slice(start, end);
    
    const embed = new EmbedBuilder()
        .setTitle("🌐 Global Player Market")
        .setDescription(
            `Player-to-player marketplace\n` +
            `**Tax:** ${(GLOBAL_SHOP_CONFIG.TAX_RATE * 100).toFixed(0)}% on all sales\n` +
            `**Max Listings:** ${GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER} per player\n`
        )
        .setColor('#3498DB');
    
    if (displayListings.length === 0) {
        embed.addFields({ name: 'No Listings', value: 'No fumos available right now. Check back later!' });
    } else {
        displayListings.forEach((listing) => {
            let priceText = '';
            if (listing.coinPrice && listing.gemPrice) {
                priceText = `🪙 ${formatNumber(listing.coinPrice)} or 💎 ${formatNumber(listing.gemPrice)}`;
            } else if (listing.coinPrice) {
                priceText = `🪙 ${formatNumber(listing.coinPrice)}`;
            } else if (listing.gemPrice) {
                priceText = `💎 ${formatNumber(listing.gemPrice)}`;
            }
            
            embed.addFields({
                name: listing.fumoName,
                value: `${priceText} | Seller: <@${listing.userId}>`,
                inline: false
            });
        });
    }
    
    embed.setFooter({ text: `Page ${page + 1}/${Math.ceil(combinedListings.length / itemsPerPage) || 1}` });
    
    return embed;
}

function createMainShopButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`coin_shop_${userId}`)
            .setLabel('🪙 Coin Shop')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`gem_shop_${userId}`)
            .setLabel('💎 Gem Shop')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`global_shop_${userId}`)
            .setLabel('🌐 Global Shop')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createShopSelectMenu(userId, market, type) {
    const options = market.map((fumo, index) => ({
        label: fumo.name,
        description: `${type === 'coin' ? '🪙' : '💎'} ${formatNumber(fumo.price)} | Stock: ${fumo.stock}`,
        value: `${index}`
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`select_fumo_${type}_${userId}`)
            .setPlaceholder('Select a Fumo to purchase')
            .addOptions(options)
    );
}

function createBackButton(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`back_main_${userId}`)
            .setLabel('← Back')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createGlobalShopButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`add_listing_${userId}`)
            .setLabel('➕ Add Listing')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`remove_listing_${userId}`)
            .setLabel('➖ Remove Listing')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`refresh_global_${userId}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`back_main_${userId}`)
            .setLabel('← Back')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createPurchaseConfirmEmbed(fumo, amount, totalPrice, currency) {
    const currencyEmoji = currency === 'coins' ? '🪙' : '💎';
    return new EmbedBuilder()
        .setTitle('🛒 Confirm Purchase')
        .setDescription(
            `**Fumo:** ${fumo.name}\n` +
            `**Quantity:** ${amount}\n` +
            `**Total:** ${currencyEmoji} ${formatNumber(totalPrice)}\n\n` +
            `Click **Confirm** to complete the purchase.`
        )
        .setColor('#2ECC71');
}

function createPurchaseSuccessEmbed(fumo, amount, remainingBalance, currency) {
    const currencyEmoji = currency === 'coins' ? '🪙' : '💎';
    return new EmbedBuilder()
        .setTitle('🎉 Purchase Successful!')
        .setDescription(
            `You purchased **${amount}x ${fumo.name}**!\n\n` +
            `${currencyEmoji} Remaining: ${formatNumber(remainingBalance)}`
        )
        .setColor('#2ECC71');
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        NOT_FOUND: `⚠️ This Fumo is no longer available.`,
        INSUFFICIENT_STOCK: `⚠️ Only ${details.stock} left, but you requested ${details.requested}.`,
        INSUFFICIENT_COINS: `⚠️ Not enough coins! Need ${formatNumber(details.required)}, have ${formatNumber(details.current)}.`,
        INSUFFICIENT_GEMS: `⚠️ Not enough gems! Need ${formatNumber(details.required)}, have ${formatNumber(details.current)}.`,
        INVALID_AMOUNT: `⚠️ Invalid amount. Must be between 1 and ${details.max || 999}.`,
        MAX_LISTINGS: `⚠️ You've reached the maximum of ${GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER} listings.`,
        NO_INVENTORY: `⚠️ You don't have this Fumo in your inventory.`,
        PAYMENT_METHOD_UNAVAILABLE: `⚠️ This payment method is not available for this listing.`,
        PROCESSING_ERROR: `❌ An error occurred. Please try again.`
    };
    
    return new EmbedBuilder()
        .setTitle('Error')
        .setDescription(errorMessages[errorType] || errorMessages.PROCESSING_ERROR)
        .setColor('#E74C3C');
}

module.exports = {
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
};