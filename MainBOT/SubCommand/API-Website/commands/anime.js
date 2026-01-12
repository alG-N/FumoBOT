const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const anilistService = require('../services/anilistService');
const myAnimeListService = require('../services/myAnimeListService');
const animeHandler = require('../handlers/animeHandler');

// Cache for autocomplete results
const autocompleteCache = new Map();
const AUTOCOMPLETE_CACHE_DURATION = 60000; // 1 minute

// Cleanup expired cache entries every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of autocompleteCache) {
        if (now - value.timestamp > AUTOCOMPLETE_CACHE_DURATION) {
            autocompleteCache.delete(key);
        }
    }
}, 120000);

// MAL media types
const MAL_TYPES = {
    anime: { emoji: '📺', label: 'Anime', endpoint: 'anime' },
    manga: { emoji: '📚', label: 'Manga', endpoint: 'manga' },
    lightnovel: { emoji: '📖', label: 'Light Novel', endpoint: 'manga' }, // Uses manga endpoint with filter
    webnovel: { emoji: '💻', label: 'Web Novel', endpoint: 'manga' },
    oneshot: { emoji: '📄', label: 'One-shot', endpoint: 'manga' }
};

async function handleAnimeSearch(context, animeName, isSlash = true, source = 'anilist', mediaType = 'anime') {
    try {
        let result;
        
        if (source === 'mal') {
            result = await myAnimeListService.searchMedia(animeName, mediaType);
        } else {
            result = await anilistService.searchAnime(animeName);
        }
        
        if (!result) throw new Error('Not found.');

        const embed = await animeHandler.createMediaEmbed(result, source, mediaType);
        const row = createActionRow(result.siteUrl, source, mediaType);

        if (isSlash) {
            await context.editReply({ embeds: [embed], components: [row] });
        } else {
            await context.reply({ embeds: [embed], components: [row] });
        }

    } catch (err) {
        console.error('[Anime Search Error]', err);
        const typeLabel = MAL_TYPES[mediaType]?.label || 'anime';
        const errorMsg = `❌ Could not find ${typeLabel}: **${animeName}**${source === 'mal' ? ' on MyAnimeList' : ''}.`;
        if (isSlash) {
            await context.editReply({ content: errorMsg }).catch(() => {});
        } else {
            await context.reply({ content: errorMsg }).catch(() => {});
        }
    }
}

/**
 * Create action row with link button
 */
function createActionRow(siteUrl, source = 'anilist', mediaType = 'anime') {
    const typeInfo = MAL_TYPES[mediaType] || MAL_TYPES.anime;
    
    let buttonLabel, buttonEmoji;
    if (source === 'mal') {
        buttonLabel = `View ${typeInfo.label} on MyAnimeList`;
        buttonEmoji = '📗';
    } else {
        buttonLabel = 'View on AniList';
        buttonEmoji = '📘';
    }
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(buttonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(siteUrl)
            .setEmoji(buttonEmoji)
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('Search for anime, manga, and more')
        .addStringOption(opt =>
            opt.setName('source')
                .setDescription('Database source')
                .setRequired(true)
                .addChoices(
                    { name: '📘 AniList', value: 'anilist' },
                    { name: '📗 MyAnimeList', value: 'mal' }
                )
        )
        .addStringOption(opt =>
            opt.setName('name')
                .setDescription('Search query')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(opt =>
            opt.setName('type')
                .setDescription('Media type (MyAnimeList only)')
                .setRequired(false)
                .addChoices(
                    { name: '📺 Anime', value: 'anime' },
                    { name: '📚 Manga', value: 'manga' },
                    { name: '📖 Light Novel', value: 'lightnovel' },
                    { name: '💻 Web Novel', value: 'webnovel' },
                    { name: '📄 One-shot', value: 'oneshot' }
                )
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const source = interaction.options.getString('source') || 'anilist';
        const mediaType = interaction.options.getString('type') || 'anime';

        // Only handle name autocomplete
        if (focused.name !== 'name') {
            return interaction.respond([]).catch(() => {});
        }

        const query = focused.value;
        if (!query || query.length < 2) {
            return interaction.respond([]).catch(() => {});
        }

        try {
            // Check cache first (include source and type in cache key)
            const cacheKey = `${source}_${mediaType}_${query.toLowerCase()}`;
            const cached = autocompleteCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < AUTOCOMPLETE_CACHE_DURATION) {
                return interaction.respond(cached.choices).catch(() => {});
            }

            // Set timeout for autocomplete (must respond within 3 seconds)
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 2500)
            );

            let searchPromise;
            if (source === 'mal') {
                searchPromise = myAnimeListService.searchMediaAutocomplete(query, mediaType, 10);
            } else {
                searchPromise = anilistService.searchAnimeAutocomplete(query, 10);
            }

            const results = await Promise.race([searchPromise, timeoutPromise]);
            const typeInfo = MAL_TYPES[mediaType] || MAL_TYPES.anime;

            const choices = results.map(item => {
                const title = item.title.english || item.title.romaji || item.title.native;
                const year = item.seasonYear || item.startYear ? ` (${item.seasonYear || item.startYear})` : '';
                const format = item.format ? ` [${item.format}]` : '';
                const score = item.averageScore ? ` ⭐${item.averageScore}` : '';
                
                let sourceIcon = '';
                if (source === 'mal') {
                    sourceIcon = `${typeInfo.emoji} `;
                }
                
                const displayName = `${sourceIcon}${title}${year}${format}${score}`.slice(0, 100);
                
                return {
                    name: displayName,
                    value: (item.title.romaji || item.title.english || item.title.native || title).slice(0, 100)
                };
            });

            // Cache the results
            autocompleteCache.set(cacheKey, {
                choices,
                timestamp: Date.now()
            });

            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            console.log('[Anime Autocomplete] Timeout or error:', error.message);
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        // Access control check
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const source = interaction.options.getString('source');
        const animeName = interaction.options.getString('name');
        let mediaType = interaction.options.getString('type') || 'anime';
        
        // AniList only supports anime, ignore type option
        if (source === 'anilist') {
            mediaType = 'anime';
        }
        
        await interaction.deferReply();
        await handleAnimeSearch(interaction, animeName, true, source, mediaType);
    },

    async onMessage(message) {
        if (!message.content.startsWith('!anime ')) return;
        const animeName = message.content.slice(7).trim();
        if (!animeName) {
            await message.reply('Please provide an anime name.');
            return;
        }
        await handleAnimeSearch(message, animeName, false);
    },

    handleAnimeSearch
};
