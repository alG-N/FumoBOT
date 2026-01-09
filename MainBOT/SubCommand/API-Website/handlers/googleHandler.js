/**
 * Google Search Handler
 * Creates embeds and buttons for search results
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Colors
const COLORS = {
    GOOGLE: 0x4285F4,
    DUCKDUCKGO: 0xDE5833,
    ERROR: 0xFF0000
};

// Icons
const ICONS = {
    GOOGLE: 'https://www.google.com/favicon.ico',
    DUCKDUCKGO: 'https://duckduckgo.com/favicon.ico'
};

class GoogleHandler {
    /**
     * Create search results embed
     */
    createResultsEmbed(query, results, options = {}) {
        const { totalResults = 0, searchEngine = 'Google' } = options;
        
        const color = searchEngine === 'Google' ? COLORS.GOOGLE : COLORS.DUCKDUCKGO;
        const icon = searchEngine === 'Google' ? ICONS.GOOGLE : ICONS.DUCKDUCKGO;

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({ 
                name: `${searchEngine} Search`,
                iconURL: icon
            })
            .setTitle(`🔍 "${this._truncate(query, 50)}"`)
            .setTimestamp();

        if (results.length === 0) {
            embed.setDescription('No results found for your query. Try different keywords.');
            embed.setFooter({ text: 'No results' });
            return embed;
        }

        // Format results
        const description = results.map((result, i) => {
            const title = this._truncate(result.title, 60);
            const snippet = this._truncate(result.snippet, 150);
            const domain = result.displayLink || this._extractDomain(result.link);
            
            return `**${i + 1}. [${title}](${result.link})**\n${snippet}\n\`${domain}\``;
        }).join('\n\n');

        embed.setDescription(description);
        embed.setFooter({ text: `About ${this._formatNumber(totalResults)} results` });

        return embed;
    }

    /**
     * Create search buttons
     */
    createSearchButtons(query, searchEngine) {
        const url = searchEngine === 'Google'
            ? `https://www.google.com/search?q=${encodeURIComponent(query)}`
            : `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;

        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel(`View more on ${searchEngine}`)
                .setStyle(ButtonStyle.Link)
                .setURL(url)
                .setEmoji('🔗'),
            new ButtonBuilder()
                .setLabel('Image Search')
                .setStyle(ButtonStyle.Link)
                .setURL(searchEngine === 'Google' 
                    ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`
                    : `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`)
                .setEmoji('🖼️')
        );
    }

    /**
     * Create error embed
     */
    createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('❌ Search Error')
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
            .setDescription(`Please wait **${remaining}s** before searching again.`)
            .setTimestamp();
    }

    // Private helpers
    _truncate(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }

    _extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    _formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    }
}

module.exports = new GoogleHandler();
