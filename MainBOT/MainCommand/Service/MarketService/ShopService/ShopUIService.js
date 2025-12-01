const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { RARITY_ICONS } = require('../../../Configuration/shopConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getUserShopTimeLeft } = require('./ShopCacheService');
const { getRerollData, getRerollCooldownRemaining, formatTimeRemaining, getPaidRerollCost, canUseGemReroll } = require('./ShopRerollService');
const { isDoubleLuckDay, isGuaranteedMysteryBlock } = require('./ShopGenerationService');

// Define rarity pages for pagination
const RARITY_PAGES = [
    ['Basic', 'Common', 'Rare', 'Epic', 'Legendary'],  // Page 1: Common to Legendary
    ['Mythical', 'Divine', '???', 'Unknown', 'Prime']   // Page 2: Mythical to Prime
];

function formatStockText(stock, stockMessage) {
    if (stock === 0) return `~~Out of Stock~~`;
    if (stock === 'unlimited') return stockMessage;
    return `Stock: ${stock} (${stockMessage})`;
}

function createShopEmbed(userId, userShop, page = 0) {
    const categorizedItems = { 
        Basic: [], 
        Common: [], 
        Rare: [], 
        Epic: [], 
        Legendary: [], 
        Mythical: [], 
        Divine: [], 
        '???': [],
        Unknown: [],  // ADDED
        Prime: []     // ADDED
    };

    Object.keys(userShop).forEach(itemName => {
        const item = userShop[itemName];
        if (item.stock === 0) return;

        const stockText = formatStockText(item.stock, item.message);
        const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                           item.priceTag === 'SURGE' ? '📈 Surge' : '';

        categorizedItems[item.rarity].push(
            `\`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** ` +
            `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
        );
    });

    const timeUntilNextReset = getUserShopTimeLeft();
    const rerollData = getRerollData(userId);
    const cooldownRemaining = getRerollCooldownRemaining(userId);

    // Get rarities for current page
    const currentPageRarities = RARITY_PAGES[page] || RARITY_PAGES[0];
    const totalPages = RARITY_PAGES.length;

    const shopEmbed = new EmbedBuilder()
        .setTitle(`✨ Welcome to Your Magical Shop ✨ (Page ${page + 1}/${totalPages})`)
        .setDescription(
            `🧙‍♂️ **Some random guy's magical shop** is open just for you!\n\n` +
            `📜 To buy: \`.shop buy <ItemName> <Quantity>\`\n` +
            `🔎 To search: \`.shop search <ItemName>\`\n\n` +
            `🔄 **Your shop resets in:** ${timeUntilNextReset}\n` +
            `🎁 **Free Rerolls:** ${rerollData.count}/5 ` +
            `(Reset in: ${formatTimeRemaining(cooldownRemaining)})` +
            (isDoubleLuckDay() ? `\n🍀 **x2 Luck is active!**` : '') +
            (isGuaranteedMysteryBlock() ? `\n⬛ **Guaranteed ??? item in this shop!**` : '')
        )
        .setColor(Colors.Blue)
        .setThumbnail('https://img1.picmix.com/output/stamp/normal/6/1/0/7/2577016_a2c58.png')
        .setFooter({ text: 'Prices and stock are unique to you. Shop resets every hour on the hour.' });

    // Only show rarities for current page
    for (const rarity of currentPageRarities) {
        const itemsList = categorizedItems[rarity].length > 0 ? 
            categorizedItems[rarity].join('\n') : 
            '-No items available here-';
        shopEmbed.addFields({ 
            name: `${RARITY_ICONS[rarity]} ${rarity} Items`, 
            value: itemsList, 
            inline: false 
        });
    }

    return shopEmbed;
}

function createShopButtons(userId, rerollCount, page = 0) {
    const rows = [];
    const totalPages = RARITY_PAGES.length;

    // Row 1: Pagination buttons
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

    // Row 2: Reroll buttons
    const rerollRow = new ActionRowBuilder();
    
    if (rerollCount > 0) {
        const freeRerollButton = new ButtonBuilder()
            .setCustomId(`free_reroll_${userId}`)
            .setLabel(`Free Reroll (${rerollCount}/5)`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');

        rerollRow.addComponents(freeRerollButton);
    } else {
        const paidRerollCost = getPaidRerollCost(userId);
        const paidRerollButton = new ButtonBuilder()
            .setCustomId(`paid_reroll_${userId}`)
            .setLabel(`Gem Reroll (${formatNumber(paidRerollCost)} 💎)`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('💎');

        rerollRow.addComponents(paidRerollButton);
    }

    rows.push(rerollRow);

    // Row 3: Buy all button
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

function createSearchResultsEmbed(searchQuery, userShop) {
    const categorizedItems = { 
        Basic: [], 
        Common: [], 
        Rare: [], 
        Epic: [], 
        Legendary: [], 
        Mythical: [], 
        Divine: [], 
        '???': [],
        Unknown: [],  // ADDED
        Prime: []     // ADDED
    };

    Object.keys(userShop).forEach(itemName => {
        const item = userShop[itemName];
        if (!itemName.toLowerCase().includes(searchQuery)) return;

        const stockText = formatStockText(item.stock, item.message);
        const priceLabel = item.priceTag === 'SALE' ? '🔥 SALE' : 
                           item.priceTag === 'SURGE' ? '📈 Surge' : '';

        categorizedItems[item.rarity].push(
            `${RARITY_ICONS[item.rarity]} \`${itemName}\` — **${formatNumber(item.cost)} ${item.currency}** ` +
            `(${stockText}${priceLabel ? ` • ${priceLabel}` : ''})`
        );
    });

    const searchEmbed = new EmbedBuilder()
        .setTitle("🔍 Search Results")
        .setDescription(`Here are the items that match your search:`)
        .setColor(Colors.Blue);

    // Show all rarities in search results
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

function createPurchaseConfirmationEmbed(quantity, itemName, totalCost, currency) {
    return new EmbedBuilder()
        .setTitle("🛒 Confirm Purchase")
        .setDescription(
            `Are you sure you want to buy **${quantity} ${itemName}(s)** ` +
            `for **${formatNumber(totalCost)} ${currency}**?`
        )
        .setColor(Colors.Blue);
}

function createBuyAllConfirmationEmbed(userShop) {
    const itemsList = [];
    let totalCoins = 0;
    let totalGems = 0;

    for (const [itemName, itemData] of Object.entries(userShop)) {
        if (itemData.stock === 0) continue;

        const quantity = itemData.stock === 'unlimited' ? 100 : itemData.stock;
        const cost = itemData.cost * quantity;

        itemsList.push(`• ${quantity}x ${itemName} - ${formatNumber(cost)} ${itemData.currency}`);

        if (itemData.currency === 'coins') {
            totalCoins += cost;
        } else {
            totalGems += cost;
        }
    }

    return new EmbedBuilder()
        .setTitle("🛒 Confirm Bulk Purchase")
        .setDescription(
            `Are you sure you want to buy **all available items**?\n\n` +
            `**Items to purchase:**\n${itemsList.slice(0, 10).join('\n')}` +
            `${itemsList.length > 10 ? `\n...and ${itemsList.length - 10} more` : ''}\n\n` +
            `**Total Cost:**\n` +
            `💰 ${formatNumber(totalCoins)} coins\n` +
            `💎 ${formatNumber(totalGems)} gems\n\n` +
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

function createRerollSuccessEmbed(rerollCount, cooldownRemaining, gemCost = null) {
    const description = gemCost 
        ? `💎 Your shop has been rerolled for **${formatNumber(gemCost)} gems**!\n\n` +
          `**Free Rerolls Remaining:** ${rerollCount}/5\n` +
          `**Rerolls reset in:** ${formatTimeRemaining(cooldownRemaining)}\n\n` +
          `⚠️ **Next gem reroll will cost:** ${formatNumber(gemCost * 5)} gems`
        : `✨ Your shop has been rerolled!\n\n` +
          `**Free Rerolls Remaining:** ${rerollCount}/5\n` +
          `**Rerolls reset in:** ${formatTimeRemaining(cooldownRemaining)}`;

    return new EmbedBuilder()
        .setTitle("🔄 Shop Rerolled!")
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