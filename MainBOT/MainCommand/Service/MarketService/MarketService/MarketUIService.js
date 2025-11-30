const { EmbedBuilder, Colors } = require('discord.js');
const { get } = require('../../../Core/database');
const { rarityLevels } = require('../../../Configuration/marketConfig');
const { getNextResetTime } = require('./MarketCacheService');
const { formatNumber } = require('../../../Ultility/formatting');

async function createMarketEmbed(userId, userMarket) {
    const { market, resetTime } = userMarket;
    const remainingTime = Math.max(Math.floor((resetTime - Date.now()) / 60000), 0);

    const row = await get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]);

    const embed = new EmbedBuilder()
        .setTitle("🎪 Golden's Market Extravaganza 🎪")
        .setDescription(
            `✨ **Golden's father is selling premium Fumos!** ✨\n` +
            `Use **\`.purchase <name>\`** to buy.\n\n` +
            `⏳ **Market resets in:** \`${remainingTime} minute(s)\`\n` +
            `💰 **Limited stock! Refreshes often!**\n`
        )
        .setColor('#f5b042')
        .setThumbnail('https://media.tenor.com/rFFZ4WbQq3EAAAAC/fumo.gif');

    rarityLevels.forEach(rarity => {
        const fumos = market.filter(f => f.rarity === rarity.name);
        if (fumos.length === 0) return;

        const fumoText = fumos.map(fumo =>
            `**${fumo.name}**\n💵 Price: ${formatNumber(fumo.price)}  |  📦 Stock: ${fumo.stock}`
        ).join('\n');

        embed.addFields({ name: `${rarity.emoji} ${rarity.name}`, value: fumoText });
    });

    if (row?.coins !== undefined && row?.gems !== undefined) {
        embed.addFields(
            { name: '🪙 Your Coins', value: `\`${formatNumber(row.coins)}\``, inline: true },
            { name: '💎 Your Gems', value: `\`${formatNumber(row.gems)}\``, inline: true }
        );
    }

    return embed;
}

function createPurchaseTutorialEmbed() {
    return new EmbedBuilder()
        .setTitle("📖 How to Use .purchase")
        .setDescription(
            "To purchase a Fumo, use:\n`/purchase FumoName [amount]`\n\n" +
            "**Example:** `/purchase Marisa(Common) 3`\n" +
            "You can also omit the amount to buy 1.\n\n" +
            "Use `/market` to view what's for sale!"
        )
        .setColor('#00aaff');
}

function createPurchaseConfirmEmbed(amount, fumoName, totalPrice) {
    return new EmbedBuilder()
        .setTitle('🛒 Confirm Purchase')
        .setDescription(
            `Are you sure you want to purchase **${amount}x ${fumoName}** for **${formatNumber(totalPrice)} coins**?`
        )
        .setColor('#00ff00');
}

function createPurchaseSuccessEmbed(amount, fumoName, remainingCoins, remainingStock) {
    return new EmbedBuilder()
        .setTitle('🎉 Purchase Successful 🎉')
        .setDescription(
            `You bought **${amount}x ${fumoName}**! 🎊\n` +
            `Remaining Coins: ${formatNumber(remainingCoins)}\n` +
            `Stock left: ${remainingStock}`
        )
        .setColor('#00ff00');
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        NOT_FOUND: `⚠️ Fumo Not Found ⚠️\nCould not find a Fumo named **"${details.fumoName || 'Unknown'}"** in the market. Make sure you typed it exactly.`,
        INSUFFICIENT_STOCK: `⚠️ Not Enough Stock ⚠️\nOnly **${details.stock || 0}** of **${details.fumoName || 'Unknown'}** left in the market, but you asked for **${details.requested || 0}**.`,
        NO_ACCOUNT: `⚠️ Empty Coin Pouch ⚠️\nYou do not have any coins yet. Go on adventures to earn some before shopping!`,
        INSUFFICIENT_COINS: `⚠️ Not Enough Coins ⚠️\nYou need **${formatNumber(details.required || 0)}** coins to buy this, but you only have **${formatNumber(details.current || 0)}**.`,
        PROCESSING_ERROR: `❌ Purchase failed. Please try again.`
    };

    return new EmbedBuilder()
        .setTitle(errorMessages[errorType]?.split('\n')[0] || '❌ Error')
        .setDescription(errorMessages[errorType]?.split('\n').slice(1).join('\n') || 'An error occurred.')
        .setColor('#ff0000');
}

module.exports = {
    createMarketEmbed,
    createPurchaseTutorialEmbed,
    createPurchaseConfirmEmbed,
    createPurchaseSuccessEmbed,
    createErrorEmbed
};