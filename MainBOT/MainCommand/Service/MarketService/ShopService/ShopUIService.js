const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { RARITY_ICONS } = require('../../../Configuration/shopConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { getUserShopTimeLeft } = require('./ShopCacheService');
const { getRerollData, getRerollCooldownRemaining, formatTimeRemaining } = require('./ShopRerollService');
const { isDoubleLuckDay, isGuaranteedMysteryBlock } = require('./ShopGenerationService');

function formatStockText(stock, stockMessage) {
    if (stock === 0) return `~~Out of Stock~~`;
    if (stock === 'unlimited') return stockMessage;
    return `Stock: ${stock} (${stockMessage})`;
}

function createShopEmbed(userId, userShop) {
    const categorizedItems = { Basic: [], Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], Divine: [], '???': [] };

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

    const shopEmbed = new EmbedBuilder()
        .setTitle("✨ Welcome to Your Magical Shop ✨")
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

    for (const rarity of Object.keys(categorizedItems)) {
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

function createShopButtons(userId, rerollCount) {
    const rerollButton = new ButtonBuilder()
        .setCustomId(`free_reroll_${userId}`)
        .setLabel(`Free Reroll (${rerollCount}/5)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄')
        .setDisabled(rerollCount <= 0);

    return new ActionRowBuilder().addComponents(rerollButton);
}

function createSearchResultsEmbed(searchQuery, userShop) {
    const categorizedItems = { Basic: [], Common: [], Rare: [], Epic: [], Legendary: [], Mythical: [], Divine: [], '???': [] };

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

    for (const rarity of Object.keys(categorizedItems)) {
        const itemsList = categorizedItems[rarity].length > 0 ? 
            categorizedItems[rarity].join('\n') : 
            '-No items found-';
        searchEmbed.addFields({ 
            name: `${RARITY_ICONS[rarity]} ${rarity}`, 
            value: itemsList, 
            inline: false 
        });
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

function createPurchaseButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('purchase_confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('purchase_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger)
    );
}

function createRerollSuccessEmbed(rerollCount, cooldownRemaining) {
    return new EmbedBuilder()
        .setTitle("🔄 Shop Rerolled!")
        .setDescription(
            `✨ Your shop has been rerolled!\n\n` +
            `**Free Rerolls Remaining:** ${rerollCount}/5\n` +
            `**Rerolls reset in:** ${formatTimeRemaining(cooldownRemaining)}`
        )
        .setColor(Colors.Green)
        .setTimestamp();
}

module.exports = {
    createShopEmbed,
    createShopButtons,
    createSearchResultsEmbed,
    createPurchaseConfirmationEmbed,
    createPurchaseButtons,
    createRerollSuccessEmbed
};