const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { getUserPurchases, getTimeUntilReset } = require('./EggShopCacheService');
const { RARITY_INFO } = require('../../../Configuration/eggConfig');
const { calculateDualPrice, getWealthTierInfo, getUserWealth } = require('../WealthPricingService');

async function createShopEmbed(userId, eggs) {
    const purchases = getUserPurchases(userId);
    const { minutes, seconds } = getTimeUntilReset();
    
    // Get wealth tier info
    const wealth = await getUserWealth(userId);
    const coinTier = getWealthTierInfo(wealth.coins, 'coins');
    const gemTier = getWealthTierInfo(wealth.gems, 'gems');
    const hasWealthTax = coinTier.multiplier > 1 || gemTier.multiplier > 1;

    // Calculate scaled prices for all eggs
    const eggFieldsPromises = eggs.map(async (egg, idx) => {
        const rarityInfo = RARITY_INFO[egg.name] || {};
        const isPurchased = purchases.has(idx);
        
        // Calculate scaled prices
        const priceCalc = await calculateDualPrice(userId, egg.price.coins, egg.price.gems, 'eggShop');
        
        // Show scaled vs base prices
        const coinDisplay = priceCalc.coins.scaled 
            ? `~~${formatNumber(egg.price.coins)}~~ **${formatNumber(priceCalc.coins.finalPrice)}**`
            : formatNumber(egg.price.coins);
        const gemDisplay = priceCalc.gems.scaled 
            ? `~~${formatNumber(egg.price.gems)}~~ **${formatNumber(priceCalc.gems.finalPrice)}**`
            : formatNumber(egg.price.gems);

        return {
            name: `${egg.emoji} **${egg.name}** ${isPurchased ? '✅' : ''}`,
            value:
                `> **Price:** <a:coin:1130479446263644260> ${coinDisplay} | <a:gem:1130479444305707139> ${gemDisplay}\n` +
                `> **Rarity:** ${rarityInfo.display || 'Unknown'}\n` +
                `> ${egg.description}${isPurchased ? '\n*Already purchased*' : ''}`,
            inline: false
        };
    });
    
    const eggFields = await Promise.all(eggFieldsPromises);
    
    const wealthWarning = hasWealthTax 
        ? `\n\n💰 **Wealth Tax Active:** Coins ${coinTier.multiplier}x | Gems ${gemTier.multiplier}x`
        : '';

    return new EmbedBuilder()
        .setTitle("🥚 **Global Egg Shop**")
        .setDescription(
            "Welcome to the **Egg Shop**!\n" +
            "These eggs are available for **everyone**.\n" +
            "Shop resets **every hour on the hour**.\n\n" +
            "Click a button below to buy an egg!" +
            wealthWarning
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

function createPurchaseSuccessEmbed(egg, remainingCoins, remainingGems, paidCoins = null, paidGems = null) {
    // Use paid prices if provided (scaled), otherwise fall back to base prices
    const coinCost = paidCoins !== null ? paidCoins : egg.price.coins;
    const gemCost = paidGems !== null ? paidGems : egg.price.gems;
    
    return new EmbedBuilder()
        .setTitle('🎉 Purchase Successful!')
        .setDescription(
            `You bought a ${egg.emoji} **${egg.name}**!\n\n` +
            `**Cost:** <a:coin:1130479446263644260> ${formatNumber(coinCost)} | <a:gem:1130479444305707139> ${formatNumber(gemCost)}\n` +
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