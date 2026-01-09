/**
 * Wikipedia Handler
 * Creates embeds and buttons for Wikipedia articles
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

// Colors and Icons
const COLORS = {
    WIKIPEDIA: 0xFFFFFF,
    ERROR: 0xFF0000,
    SUCCESS: 0x00FF00
};

const WIKIPEDIA_ICON = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/103px-Wikipedia-logo-v2.svg.png';

class WikipediaHandler {
    /**
     * Create article embed
     */
    createArticleEmbed(article) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.WIKIPEDIA)
            .setAuthor({ 
                name: 'Wikipedia',
                iconURL: WIKIPEDIA_ICON,
                url: 'https://en.wikipedia.org'
            })
            .setTitle(article.displayTitle || article.title)
            .setURL(article.url)
            .setTimestamp();

        // Build description
        let description = '';
        if (article.description) {
            description = `*${article.description}*\n\n`;
        }
        description += this._truncate(article.extract, 1800 - description.length);
        embed.setDescription(description);

        // Add thumbnail
        if (article.thumbnail) {
            embed.setThumbnail(article.thumbnail);
        }

        // Add coordinates if available
        if (article.coordinates) {
            embed.addFields({
                name: '📍 Location',
                value: `[${article.coordinates.lat.toFixed(4)}, ${article.coordinates.lon.toFixed(4)}](https://www.google.com/maps?q=${article.coordinates.lat},${article.coordinates.lon})`,
                inline: true
            });
        }

        // Footer with type indicator
        const typeLabel = article.type === 'disambiguation' ? '(Disambiguation Page)' : '';
        const langLabel = article.language ? `[${article.language.toUpperCase()}]` : '';
        embed.setFooter({ text: `Wikipedia ${langLabel} ${typeLabel}`.trim() });

        return embed;
    }

    /**
     * Create search results embed
     */
    createSearchResultsEmbed(query, results) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.WIKIPEDIA)
            .setAuthor({ 
                name: 'Wikipedia Search',
                iconURL: WIKIPEDIA_ICON
            })
            .setTitle(`🔍 Search: "${this._truncate(query, 50)}"`)
            .setTimestamp();

        if (results.length === 0) {
            embed.setDescription('No articles found. Try a different search term.');
            return embed;
        }

        const description = results.map((result, i) => {
            const desc = this._truncate(result.description, 100);
            return `**${i + 1}. [${result.title}](${result.url})**\n${desc}`;
        }).join('\n\n');

        embed.setDescription(description);
        embed.setFooter({ text: `Found ${results.length} articles` });

        return embed;
    }

    /**
     * Create random article embed (with special styling)
     */
    createRandomArticleEmbed(article) {
        const embed = this.createArticleEmbed(article);
        embed.setAuthor({ 
            name: '🎲 Random Wikipedia Article',
            iconURL: WIKIPEDIA_ICON,
            url: 'https://en.wikipedia.org/wiki/Special:Random'
        });
        return embed;
    }

    /**
     * Create "On This Day" embed
     */
    createOnThisDayEmbed(events, date) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.WIKIPEDIA)
            .setAuthor({ 
                name: 'Wikipedia - On This Day',
                iconURL: WIKIPEDIA_ICON
            })
            .setTitle(`📅 ${monthNames[date.month - 1]} ${date.day}`)
            .setTimestamp();

        if (events.length === 0) {
            embed.setDescription('No events found for this date.');
            return embed;
        }

        const description = events.map(event => {
            const pageLinks = event.pages?.map(p => `[${p.title}](${p.url})`).join(', ') || '';
            return `**${event.year}** - ${this._truncate(event.text, 200)}${pageLinks ? `\n*Related: ${pageLinks}*` : ''}`;
        }).join('\n\n');

        embed.setDescription(description);
        return embed;
    }

    /**
     * Create article action buttons
     */
    createArticleButtons(article, userId) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Read on Wikipedia')
                .setStyle(ButtonStyle.Link)
                .setURL(article.url)
                .setEmoji('📖'),
            new ButtonBuilder()
                .setCustomId(`wiki_random_${userId}`)
                .setLabel('Random Article')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🎲')
        );

        // Add image button if original image exists
        if (article.originalImage) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('View Image')
                    .setStyle(ButtonStyle.Link)
                    .setURL(article.originalImage)
                    .setEmoji('🖼️')
            );
        }

        return row;
    }

    /**
     * Create search result select menu
     */
    createSearchSelectMenu(results, userId) {
        if (results.length === 0) return null;

        const options = results.map((result, i) => ({
            label: this._truncate(result.title, 100),
            description: this._truncate(result.description, 100),
            value: `wiki_select_${i}_${userId}`,
            emoji: '📄'
        }));

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`wiki_search_${userId}`)
                .setPlaceholder('Select an article to view...')
                .addOptions(options)
        );
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

    // Private helpers
    _truncate(text, maxLength) {
        if (!text) return '';
        // Clean HTML tags if any
        const clean = text.replace(/<[^>]*>/g, '');
        return clean.length > maxLength ? clean.substring(0, maxLength - 3) + '...' : clean;
    }
}

module.exports = new WikipediaHandler();
