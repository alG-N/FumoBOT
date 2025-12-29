const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const rule34Service = require('../services/rule34Service');
const rule34Cache = require('../repositories/rule34Cache');
const { truncateText, formatNumber } = require('../../shared/utils/embed');

// Rating colors
const RATING_COLORS = {
    safe: '#00FF00',
    questionable: '#FFD700',
    explicit: '#FF0000',
    default: '#9400D3'
};

// Rating emojis
const RATING_EMOJIS = {
    safe: '🟢',
    questionable: '🟡',
    explicit: '🔴'
};

// Content type emojis
const CONTENT_EMOJIS = {
    video: '🎬',
    gif: '🎞️',
    animated: '✨',
    comic: '📖',
    image: '🖼️'
};

// Sort mode display
const SORT_DISPLAY = {
    'score:desc': '⭐ Score (High to Low)',
    'score:asc': '⭐ Score (Low to High)',
    'id:desc': '🆕 Newest First',
    'id:asc': '📅 Oldest First',
    'updated:desc': '🔄 Recently Updated',
    'random': '🎲 Random'
};

/**
 * Create the main post embed
 */
async function createPostEmbed(post, options = {}) {
    const {
        resultIndex = 0,
        totalResults = 1,
        searchPage = 1,
        query = '',
        userId = '',
        showTags = false,
        compactMode = false
    } = options;

    const ratingColor = RATING_COLORS[post.rating] || RATING_COLORS.default;
    const ratingEmoji = RATING_EMOJIS[post.rating] || '⚪';
    const contentEmoji = CONTENT_EMOJIS[post.contentType] || '🖼️';

    const embed = new EmbedBuilder()
        .setColor(ratingColor)
        .setTitle(`${contentEmoji} Post #${post.id}`)
        .setURL(post.pageUrl);

    // Build description
    let description = '';

    // Rating and basic info
    description += `${ratingEmoji} **Rating:** ${post.rating?.toUpperCase() || 'Unknown'}\n`;
    description += `⭐ **Score:** ${formatNumber(post.score)}\n`;
    description += `📐 **Dimensions:** ${post.width} × ${post.height}`;
    
    if (post.isHighRes) description += ' 📺';
    description += '\n';

    // Indicators
    const indicators = [];
    if (post.isAiGenerated) indicators.push('🤖 AI');
    if (post.isAnimated) indicators.push('✨ Animated');
    if (post.hasSound) indicators.push('🔊 Sound');
    if (post.hasVideo) indicators.push('🎬 Video');
    if (post.isHighQuality) indicators.push('💎 HQ');
    
    if (indicators.length > 0) {
        description += indicators.join(' • ') + '\n';
    }

    // Owner/uploader
    if (post.owner) {
        description += `👤 **Uploader:** ${post.owner}\n`;
    }

    // Source
    if (post.source && post.source.length > 0) {
        const sourceDisplay = post.source.length > 50 
            ? post.source.substring(0, 47) + '...' 
            : post.source;
        description += `🔗 **Source:** [Link](${post.source.startsWith('http') ? post.source : 'https://' + post.source})\n`;
    }

    embed.setDescription(description);

    // Tags field (optional, for expanded view)
    if (showTags && post.tags) {
        const formattedTags = rule34Service.formatTagsForDisplay(post.tags, 1000);
        embed.addFields({ name: '🏷️ Tags', value: formattedTags || 'No tags', inline: false });
    }

    // Set image (use sample for large files)
    const imageUrl = post.hasVideo ? post.previewUrl : (post.sampleUrl || post.fileUrl);
    if (imageUrl && !post.hasVideo) {
        embed.setImage(imageUrl);
    } else if (post.previewUrl) {
        embed.setThumbnail(post.previewUrl);
    }

    // Footer with navigation info
    const footerParts = [];
    footerParts.push(`Result ${resultIndex + 1}/${totalResults}`);
    if (searchPage > 1) footerParts.push(`Page ${searchPage}`);
    footerParts.push(`File: .${post.fileExtension}`);
    
    embed.setFooter({ text: footerParts.join(' • ') });
    embed.setTimestamp(post.createdAt ? new Date(post.createdAt) : new Date());

    // Create buttons
    const rows = createPostButtons(post, { resultIndex, totalResults, userId, searchPage });

    return { embed, rows };
}

/**
 * Create navigation and action buttons
 */
function createPostButtons(post, options = {}) {
    const { resultIndex = 0, totalResults = 1, userId = '', searchPage = 1 } = options;
    const rows = [];

    // Row 1: Navigation buttons
    const navRow = new ActionRowBuilder();
    
    navRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`r34_prev_${userId}`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(resultIndex === 0 && searchPage === 1),
        new ButtonBuilder()
            .setCustomId(`r34_counter_${userId}`)
            .setLabel(`${resultIndex + 1}/${totalResults}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`r34_next_${userId}`)
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(resultIndex >= totalResults - 1),
        new ButtonBuilder()
            .setCustomId(`r34_random_${userId}`)
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Random')
    );
    rows.push(navRow);

    // Row 2: Action buttons
    const actionRow = new ActionRowBuilder();
    
    // Full image link
    actionRow.addComponents(
        new ButtonBuilder()
            .setLabel('Full Image')
            .setStyle(ButtonStyle.Link)
            .setURL(post.fileUrl)
            .setEmoji('🔗')
    );
    
    // View on site
    actionRow.addComponents(
        new ButtonBuilder()
            .setLabel('View on Site')
            .setStyle(ButtonStyle.Link)
            .setURL(post.pageUrl)
            .setEmoji('🌐')
    );
    
    // Favorite button
    const isFavorited = rule34Cache.isFavorited(userId, post.id);
    actionRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`r34_fav_${post.id}_${userId}`)
            .setEmoji(isFavorited ? '💖' : '🤍')
            .setStyle(isFavorited ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
    
    // Tags toggle
    actionRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`r34_tags_${userId}`)
            .setEmoji('🏷️')
            .setStyle(ButtonStyle.Secondary)
    );
    
    rows.push(actionRow);

    // Row 3: Page navigation (if needed)
    const pageRow = new ActionRowBuilder();
    
    pageRow.addComponents(
        new ButtonBuilder()
            .setCustomId(`r34_prevpage_${userId}`)
            .setLabel('◀ Prev Page')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(searchPage <= 1),
        new ButtonBuilder()
            .setCustomId(`r34_pageinfo_${userId}`)
            .setLabel(`Page ${searchPage}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`r34_nextpage_${userId}`)
            .setLabel('Next Page ▶')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`r34_related_${userId}`)
            .setEmoji('🔍')
            .setLabel('Related')
            .setStyle(ButtonStyle.Secondary)
    );
    rows.push(pageRow);

    return rows;
}

/**
 * Create video embed (for .mp4/.webm content)
 */
function createVideoEmbed(post, options = {}) {
    const { resultIndex = 0, totalResults = 1, userId = '' } = options;
    
    const ratingEmoji = RATING_EMOJIS[post.rating] || '⚪';
    
    const embed = new EmbedBuilder()
        .setColor(RATING_COLORS[post.rating] || RATING_COLORS.default)
        .setTitle(`🎬 Video Post #${post.id}`)
        .setURL(post.pageUrl)
        .setDescription(
            `${ratingEmoji} **Rating:** ${post.rating?.toUpperCase()}\n` +
            `⭐ **Score:** ${formatNumber(post.score)}\n` +
            `📐 **Dimensions:** ${post.width} × ${post.height}\n` +
            `${post.hasSound ? '🔊 Has Sound' : '🔇 No Sound'}\n\n` +
            `⚠️ **Videos cannot be embedded directly.**\n` +
            `Click the button below to watch.`
        );
    
    if (post.previewUrl) {
        embed.setImage(post.previewUrl);
    }
    
    embed.setFooter({ text: `Result ${resultIndex + 1}/${totalResults} • File: .${post.fileExtension}` });

    // Create buttons with video-specific options
    const rows = createPostButtons(post, options);
    
    // Add video button to first action row
    const videoButton = new ButtonBuilder()
        .setLabel('Watch Video')
        .setStyle(ButtonStyle.Link)
        .setURL(post.fileUrl)
        .setEmoji('▶️');
    
    // Insert at the beginning of action row
    if (rows[1]) {
        rows[1].components.unshift(videoButton);
        // Keep only 5 buttons max per row
        if (rows[1].components.length > 5) {
            rows[1].components.pop();
        }
    }

    return { embed, rows };
}

/**
 * Create search results summary embed
 */
function createSearchSummaryEmbed(results, query, options = {}) {
    const { page = 1, filters = {} } = options;
    
    const embed = new EmbedBuilder()
        .setColor('#9400D3')
        .setTitle('🔍 Rule34 Search Results')
        .setDescription(
            `**Query:** \`${query || 'all'}\`\n` +
            `**Results Found:** ${results.posts.length}${results.hasMore ? '+' : ''}\n` +
            `**Page:** ${page}`
        );

    // Active filters
    const activeFilters = [];
    if (filters.excludeAi) activeFilters.push('🤖 AI Excluded');
    if (filters.rating) activeFilters.push(`${RATING_EMOJIS[filters.rating]} ${filters.rating} only`);
    if (filters.minScore > 0) activeFilters.push(`⭐ Score ≥${filters.minScore}`);
    if (filters.highQualityOnly) activeFilters.push('💎 HQ Only');
    if (filters.contentType) activeFilters.push(`📁 ${filters.contentType} only`);
    
    if (activeFilters.length > 0) {
        embed.addFields({ name: '🎛️ Active Filters', value: activeFilters.join(' • '), inline: false });
    }

    // Stats
    const stats = [];
    const aiCount = results.posts.filter(p => p.isAiGenerated).length;
    const videoCount = results.posts.filter(p => p.hasVideo).length;
    const animatedCount = results.posts.filter(p => p.isAnimated).length;
    
    if (aiCount > 0) stats.push(`🤖 ${aiCount} AI`);
    if (videoCount > 0) stats.push(`🎬 ${videoCount} Videos`);
    if (animatedCount > 0) stats.push(`✨ ${animatedCount} Animated`);
    
    if (stats.length > 0) {
        embed.addFields({ name: '📊 Content Stats', value: stats.join(' • '), inline: false });
    }

    return embed;
}

/**
 * Create no results embed
 */
function createNoResultsEmbed(query, suggestions = []) {
    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('❌ No Results Found')
        .setDescription(
            `No posts found for: \`${query || 'your search'}\`\n\n` +
            '**Tips:**\n' +
            '• Check spelling and try alternative tags\n' +
            '• Use underscores instead of spaces (e.g., `blue_eyes`)\n' +
            '• Try broader or fewer tags\n' +
            '• Use the wildcard `*` for partial matches'
        );

    if (suggestions.length > 0) {
        embed.addFields({
            name: '💡 Did you mean?',
            value: suggestions.slice(0, 5).map(s => `\`${s}\``).join(', '),
            inline: false
        });
    }

    return embed;
}

/**
 * Create error embed
 */
function createErrorEmbed(error, details = '') {
    return new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Error')
        .setDescription(
            `An error occurred: ${error.message || 'Unknown error'}\n` +
            (details ? `\n${details}` : '') +
            '\n\nPlease try again later.'
        )
        .setTimestamp();
}

/**
 * Create blacklist management embed
 */
function createBlacklistEmbed(userId, blacklist) {
    const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('🚫 Your Blacklist')
        .setDescription(
            blacklist.length > 0
                ? `You have **${blacklist.length}** blacklisted tags:\n\n` +
                  blacklist.map(t => `\`${t}\``).join(', ')
                : '📭 Your blacklist is empty.\n\nUse `/rule34 blacklist add <tags>` to add tags.'
        );

    if (blacklist.length > 0) {
        embed.addFields({
            name: '💡 Commands',
            value: 
                '`/rule34 blacklist remove <tag>` - Remove a tag\n' +
                '`/rule34 blacklist clear` - Clear all tags',
            inline: false
        });
    }

    embed.addFields({
        name: '📋 Suggested Tags to Blacklist',
        value: rule34Service.getBlacklistSuggestions().slice(0, 10).map(t => `\`${t}\``).join(', '),
        inline: false
    });

    return embed;
}

/**
 * Create favorites embed
 */
function createFavoritesEmbed(userId, favorites, page = 0) {
    const perPage = 10;
    const totalPages = Math.ceil(favorites.length / perPage);
    const start = page * perPage;
    const pageFavorites = favorites.slice(start, start + perPage);

    const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('💖 Your Favorites')
        .setDescription(
            favorites.length > 0
                ? `You have **${favorites.length}** favorited posts.`
                : '📭 No favorites yet.\n\nClick the 🤍 button on any post to add it to your favorites!'
        );

    if (pageFavorites.length > 0) {
        const list = pageFavorites.map((fav, i) => 
            `**${start + i + 1}.** [Post #${fav.id}](https://rule34.xxx/index.php?page=post&s=view&id=${fav.id})` +
            (fav.score ? ` ⭐${fav.score}` : '')
        ).join('\n');
        
        embed.addFields({ name: `Page ${page + 1}/${totalPages}`, value: list, inline: false });
    }

    embed.setFooter({ text: `Page ${page + 1} of ${totalPages || 1}` });

    return embed;
}

/**
 * Create settings embed
 */
function createSettingsEmbed(userId) {
    const prefs = rule34Cache.getPreferences(userId);
    
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⚙️ Your Rule34 Settings')
        .setDescription('Configure your search preferences below.');

    const settings = [
        `🤖 **AI Filter:** ${prefs.aiFilter ? '✅ Enabled' : '❌ Disabled'}`,
        `⭐ **Min Score:** ${prefs.minScore}`,
        `💎 **High Quality Only:** ${prefs.highQualityOnly ? '✅' : '❌'}`,
        `🗑️ **Exclude Low Quality:** ${prefs.excludeLowQuality ? '✅' : '❌'}`,
        `✨ **Animated Only:** ${prefs.showAnimatedOnly ? '✅' : '❌'}`,
        `📊 **Default Sort:** ${SORT_DISPLAY[prefs.sortMode] || prefs.sortMode}`,
        `📄 **Results Per Page:** ${prefs.resultsPerPage}`,
        `🔒 **Safe Mode:** ${prefs.safeMode ? '✅ Enabled' : '❌ Disabled'}`
    ];

    embed.addFields({ name: 'Current Settings', value: settings.join('\n'), inline: false });

    return embed;
}

/**
 * Create settings select menu
 */
function createSettingsComponents(userId) {
    const prefs = rule34Cache.getPreferences(userId);
    const rows = [];

    // AI Filter toggle
    const row1 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`r34_setting_aifilter_${userId}`)
            .setPlaceholder('🤖 AI Filter')
            .addOptions([
                { label: 'AI Filter: ON', value: 'true', emoji: '✅', default: prefs.aiFilter },
                { label: 'AI Filter: OFF', value: 'false', emoji: '❌', default: !prefs.aiFilter }
            ])
    );
    rows.push(row1);

    // Sort mode
    const row2 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`r34_setting_sort_${userId}`)
            .setPlaceholder('📊 Sort Mode')
            .addOptions([
                { label: 'Score (High to Low)', value: 'score:desc', emoji: '⭐', default: prefs.sortMode === 'score:desc' },
                { label: 'Score (Low to High)', value: 'score:asc', emoji: '⭐', default: prefs.sortMode === 'score:asc' },
                { label: 'Newest First', value: 'id:desc', emoji: '🆕', default: prefs.sortMode === 'id:desc' },
                { label: 'Oldest First', value: 'id:asc', emoji: '📅', default: prefs.sortMode === 'id:asc' },
                { label: 'Random', value: 'random', emoji: '🎲', default: prefs.sortMode === 'random' }
            ])
    );
    rows.push(row2);

    // Quality settings
    const row3 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`r34_setting_quality_${userId}`)
            .setPlaceholder('💎 Quality Settings')
            .addOptions([
                { label: 'Show All Quality', value: 'all', emoji: '📷' },
                { label: 'Exclude Low Quality', value: 'exclude_low', emoji: '🗑️', default: prefs.excludeLowQuality },
                { label: 'High Quality Only', value: 'high_only', emoji: '💎', default: prefs.highQualityOnly }
            ])
    );
    rows.push(row3);

    // Min score
    const row4 = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`r34_setting_minscore_${userId}`)
            .setPlaceholder('⭐ Minimum Score')
            .addOptions([
                { label: 'No Minimum', value: '0', default: prefs.minScore === 0 },
                { label: 'Score ≥ 10', value: '10', default: prefs.minScore === 10 },
                { label: 'Score ≥ 50', value: '50', default: prefs.minScore === 50 },
                { label: 'Score ≥ 100', value: '100', default: prefs.minScore === 100 },
                { label: 'Score ≥ 500', value: '500', default: prefs.minScore === 500 }
            ])
    );
    rows.push(row4);

    // Reset button
    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`r34_settings_reset_${userId}`)
            .setLabel('Reset to Defaults')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔄'),
        new ButtonBuilder()
            .setCustomId(`r34_settings_close_${userId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
    );
    rows.push(row5);

    return rows;
}

/**
 * Create related tags embed
 */
function createRelatedTagsEmbed(originalTag, relatedTags) {
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🔗 Tags Related to "${originalTag}"`)
        .setDescription(
            relatedTags.length > 0
                ? relatedTags.map(({ tag, count }) => 
                    `\`${tag}\` (${count} posts)`
                  ).join('\n')
                : 'No related tags found.'
        );

    return embed;
}

/**
 * Create history embed
 */
function createHistoryEmbed(userId, history) {
    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('📜 Your View History')
        .setDescription(
            history.length > 0
                ? `Your last **${history.length}** viewed posts:`
                : '📭 No view history yet.'
        );

    if (history.length > 0) {
        const list = history.slice(0, 15).map((item, i) => {
            const timeAgo = getTimeAgo(item.viewedAt);
            return `**${i + 1}.** [Post #${item.id}](https://rule34.xxx/index.php?page=post&s=view&id=${item.id}) - ${timeAgo}`;
        }).join('\n');
        
        embed.addFields({ name: 'Recent Views', value: list, inline: false });
    }

    return embed;
}

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

module.exports = {
    createPostEmbed,
    createVideoEmbed,
    createPostButtons,
    createSearchSummaryEmbed,
    createNoResultsEmbed,
    createErrorEmbed,
    createBlacklistEmbed,
    createFavoritesEmbed,
    createSettingsEmbed,
    createSettingsComponents,
    createRelatedTagsEmbed,
    createHistoryEmbed,
    RATING_COLORS,
    RATING_EMOJIS,
    CONTENT_EMOJIS,
    SORT_DISPLAY
};
