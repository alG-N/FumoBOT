/**
 * NHentai Handler
 * Creates embeds and buttons for nhentai command
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Colors
const COLORS = {
    NHENTAI: 0xED2553,
    ERROR: 0xFF0000,
    SUCCESS: 0x00FF00
};

class NHentaiHandler {
    constructor() {
        this.pageCache = new Map(); // userId -> { galleryId, currentPage, totalPages, gallery }
        this.searchCache = new Map(); // userId -> { query, sort, results, currentPage, totalPages }
        this.cacheExpiry = 600000; // 10 minutes
        
        // Auto-cleanup every 5 minutes to prevent memory leaks
        this._cleanupInterval = setInterval(() => this._cleanupExpiredSessions(), 300000);
    }
    
    _cleanupExpiredSessions() {
        const now = Date.now();
        let cleaned = 0;
        for (const [userId, session] of this.pageCache) {
            if (now > session.expiresAt) {
                this.pageCache.delete(userId);
                cleaned++;
            }
        }
        for (const [userId, session] of this.searchCache) {
            if (now > session.expiresAt) {
                this.searchCache.delete(userId);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[NHentai] Cleaned ${cleaned} expired sessions`);
        }
    }

    /**
     * Create gallery info embed
     */
    createGalleryEmbed(gallery, options = {}) {
        const { isRandom = false, isPopular = false } = options;
        const { id, media_id, title, tags, num_pages, upload_date, images } = gallery;
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.NHENTAI)
            .setTitle(this._getTitle(title))
            .setURL(`https://nhentai.net/g/${id}/`)
            .setFooter({ text: `ID: ${id} • ${num_pages} pages • Uploaded: ${this._formatDate(upload_date)}` });

        // Set thumbnail (cover image)
        const coverType = images?.cover?.t || 'j';
        embed.setThumbnail(this._getThumbnailUrl(media_id, coverType));

        // Add author badge
        if (isRandom) {
            embed.setAuthor({ name: '🎲 Random Gallery' });
        } else if (isPopular) {
            embed.setAuthor({ name: '🔥 Popular Gallery' });
        }

        // Parse and add tags
        const parsedTags = this._parseTags(tags);
        const fields = [];

        if (parsedTags.artists.length > 0) {
            fields.push({ name: '🎨 Artist', value: this._formatTagList(parsedTags.artists), inline: true });
        }
        if (parsedTags.parodies.length > 0) {
            fields.push({ name: '📚 Parody', value: this._formatTagList(parsedTags.parodies), inline: true });
        }
        if (parsedTags.characters.length > 0) {
            fields.push({ name: '👤 Characters', value: this._formatTagList(parsedTags.characters), inline: true });
        }
        if (parsedTags.groups.length > 0) {
            fields.push({ name: '👥 Group', value: this._formatTagList(parsedTags.groups), inline: true });
        }
        if (parsedTags.languages.length > 0) {
            fields.push({ name: '🌐 Language', value: this._formatTagList(parsedTags.languages), inline: true });
        }
        if (parsedTags.categories.length > 0) {
            fields.push({ name: '📂 Category', value: this._formatTagList(parsedTags.categories), inline: true });
        }
        if (parsedTags.tags.length > 0) {
            fields.push({ name: '🏷️ Tags', value: this._formatTagList(parsedTags.tags, 500), inline: false });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        }

        // Add Japanese title if different
        if (title.japanese && title.japanese !== title.english) {
            embed.setDescription(`*${title.japanese}*`);
        }

        return embed;
    }

    /**
     * Create page reader embed
     */
    createPageEmbed(gallery, pageNum) {
        const { id, media_id, title, num_pages, images } = gallery;
        const pages = images?.pages || [];
        
        if (pageNum < 1 || pageNum > pages.length) {
            return this.createErrorEmbed('Invalid page number.');
        }

        const page = pages[pageNum - 1];
        const imageUrl = this._getPageImageUrl(media_id, pageNum, page.t);

        const embed = new EmbedBuilder()
            .setColor(COLORS.NHENTAI)
            .setAuthor({ 
                name: this._truncate(this._getTitle(title), 100),
                url: `https://nhentai.net/g/${id}/`
            })
            .setImage(imageUrl)
            .setFooter({ text: `Page ${pageNum}/${num_pages} • ID: ${id}` });

        return embed;
    }

    /**
     * Create main action buttons
     */
    createMainButtons(galleryId, userId, numPages) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('View on nhentai')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://nhentai.net/g/${galleryId}/`)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setCustomId(`nhentai_read_${galleryId}_${userId}`)
                .setLabel(`Read (${numPages} pages)`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('📖'),
            new ButtonBuilder()
                .setCustomId(`nhentai_random_${userId}`)
                .setLabel('Random')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎲'),
            new ButtonBuilder()
                .setCustomId(`nhentai_popular_${userId}`)
                .setLabel('Popular')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔥')
        );

        return [row1];
    }

    /**
     * Create page navigation buttons
     */
    createPageButtons(galleryId, userId, currentPage, totalPages) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nhentai_first_${galleryId}_${userId}`)
                .setLabel('First')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏮️')
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`nhentai_prev_${galleryId}_${userId}`)
                .setLabel('Prev')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('◀️')
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`nhentai_page_${galleryId}_${userId}`)
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`nhentai_next_${galleryId}_${userId}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('▶️')
                .setDisabled(currentPage >= totalPages),
            new ButtonBuilder()
                .setCustomId(`nhentai_last_${galleryId}_${userId}`)
                .setLabel('Last')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⏭️')
                .setDisabled(currentPage >= totalPages)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nhentai_jump_${galleryId}_${userId}`)
                .setLabel('Jump to Page')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔢'),
            new ButtonBuilder()
                .setCustomId(`nhentai_info_${galleryId}_${userId}`)
                .setLabel('Gallery Info')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('ℹ️'),
            new ButtonBuilder()
                .setLabel('Open Page')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://nhentai.net/g/${galleryId}/${currentPage}/`)
                .setEmoji('🔗')
        );

        return [row, row2];
    }

    /**
     * Create error embed
     */
    createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('❌ Error')
            .setDescription(message)
            .setTimestamp();
    }

    /**
     * Create cooldown embed
     */
    createCooldownEmbed(remaining) {
        return new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('⏳ Cooldown')
            .setDescription(`Please wait **${remaining}s** before using this command again.`)
            .setTimestamp();
    }

    /**
     * Cache management for page reading sessions
     */
    setPageSession(userId, gallery, currentPage = 1) {
        this.pageCache.set(userId, {
            galleryId: gallery.id,
            gallery,
            currentPage,
            totalPages: gallery.num_pages,
            expiresAt: Date.now() + this.cacheExpiry
        });
    }

    getPageSession(userId) {
        const session = this.pageCache.get(userId);
        if (!session || Date.now() > session.expiresAt) {
            this.pageCache.delete(userId);
            return null;
        }
        return session;
    }

    updatePageSession(userId, currentPage) {
        const session = this.pageCache.get(userId);
        if (session) {
            session.currentPage = currentPage;
            session.expiresAt = Date.now() + this.cacheExpiry;
        }
    }

    clearPageSession(userId) {
        this.pageCache.delete(userId);
    }

    // Search session management
    setSearchSession(userId, data) {
        this.searchCache.set(userId, {
            ...data,
            expiresAt: Date.now() + this.cacheExpiry
        });
    }

    getSearchSession(userId) {
        const session = this.searchCache.get(userId);
        if (!session || Date.now() > session.expiresAt) {
            this.searchCache.delete(userId);
            return null;
        }
        return session;
    }

    /**
     * Create search results embed
     */
    createSearchResultsEmbed(query, data, page, sort) {
        const { results, numPages, totalResults } = data;
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.NHENTAI)
            .setTitle(`🔍 Search Results: "${query}"`)
            .setDescription(`Found **${totalResults}+** results • Page **${page}** of **${numPages}** • Sorted by **${sort === 'recent' ? 'Recent' : 'Popular'}**`)
            .setFooter({ text: 'Select a gallery to view more details' });

        // Show first 10 results
        const displayResults = results.slice(0, 10);
        let resultsList = '';
        
        displayResults.forEach((gallery, index) => {
            const title = this._truncate(this._getTitle(gallery.title), 50);
            const pages = gallery.num_pages || '?';
            const id = gallery.id;
            resultsList += `**${index + 1}.** \`${id}\` - ${title} (${pages}p)\n`;
        });

        if (resultsList) {
            embed.addFields({ name: '📚 Results', value: resultsList, inline: false });
        }

        return embed;
    }

    /**
     * Create search navigation buttons
     */
    createSearchButtons(query, data, page, userId) {
        const { results, numPages } = data;
        
        const row1 = new ActionRowBuilder();
        
        // Add buttons for first 5 results
        const firstFive = results.slice(0, 5);
        firstFive.forEach((gallery, index) => {
            row1.addComponents(
                new ButtonBuilder()
                    .setCustomId(`nhentai_view_${gallery.id}_${userId}`)
                    .setLabel(`${index + 1}`)
                    .setStyle(ButtonStyle.Secondary)
            );
        });

        const row2 = new ActionRowBuilder();
        
        // Add buttons for results 6-10
        const secondFive = results.slice(5, 10);
        if (secondFive.length > 0) {
            secondFive.forEach((gallery, index) => {
                row2.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`nhentai_view_${gallery.id}_${userId}`)
                        .setLabel(`${index + 6}`)
                        .setStyle(ButtonStyle.Secondary)
                );
            });
        }

        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`nhentai_sprev_${userId}`)
                .setLabel('Prev Page')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('◀️')
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`nhentai_spage_${userId}`)
                .setLabel(`${page}/${numPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`nhentai_snext_${userId}`)
                .setLabel('Next Page')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('▶️')
                .setDisabled(page >= numPages)
        );

        const rows = [row1];
        if (secondFive.length > 0) rows.push(row2);
        rows.push(row3);
        
        return rows;
    }

    // Private helper methods
    _getTitle(title) {
        return title.english || title.japanese || title.pretty || 'Unknown Title';
    }

    _formatDate(timestamp) {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Get thumbnail URL using multiple CDN mirrors
     * nhentai uses different CDN servers, try alternatives if main fails
     */
    _getThumbnailUrl(mediaId, coverType) {
        const ext = { 'j': 'jpg', 'p': 'png', 'g': 'gif' }[coverType] || 'jpg';
        // Use t2/t3/t5 CDN which tends to work better with Discord embeds
        // Main CDN: t.nhentai.net often gets blocked
        // Alternative CDNs: t2, t3, t5.nhentai.net
        return `https://t3.nhentai.net/galleries/${mediaId}/cover.${ext}`;
    }

    /**
     * Get page image URL using multiple CDN mirrors
     */
    _getPageImageUrl(mediaId, pageNum, pageType) {
        const ext = { 'j': 'jpg', 'p': 'png', 'g': 'gif' }[pageType] || 'jpg';
        // Use i2/i3/i5/i7 CDN which tends to work better with Discord embeds
        return `https://i3.nhentai.net/galleries/${mediaId}/${pageNum}.${ext}`;
    }

    _parseTags(tags) {
        const result = {
            artists: [], characters: [], parodies: [], 
            groups: [], tags: [], languages: [], categories: []
        };
        
        if (!tags || !Array.isArray(tags)) return result;
        
        for (const tag of tags) {
            const type = tag.type;
            if (result[type + 's']) {
                result[type + 's'].push(tag.name);
            } else if (type === 'tag') {
                result.tags.push(tag.name);
            }
        }
        
        // Limit each category
        for (const key in result) {
            result[key] = result[key].slice(0, 15);
        }
        
        return result;
    }

    _formatTagList(tags, maxLength = 300) {
        if (!tags || tags.length === 0) return 'None';
        let result = tags.join(', ');
        if (result.length > maxLength) {
            result = result.substring(0, maxLength - 3) + '...';
        }
        return result;
    }

    _truncate(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }
}

module.exports = new NHentaiHandler();
