const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const pixivService = require('../services/pixivService');

const SORT_MODE_TEXT = {
    'popular': '🔥 Popular',
    'day': '📅 Daily',
    'week': '📊 Weekly',
    'month': '📈 Monthly'
};

async function createContentEmbed(item, options = {}) {
    const {
        resultIndex = 0,
        totalResults = 1,
        searchPage = 1,
        cacheKey = '',
        contentType = 'illust',
        hasNextPage = false,
        shouldTranslate = false,
        originalQuery = '',
        translatedQuery = '',
        mangaPageIndex = 0,
        sortMode = 'popular'
    } = options;

    const embed = new EmbedBuilder().setColor('#0096FA');
    const rows = [];

    const sortModeText = SORT_MODE_TEXT[sortMode] || '🔥 Popular';
    const isNSFW = item.x_restrict > 0;
    const nsfwStatus = isNSFW ? '🔞 Yes' : '✅ No';
    const isAI = item.illust_ai_type === 2;
    const aiStatus = isAI ? '🤖 Yes' : '✅ No';

    if (contentType === 'novel') {
        await _buildNovelEmbed(embed, item, {
            sortModeText, nsfwStatus, aiStatus, searchPage, resultIndex,
            totalResults, shouldTranslate, originalQuery
        });
    } else {
        await _buildIllustEmbed(embed, item, {
            sortModeText, nsfwStatus, aiStatus, searchPage, resultIndex,
            totalResults, mangaPageIndex, shouldTranslate, originalQuery
        });
    }

    // Result navigation row
    const resultNavRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('◀ Prev Result')
            .setCustomId(`pixiv_prev_${cacheKey}`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel(`${resultIndex + 1}/${totalResults}`)
            .setCustomId(`pixiv_counter_${cacheKey}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel('Next Result ▶')
            .setCustomId(`pixiv_next_${cacheKey}`)
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel('View on Pixiv')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🔗')
            .setURL(contentType === 'novel'
                ? `https://www.pixiv.net/novel/show.php?id=${item.id}`
                : `https://www.pixiv.net/artworks/${item.id}`)
    );

    rows.push(resultNavRow);

    // Page navigation for multi-page content
    if (contentType !== 'novel' && item.page_count > 1) {
        const pageNavRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('◀ Prev Page')
                .setCustomId(`pixiv_pagedown_${cacheKey}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
                .setDisabled(mangaPageIndex === 0),
            new ButtonBuilder()
                .setLabel(`Page ${mangaPageIndex + 1}/${item.page_count}`)
                .setCustomId(`pixiv_pagecounter_${cacheKey}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setLabel('Next Page ▶')
                .setCustomId(`pixiv_pageup_${cacheKey}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📄')
                .setDisabled(mangaPageIndex >= item.page_count - 1)
        );

        rows.push(pageNavRow);
    }

    return { embed, rows };
}

async function _buildNovelEmbed(embed, item, options) {
    const { sortModeText, nsfwStatus, aiStatus, searchPage, resultIndex, totalResults, shouldTranslate, originalQuery } = options;

    const textPreview = item.text ? item.text.substring(0, 400) + (item.text.length > 400 ? '...' : '') : 'No preview available';

    embed
        .setTitle(item.title)
        .setURL(`https://www.pixiv.net/novel/show.php?id=${item.id}`)
        .setDescription(
            `**Author:** ${item.user.name}\n` +
            `**NSFW:** ${nsfwStatus}\n` +
            `**AI-Generated:** ${aiStatus}\n` +
            `**Views:** ${item.total_view?.toLocaleString() || 'N/A'}\n` +
            `**Bookmarks:** ${item.total_bookmarks?.toLocaleString() || 'N/A'}\n\n` +
            `**Preview:**\n${textPreview}`
        )
        .addFields(
            {
                name: '🏷️ Tags',
                value: item.tags?.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                inline: false
            },
            {
                name: '📊 Stats',
                value: `📝 ${item.text_length?.toLocaleString() || '?'} characters`,
                inline: true
            }
        )
        .setFooter({
            text: `${sortModeText} • Page ${searchPage} • Novel ${resultIndex + 1}/${totalResults} • ID: ${item.id}${shouldTranslate ? ` • From "${originalQuery}"` : ''}`
        })
        .setTimestamp(new Date(item.create_date));

    if (item.image_urls?.large) {
        try {
            const proxyImageUrl = await pixivService.getProxyImageUrl(item, 0);
            embed.setThumbnail(proxyImageUrl);
        } catch (err) {
            console.error('Failed to set thumbnail:', err.message);
        }
    }
}

async function _buildIllustEmbed(embed, item, options) {
    const { sortModeText, nsfwStatus, aiStatus, searchPage, resultIndex, totalResults, mangaPageIndex, shouldTranslate, originalQuery } = options;

    const typeEmoji = item.type === 'manga' ? '📚' : item.type === 'ugoira' ? '🎬' : '🎨';
    const typeText = item.type === 'manga' ? 'Manga' : item.type === 'ugoira' ? 'Animated' : 'Illustration';

    try {
        const proxyImageUrl = await pixivService.getProxyImageUrl(item, mangaPageIndex);

        embed
            .setTitle(item.title)
            .setURL(`https://www.pixiv.net/artworks/${item.id}`)
            .setDescription(
                `**Artist:** ${item.user.name}\n` +
                `**Type:** ${typeEmoji} ${typeText}${item.page_count > 1 ? ` (${item.page_count} pages)` : ''}\n` +
                `**NSFW:** ${nsfwStatus}\n` +
                `**AI-Generated:** ${aiStatus}\n` +
                `**Views:** ${item.total_view?.toLocaleString() || 'N/A'}\n` +
                `**Bookmarks:** ${item.total_bookmarks?.toLocaleString() || 'N/A'}`
            )
            .setImage(proxyImageUrl)
            .addFields({
                name: '🏷️ Tags',
                value: item.tags?.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                inline: false
            })
            .setFooter({
                text: `${sortModeText} • Page ${searchPage} • Result ${resultIndex + 1}/${totalResults}${item.page_count > 1 ? ` • Page ${mangaPageIndex + 1}/${item.page_count}` : ''} • ID: ${item.id}${shouldTranslate ? ` • From "${originalQuery}"` : ''}`
            })
            .setTimestamp(new Date(item.create_date));
    } catch (err) {
        console.error('Failed to load image:', err.message);

        embed
            .setTitle(item.title)
            .setURL(`https://www.pixiv.net/artworks/${item.id}`)
            .setDescription(
                `**Artist:** ${item.user.name}\n` +
                `**Type:** ${typeEmoji} ${typeText}\n` +
                `⚠️ *Image failed to load - click link to view*\n` +
                `**NSFW:** ${nsfwStatus}\n` +
                `**AI-Generated:** ${aiStatus}`
            )
            .addFields({
                name: '🏷️ Tags',
                value: item.tags?.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                inline: false
            })
            .setFooter({
                text: `${sortModeText} • Page ${searchPage} • Result ${resultIndex + 1}/${totalResults} • ID: ${item.id}`
            })
            .setTimestamp(new Date(item.create_date));
    }
}

function createNoResultsEmbed(query, translatedQuery, shouldTranslate, contentType) {
    return new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('❌ No Results Found')
        .setDescription(
            `No ${contentType === 'novel' ? 'novels' : 'artwork'} found for: **${translatedQuery}**` +
            (shouldTranslate ? `\n(Translated from: "${query}")` : '')
        )
        .setFooter({ text: 'Try a different search term or adjust filters' })
        .setTimestamp();
}

function createErrorEmbed(error) {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Error')
        .setDescription('Failed to fetch content from Pixiv. Please try again later.')
        .addFields({
            name: 'Error Details',
            value: `\`\`\`${error.message}\`\`\``
        })
        .setFooter({ text: 'If this persists, contact the developer' })
        .setTimestamp();
}

module.exports = {
    createContentEmbed,
    createNoResultsEmbed,
    createErrorEmbed
};
