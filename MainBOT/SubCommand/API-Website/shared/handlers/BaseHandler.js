/**
 * Base Handler Class
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
    REDDIT: '#FF4500',
    NHENTAI: '#ED2553',
    PIXIV: '#0096FA',
    RULE34: '#AAE5A4',
    ANILIST: '#02A9FF',
    STEAM: '#1B2838',
    GOOGLE: '#4285F4',
    WIKIPEDIA: '#FFFFFF',
    SUCCESS: '#00FF00',
    ERROR: '#FF0000',
    WARNING: '#FFA500',
    INFO: '#00BFFF'
};

class BaseHandler {
    constructor(handlerName, config = {}) {
        this.handlerName = handlerName;
        this.color = config.color || COLORS.INFO;
    }

    createEmbed(options = {}) {
        const embed = new EmbedBuilder()
            .setColor(options.color || this.color)
            .setTimestamp();

        if (options.title) embed.setTitle(options.title);
        if (options.description) embed.setDescription(options.description);
        if (options.thumbnail) embed.setThumbnail(options.thumbnail);
        if (options.image) embed.setImage(options.image);
        if (options.url) embed.setURL(options.url);
        if (options.footer) embed.setFooter(options.footer);
        if (options.fields) embed.addFields(options.fields);

        return embed;
    }

    createErrorEmbed(message, title = '❌ Error') {
        return new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle(title)
            .setDescription(message)
            .setTimestamp();
    }

    createSuccessEmbed(message, title = '✅ Success') {
        return new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle(title)
            .setDescription(message)
            .setTimestamp();
    }

    createPaginationButtons(currentPage, totalPages, prefix, userId) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${prefix}_prev_${userId}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`${prefix}_page_${userId}`)
                .setLabel(`${currentPage + 1}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`${prefix}_next_${userId}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1)
        );
    }

    truncate(text, maxLength = 1024) {
        if (!text) return '';
        return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
    }

    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatTags(tags, maxLength = 500) {
        if (!tags || tags.length === 0) return 'None';
        let result = tags.join(', ');
        return result.length > maxLength ? result.slice(0, maxLength - 3) + '...' : result;
    }
}

module.exports = { BaseHandler, COLORS };
