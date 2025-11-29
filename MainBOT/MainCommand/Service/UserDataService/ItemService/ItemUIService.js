const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');

function createInventoryEmbed(user, pageData, stats, currentPage, totalPages) {
    const embed = new EmbedBuilder()
        .setTitle(`🎒 ${user.username}'s Treasure Trove 🎒`)
        .setDescription(`📊 Total Items: ${formatNumber(stats.totalItems)} | Unique: ${stats.totalUniqueItems}`)
        .setColor(Colors.Blue)
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: `Page ${currentPage + 1} of ${totalPages}` })
        .setTimestamp();

    for (const [rarity, items] of Object.entries(pageData)) {
        const itemList = items.length > 0
            ? items.map(item => `🔹 ${item.name} (x${formatNumber(item.quantity)})`).join('\n')
            : '-No items available-';

        const rarityCount = stats.byRarity[rarity]?.count || 0;
        const rarityUnique = stats.byRarity[rarity]?.uniqueCount || 0;

        embed.addFields({
            name: `**${rarity} Items** (${formatNumber(rarityCount)} total, ${rarityUnique} unique)`,
            value: itemList.length > 1024 ? itemList.substring(0, 1021) + '...' : itemList,
            inline: true
        });
    }

    return embed;
}

function createInventoryButtons(userId, currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('prev_page', userId))
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('next_page', userId))
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1)
    );
}

function createInventorySummaryEmbed(user, stats) {
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${user.username}'s Inventory Summary`)
        .setColor(Colors.Gold)
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    let rarityBreakdown = '';
    for (const [rarity, data] of Object.entries(stats.byRarity)) {
        if (data.count > 0) {
            rarityBreakdown += `**${rarity}:** ${formatNumber(data.count)} items (${data.uniqueCount} unique)\n`;
        }
    }

    embed.addFields(
        { 
            name: '📦 Overall Statistics', 
            value: `Total Items: **${formatNumber(stats.totalItems)}**\nUnique Items: **${stats.totalUniqueItems}**`,
            inline: false
        },
        {
            name: '🌈 Rarity Breakdown',
            value: rarityBreakdown || 'No items',
            inline: false
        }
    );

    return embed;
}

function createInventoryErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(message)
        .setColor(Colors.Red)
        .setTimestamp();
}

module.exports = {
    createInventoryEmbed,
    createInventoryButtons,
    createInventorySummaryEmbed,
    createInventoryErrorEmbed
};