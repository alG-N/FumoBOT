const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { getUserPurchases, getTimeUntilReset } = require('./EggShopCacheService');
const { RARITY_INFO } = require('../../../Configuration/eggConfig');

function createShopEmbed(userId, eggs) {
    const purchases = getUserPurchases(userId);
    const { minutes, seconds } = getTimeUntilReset();

    const eggFields = eggs.map((egg, idx) => {
        const rarityInfo = RARITY_INFO[egg.name] || {};
        const isPurchased = purchases.has(idx);

        return {
            name: `${egg.emoji} **${egg.name}** ${isPurchased ? '✅' : ''}`,
            value:
                `> **Price:** <a:coin:1130479446263644260> ${formatNumber(egg.price.coins)} | <a:gem:1130479444305707139> ${formatNumber(egg.price.gems)}\n` +
                `> **Rarity:** ${rarityInfo.display || 'Unknown'}\n` +
                `> ${egg.description}${isPurchased ? '\n*Already purchased*' : ''}`,
            inline: false
        };
    });

    return new EmbedBuilder()
        .setTitle("🥚 **Global Egg Shop**")
        .setDescription(
            "Welcome to the **Egg Shop**!\n" +
            "These eggs are available for **everyone**.\n" +
            "Shop resets **every hour on the hour**.\n\n" +
            "Click a button below to buy an egg!"
        )
        .setColor(0xFFD700)
        .addFields(eggFields)
        .setFooter({ text: `🕒 Shop resets in ${minutes}m ${seconds}s` })
        .setTimestamp();
}

function createButtonRows(userId, eggs) {
    const purchases = getUserPurchases(userId);
    const rows = [];
    
    const styleMap = {
        CommonEgg: ButtonStyle.Primary,
        RareEgg: ButtonStyle.Success,
        DivineEgg: ButtonStyle.Danger
    };

    for (let i = 0; i < eggs.length; i += 5) {
        const chunk = eggs.slice(i, i + 5);
        const buttons = chunk.map((egg, localIdx) => {
            const globalIdx = i + localIdx;
            return new ButtonBuilder()
                .setCustomId(`buy_egg_${globalIdx}_${userId}`)
                .setLabel(`${egg.emoji} ${egg.name}`)
                .setStyle(styleMap[egg.name] || ButtonStyle.Secondary)
                .setDisabled(purchases.has(globalIdx));
        });

        rows.push(new ActionRowBuilder().addComponents(buttons));
    }

    return rows;
}

function createPurchaseSuccessEmbed(egg, remainingCoins, remainingGems) {
    return new EmbedBuilder()
        .setTitle('🎉 Purchase Successful!')
        .setDescription(
            `You bought a ${egg.emoji} **${egg.name}**!\n\n` +
            `**Cost:** <a:coin:1130479446263644260> ${formatNumber(egg.price.coins)} | <a:gem:1130479444305707139> ${formatNumber(egg.price.gems)}\n` +
            `**Remaining:** <a:coin:1130479446263644260> ${formatNumber(remainingCoins)} | <a:gem:1130479444305707139> ${formatNumber(remainingGems)}`
        )
        .setColor(0x00FF00)
        .setTimestamp();
}

function createErrorEmbed(error, message) {
    const titles = {
        ALREADY_PURCHASED: '⚠️ Already Purchased',
        NO_ACCOUNT: '⚠️ No Account',
        INSUFFICIENT_FUNDS: '💸 Insufficient Funds',
        PROCESSING_ERROR: '❌ Error'
    };

    return new EmbedBuilder()
        .setTitle(titles[error] || '❌ Error')
        .setDescription(message)
        .setColor(0xFF0000);
}

module.exports = {
    createShopEmbed,
    createButtonRows,
    createPurchaseSuccessEmbed,
    createErrorEmbed
};