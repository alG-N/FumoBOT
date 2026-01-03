const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { RARITY_ICONS } = require('../../../Configuration/shopConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getUserShopTimeLeft } = require('./ShopCacheService');
const { getRerollData, getRerollCooldownRemaining, formatTimeRemaining, getPaidRerollCost, canUseGemReroll } = require('./ShopRerollService');
const { isDoubleLuckDay, isGuaranteedMysteryBlock, isGuaranteedUnknownBlock, isGuaranteedPrimeBlock } = require('./ShopGenerationService');
const { calculateCoinPrice, calculateGemPrice, formatScaledPrice, getWealthTierInfo, getUserWealth } = require('../WealthPricingService');

const RARITY_PAGES = [
    ['Basic', 'Common', 'Rare', 'Epic', 'Legendary'],  
    ['Mythical', 'Divine', '???', 'Unknown', 'Prime']   
];

function formatStockText(stock, stockMessage) {
    if (stock === 0) return null;
    if (stock === 'unlimited') return stockMessage;
    return `Stock: ${stock} (${stockMessage})`;
}

async function createShopEmbed(userId, userShop, page = 0) {
    if (!userShop || typeof userShop !== 'object') {
        return new EmbedBuilder()
            .setTitle('❌ Shop Error')
            .setDescription('Failed to load shop. Please try again.')
            .setColor(Colors.Red);
    }

    // Get user's wealth tier info for display
    const wealth = await getUserWealth(userId);
    const coinTier = getWealthTierInfo(wealth.coins, 'coins');
    const gemTier = getWealthTierInfo(wealth.gems, 'gems');

    const categorizedItems = { 
        Basic: [], 
        Common: [], 
        Rare: [], 
        Epic: [], 
        Legendary: [], 
        Mythical: [], 
        Divine: [], 
        '???': [],
        Unknown: [],
        Prime: []
    };

    // Calculate scaled prices for all items
    for (const itemName of Object.keys(userShop)) {
        const item = userShop[itemName];
        
        if (item.stock === 0) continue;
        
        const stockText = formatStockText(item.stock, item.message);
        if (!stockText) continue;
        
        // Calculate wealth-scaled price
        const priceCalc = item.currency === 'coins' 
            ? await calculateCoinPrice(userId, item.cost, 'itemShop')
            : await calculateGemPrice(userId, item.cost, 'itemShop');
        
        const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                           item.priceTag === 'SURGE' ? '📈 Surge' : '';
        
        // Show scaled price with indicator if different from base
        const priceDisplay = priceCalc.scaled 
            ? `~~${formatNumber(item.cost)}~~ **${formatNumber(priceCalc.finalPrice)}** ${item.currency} 💰` 
            : `**${formatNumber(item.cost)} ${item.currency}**`;

        categorizedItems[item.rarity].push(
            `\`${itemName}\` — ${priceDisplay} ` +
            `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
        );
    }

    const timeUntilNextReset = getUserShopTimeLeft();
    const rerollData = await getRerollData(userId);
    const cooldownRemaining = await getRerollCooldownRemaining(userId);

    const currentPageRarities = RARITY_PAGES[page] || RARITY_PAGES[0];
    const totalPages = RARITY_PAGES.length;

    const specialMessages = [];
    if (isDoubleLuckDay()) specialMessages.push('🍀 **x2 Luck is active!**');
    if (isGuaranteedMysteryBlock()) specialMessages.push('⬛ **Guaranteed ??? item in this shop!**');
    if (isGuaranteedUnknownBlock()) specialMessages.push('🌀 **Guaranteed Unknown item in this shop!**');
    if (isGuaranteedPrimeBlock()) specialMessages.push('👑 **Guaranteed Prime item in this shop!**');
    
    // Show wealth tier warning if multiplier > 1
    const wealthWarning = coinTier.multiplier > 1 || gemTier.multiplier > 1
        ? `\n\n💰 **Wealth Tax Active:** Coins ${coinTier.multiplier}x | Gems ${gemTier.multiplier}x`
        : '';

    const shopEmbed = new EmbedBuilder()
        .setTitle(`✨ Your Magical Shop View ✨ (Page ${page + 1}/${totalPages})`)
        .setDescription(
            `🧙‍♂️ **Your personal selection from the global shop!**\n` +
            `🌍 *This shop is global and it's unique to you - your purchases don't affect others!*\n\n` +
            `📜 To buy: \`.shop buy <ItemName> <Quantity>\`\n` +
            `🔎 To search: \`.shop search <ItemName>\`\n\n` +
            `🔄 **Shop resets in:** ${timeUntilNextReset}\n` +
            `🎁 **Your Free Rerolls:** ${rerollData.count}/5 ` +
            `(Reset in: ${formatTimeRemaining(cooldownRemaining)})` +
            (specialMessages.length > 0 ? '\n' + specialMessages.join('\n') : '') +
            wealthWarning
        )
        .setColor(Colors.Blue)
        .setThumbnail('https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png')
        .setFooter({ text: 'Reroll to get different items! Stock is personal to you.' });

    for (const rarity of currentPageRarities) {
        const itemsList = categorizedItems[rarity];
        
        if (itemsList.length > 0) {
            shopEmbed.addFields({ 
                name: `${RARITY_ICONS[rarity]} ${rarity} Items`, 
                value: itemsList.join('\n'), 
                inline: false 
            });
        } else {
            shopEmbed.addFields({ 
                name: `${RARITY_ICONS[rarity]} ${rarity} Items`, 
                value: '*No stock available*', 
                inline: false 
            });
        }
    }

    return shopEmbed;
}

async function createShopButtons(userId, rerollCount, page = 0) {
    const rows = [];
    const totalPages = RARITY_PAGES.length;

    if (totalPages > 1) {
        const paginationRow = new ActionRowBuilder();
        
        const prevButton = new ButtonBuilder()
            .setCustomId(`shop_prev_${userId}_${page}`)
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0);

        const pageIndicator = new ButtonBuilder()
            .setCustomId(`shop_page_${userId}_${page}`)
            .setLabel(`Page ${page + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

        const nextButton = new ButtonBuilder()
            .setCustomId(`shop_next_${userId}_${page}`)
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === totalPages - 1);

        paginationRow.addComponents(prevButton, pageIndicator, nextButton);
        rows.push(paginationRow);
    }

    const rerollRow = new ActionRowBuilder();
    
    if (rerollCount > 0) {
        const freeRerollButton = new ButtonBuilder()
            .setCustomId(`free_reroll_${userId}`)
            .setLabel(`Free Reroll (${rerollCount}/5)`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');

        rerollRow.addComponents(freeRerollButton);
    } else {
        const paidRerollCost = await getPaidRerollCost(userId);
        const paidRerollButton = new ButtonBuilder()
            .setCustomId(`paid_reroll_${userId}`)
            .setLabel(`Gem Reroll (${formatNumber(paidRerollCost)} 💎)`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💎');

        rerollRow.addComponents(paidRerollButton);
    }

    rows.push(rerollRow);

    const actionRow = new ActionRowBuilder();
    const buyAllButton = new ButtonBuilder()
        .setCustomId(`buy_all_${userId}`)
        .setLabel('Buy All Available')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒');

    actionRow.addComponents(buyAllButton);
    rows.push(actionRow);

    return rows;
}

async function createSearchResultsEmbed(searchQuery, userShop, userId) {
    const categorizedItems = { 
        Basic: [], 
        Common: [], 
        Rare: [], 
        Epic: [], 
        Legendary: [], 
        Mythical: [], 
        Divine: [], 
        '???': [],
        Unknown: [],
        Prime: []
    };

    for (const itemName of Object.keys(userShop)) {
        const item = userShop[itemName];
        if (!itemName.toLowerCase().includes(searchQuery)) continue;
        if (item.stock === 0) continue;

        const stockText = formatStockText(item.stock, item.message);
        if (!stockText) continue;
        
        // Calculate wealth-scaled price
        const priceCalc = item.currency === 'coins' 
            ? await calculateCoinPrice(userId, item.cost, 'itemShop')
            : await calculateGemPrice(userId, item.cost, 'itemShop');
        
        const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                           item.priceTag === 'SURGE' ? '📈 Surge' : '';
        
        // Show scaled price with indicator if different from base
        const priceDisplay = priceCalc.scaled 
            ? `~~${formatNumber(item.cost)}~~ **${formatNumber(priceCalc.finalPrice)}** ${item.currency} 💰` 
            : `**${formatNumber(item.cost)} ${item.currency}**`;

        categorizedItems[item.rarity].push(
            `${RARITY_ICONS[item.rarity]} \`${itemName}\` — ${priceDisplay} ` +
            `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
        );
    }

    const searchEmbed = new EmbedBuilder()
        .setTitle("🔍 Search Results")
        .setDescription(`Here are the items that match your search:`)
        .setColor(Colors.Blue);

    for (const rarity of Object.keys(categorizedItems)) {
        const itemsList = categorizedItems[rarity].length > 0 ? 
            categorizedItems[rarity].join('\n') : 
            null;
        
        if (itemsList) {
            searchEmbed.addFields({ 
                name: `${RARITY_ICONS[rarity]} ${rarity}`, 
                value: itemsList, 
                inline: false 
            });
        }
    }

    return searchEmbed;
}

function createPurchaseConfirmationEmbed(quantity, itemName, totalCost, currency, baseCost = null, isScaled = false) {
    const priceDisplay = isScaled && baseCost !== null && baseCost !== totalCost
        ? `~~${formatNumber(baseCost)}~~ **${formatNumber(totalCost)}** ${currency} 💰`
        : `**${formatNumber(totalCost)} ${currency}**`;
    
    const wealthTaxNote = isScaled ? '\n\n💰 *Wealth tax applied to your purchase*' : '';
    
    return new EmbedBuilder()
        .setTitle("🛒 Confirm Purchase")
        .setDescription(
            `Are you sure you want to buy **${quantity} ${itemName}(s)** ` +
            `for ${priceDisplay}?${wealthTaxNote}`
        )
        .setColor(Colors.Blue);
}

async function createBuyAllConfirmationEmbed(userShop, userId) {
    const itemsList = [];
    let totalCoins = 0;
    let totalGems = 0;
    let baseTotalCoins = 0;
    let baseTotalGems = 0;

    for (const [itemName, itemData] of Object.entries(userShop)) {
        if (itemData.stock === 0) continue;

        const quantity = itemData.stock === 'unlimited' ? 100 : itemData.stock;
        const baseCost = itemData.cost * quantity;
        
        // Calculate wealth-scaled price
        const priceCalc = itemData.currency === 'coins' 
            ? await calculateCoinPrice(userId, itemData.cost, 'itemShop')
            : await calculateGemPrice(userId, itemData.cost, 'itemShop');
        
        const scaledCost = priceCalc.finalPrice * quantity;
        
        const costDisplay = priceCalc.scaled 
            ? `~~${formatNumber(baseCost)}~~ ${formatNumber(scaledCost)} 💰`
            : formatNumber(scaledCost);

        itemsList.push(`• ${quantity}x ${itemName} - ${costDisplay} ${itemData.currency}`);

        if (itemData.currency === 'coins') {
            totalCoins += scaledCost;
            baseTotalCoins += baseCost;
        } else {
            totalGems += scaledCost;
            baseTotalGems += baseCost;
        }
    }
    
    const coinDisplay = totalCoins > baseTotalCoins 
        ? `~~${formatNumber(baseTotalCoins)}~~ **${formatNumber(totalCoins)}** 💰`
        : formatNumber(totalCoins);
    const gemDisplay = totalGems > baseTotalGems 
        ? `~~${formatNumber(baseTotalGems)}~~ **${formatNumber(totalGems)}** 💰`
        : formatNumber(totalGems);
    
    const hasWealthTax = totalCoins > baseTotalCoins || totalGems > baseTotalGems;

    return new EmbedBuilder()
        .setTitle("🛒 Confirm Bulk Purchase")
        .setDescription(
            `Are you sure you want to buy **all available items in your view**?\n\n` +
            `**Items to purchase:**\n${itemsList.slice(0, 10).join('\n')}` +
            `${itemsList.length > 10 ? `\n...and ${itemsList.length - 10} more` : ''}\n\n` +
            `**Total Cost:**\n` +
            `💰 ${coinDisplay} coins\n` +
            `💎 ${gemDisplay} gems\n\n` +
            (hasWealthTax ? '💰 *Wealth tax applied*\n\n' : '') +
            `*Note: Unlimited stock items limited to 100 each*`
        )
        .setColor(Colors.Gold);
}

function createPurchaseButtons(type = 'purchase') {
    const confirmId = type === 'buyall' ? 'buyall_confirm' : 'purchase_confirm';
    const cancelId = type === 'buyall' ? 'buyall_cancel' : 'purchase_cancel';

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(confirmId)
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(cancelId)
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );
}

async function createRerollSuccessEmbed(rerollCount, cooldownRemaining, gemCost = null) {
    const description = gemCost 
        ? `💎 Your shop view has been rerolled for **${formatNumber(gemCost)} gems**!\n\n` +
          `**Your Free Rerolls Remaining:** ${rerollCount}/5\n` +
          `**Rerolls reset in:** ${formatTimeRemaining(cooldownRemaining)}\n\n` +
          `⚠️ **Next gem reroll will cost:** ${formatNumber(gemCost * 5)} gems`
        : `✨ Your shop view has been rerolled!\n\n` +
          `**Your Free Rerolls Remaining:** ${rerollCount}/5\n` +
          `**Rerolls reset in:** ${formatTimeRemaining(cooldownRemaining)}`;

    return new EmbedBuilder()
        .setTitle("🔄 Shop View Rerolled!")
        .setDescription(description)
        .setColor(gemCost ? Colors.Purple : Colors.Green)
        .setTimestamp();
}

module.exports = {
    createShopEmbed,
    createShopButtons,
    createSearchResultsEmbed,
    createPurchaseConfirmationEmbed,
    createBuyAllConfirmationEmbed,
    createPurchaseButtons,
    createRerollSuccessEmbed,
    RARITY_PAGES
};