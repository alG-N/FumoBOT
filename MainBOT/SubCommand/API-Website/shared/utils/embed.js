const { EmbedBuilder } = require('discord.js');

function createErrorEmbed(title, description, footerText = null) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (footerText) {
        embed.setFooter({ text: footerText });
    }

    return embed;
}

function createSuccessEmbed(title, description, color = '#00FF00') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

function createLoadingEmbed(title, description, thumbnailUrl = null) {
    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (thumbnailUrl) {
        embed.setThumbnail(thumbnailUrl);
    }

    return embed;
}

function truncateText(text, maxLength = 4000) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<\/?[^>]+(>|$)/g, '');
}

module.exports = {
    createErrorEmbed,
    createSuccessEmbed,
    createLoadingEmbed,
    truncateText,
    formatNumber,
    stripHtml
};
