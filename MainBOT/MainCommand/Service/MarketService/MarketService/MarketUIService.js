const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { get } = require('../../../Core/database');
const { rarityLevels, gemShopRarityLevels, GLOBAL_SHOP_CONFIG } = require('../../../Configuration/marketConfig');
const { formatNumber } = require('../../../Ultility/formatting');

async function createMainShopEmbed(userId) {
    const row = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);
    
    const embed = new EmbedBuilder()
        .setTitle("✨ Golden's Marketplace")
        .setDescription(
            `Welcome to the premier fumo trading hub!\n\n` +
            `🪙 **Coin Shop** · Hourly Refresh\n` +
            `💎 **Gem Shop** · 6-Hour Refresh\n` +
            `🌐 **Global Market** · Player Trading\n`
        )
        .setColor('#FFB347')
        .setThumbnail('https://media.tenor.com/rFFZ4WbQq3EAAAAC/fumo.gif')
        .setFooter({ text: 'Select a shop below to start browsing' });
    
    if (row) {
        embed.addFields(
            { 
                name: '\u200B', 
                value: `**Your Wallet**\n🪙 ${formatNumber(row.coins)} Coins\n💎 ${formatNumber(row.gems)} Gems`,
                inline: false 
            }
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
            `Premium fumos available for coins • Select from dropdown below\n` +
            `⏰ Refreshes in **${remainingTime}** minutes\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor('#FFD700');
    
    const groupedByRarity = {};
    rarityLevels.forEach(rarity => {
        const fumos = market.filter(f => f.rarity === rarity.name);
        if (fumos.length > 0) {
            groupedByRarity[rarity.name] = {
                emoji: rarity.emoji,
                fumos: fumos
            };
        }
    });
    
    Object.entries(groupedByRarity).forEach(([rarityName, data]) => {
        const fumoList = data.fumos.map(fumo => 
            `▸ **${fumo.name}**\n  └ 💰 ${formatNumber(fumo.price)} · 📦 ${fumo.stock} in stock`
        ).join('\n');
        
        embed.addFields({ 
            name: `${data.emoji} ${rarityName}`, 
            value: fumoList,
            inline: false 
        });
    });
    
    if (row) {
        embed.setFooter({ text: `Your Balance: ${formatNumber(row.coins)} coins` });
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
            `Exclusive fumos for premium currency • Select from dropdown below\n` +
            `⏰ Refreshes in **${remainingHours}h ${remainingMinutes}m**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor('#9B59B6');
    
    const groupedByRarity = {};
    gemShopRarityLevels.forEach(rarity => {
        const fumos = market.filter(f => f.rarity === rarity.name);
        if (fumos.length > 0) {
            groupedByRarity[rarity.name] = {
                emoji: rarity.emoji,
                fumos: fumos
            };
        }
    });
    
    Object.entries(groupedByRarity).forEach(([rarityName, data]) => {
        const fumoList = data.fumos.map(fumo => 
            `▸ **${fumo.name}**\n  └ 💎 ${formatNumber(fumo.price)} · 📦 ${fumo.stock} in stock`
        ).join('\n');
        
        embed.addFields({ 
            name: `${data.emoji} ${rarityName}`, 
            value: fumoList,
            inline: false 
        });
    });
    
    if (row) {
        embed.setFooter({ text: `Your Balance: ${formatNumber(row.gems)} gems` });
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
                coinPrice: listing.coinPrice || 0,
                gemPrice: listing.gemPrice || 0,
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
            `Player-to-player marketplace • All trades require both currencies\n\n` +
            `**Market Rules**\n` +
            `💸 Tax Rate: ${(GLOBAL_SHOP_CONFIG.TAX_RATE * 100).toFixed(0)}% per sale\n` +
            `📋 Max Listings: ${GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER} per player\n` +
            `⚠️ Requires BOTH coins & gems\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor('#3498DB');
    
    if (displayListings.length === 0) {
        embed.addFields({ 
            name: '📭 No Active Listings', 
            value: 'The marketplace is currently empty. Be the first to list a fumo!' 
        });
    } else {
        displayListings.forEach((listing, index) => {
            const divider = index < displayListings.length - 1 ? '\n─────────────────────────' : '';
            
            embed.addFields({
                name: `${listing.fumoName}`,
                value: 
                    `**Price:** 🪙 ${formatNumber(listing.coinPrice)} + 💎 ${formatNumber(listing.gemPrice)}\n` +
                    `**Seller:** <@${listing.userId}>${divider}`,
                inline: false
            });
        });
    }
    
    const totalPages = Math.ceil(combinedListings.length / itemsPerPage) || 1;
    embed.setFooter({ text: `Page ${page + 1} of ${totalPages} • ${combinedListings.length} total listings` });
    
    return embed;
}

function createMainShopButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`coin_shop_${userId}`)
            .setLabel('Coin Shop')
            .setEmoji('🪙')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`gem_shop_${userId}`)
            .setLabel('Gem Shop')
            .setEmoji('💎')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`global_shop_${userId}`)
            .setLabel('Global Market')
            .setEmoji('🌐')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createShopSelectMenu(userId, market, type) {
    const options = market.map((fumo, index) => {
        const rarityMatch = fumo.name.match(/\(([^)]+)\)$/);
        const rarityText = rarityMatch ? ` • ${rarityMatch[1]}` : '';
        
        return {
            label: fumo.name.length > 80 ? fumo.name.substring(0, 77) + '...' : fumo.name,
            description: `${type === 'coin' ? '🪙' : '💎'} ${formatNumber(fumo.price)} • Stock: ${fumo.stock}${rarityText}`,
            value: `${index}`
        };
    });
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`select_fumo_${type}_${userId}`)
            .setPlaceholder('🛒 Choose a fumo to purchase')
            .addOptions(options)
    );
}

function createBackButton(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`back_main_${userId}`)
            .setLabel('Back to Main')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createGlobalShopButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`add_listing_${userId}`)
            .setLabel('List Fumo')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`remove_listing_${userId}`)
            .setLabel('Remove')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`refresh_global_${userId}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`back_main_${userId}`)
            .setLabel('Back')
            .setEmoji('◀️')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createPurchaseConfirmEmbed(fumo, amount, totalPrice, currency) {
    const currencyEmoji = currency === 'coins' ? '🪙' : '💎';
    const currencyName = currency === 'coins' ? 'Coins' : 'Gems';
    
    return new EmbedBuilder()
        .setTitle('🛒 Confirm Purchase')
        .setDescription(
            `You're about to purchase:\n\n` +
            `**${fumo.name}**\n\n` +
            `┌─ **Transaction Details** ──────┐\n` +
            `│ Quantity: **${amount}x**\n` +
            `│ Unit Price: ${currencyEmoji} ${formatNumber(fumo.price)}\n` +
            `│ Total Cost: ${currencyEmoji} **${formatNumber(totalPrice)}**\n` +
            `└────────────────────────────────┘\n\n` +
            `Click **Confirm** to complete your purchase.`
        )
        .setColor('#2ECC71');
}

function createPurchaseSuccessEmbed(fumo, amount, remainingBalance, currency) {
    const currencyEmoji = currency === 'coins' ? '🪙' : '💎';
    const currencyName = currency === 'coins' ? 'coins' : 'gems';
    
    return new EmbedBuilder()
        .setTitle('✅ Purchase Complete!')
        .setDescription(
            `Successfully purchased **${amount}x ${fumo.name}**\n\n` +
            `**Remaining Balance**\n` +
            `${currencyEmoji} ${formatNumber(remainingBalance)} ${currencyName}\n\n` +
            `Check your inventory to view your new fumo!`
        )
        .setColor('#2ECC71')
        .setFooter({ text: 'Thank you for your purchase!' });
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        NOT_FOUND: {
            title: '⚠️ Item Not Found',
            desc: `This fumo is no longer available in the shop.`
        },
        INSUFFICIENT_STOCK: {
            title: '⚠️ Insufficient Stock',
            desc: `Only **${details.stock}** remaining, but you requested **${details.requested}**.`
        },
        INSUFFICIENT_COINS: {
            title: '⚠️ Not Enough Coins',
            desc: `You need **${formatNumber(details.required)}** coins, but you only have **${formatNumber(details.current)}**.`
        },
        INSUFFICIENT_GEMS: {
            title: '⚠️ Not Enough Gems',
            desc: `You need **${formatNumber(details.required)}** gems, but you only have **${formatNumber(details.current)}**.`
        },
        INVALID_AMOUNT: {
            title: '⚠️ Invalid Amount',
            desc: `Please enter a valid amount between **1** and **${details.max || 999}**.`
        },
        MAX_LISTINGS: {
            title: '⚠️ Listing Limit Reached',
            desc: `You've reached the maximum of **${GLOBAL_SHOP_CONFIG.MAX_LISTINGS_PER_USER}** active listings.`
        },
        NO_INVENTORY: {
            title: '⚠️ Not In Inventory',
            desc: `You don't have this fumo in your inventory.`
        },
        PAYMENT_METHOD_UNAVAILABLE: {
            title: '⚠️ Payment Unavailable',
            desc: `This payment method is not available for this listing.`
        },
        PROCESSING_ERROR: {
            title: '❌ Error',
            desc: `Something went wrong while processing your request. Please try again.`
        }
    };
    
    const error = errorMessages[errorType] || errorMessages.PROCESSING_ERROR;
    
    return new EmbedBuilder()
        .setTitle(error.title)
        .setDescription(error.desc)
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