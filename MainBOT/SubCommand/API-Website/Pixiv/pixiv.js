const { SlashCommandBuilder } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const pixivService = require('./services/pixivService');
const pixivCache = require('./repositories/pixivCache');
const contentHandler = require('./handlers/contentHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pixiv')
        .setDescription('Search for artwork, manga, or novels on Pixiv')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search by tag/keyword OR artwork ID (e.g., 139155931)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of content to search for')
                .setRequired(false)
                .addChoices(
                    { name: '🎨 Illustration', value: 'illust' },
                    { name: '📚 Manga', value: 'manga' },
                    { name: '📖 Light Novel', value: 'novel' }
                )
        )
        .addStringOption(option =>
            option.setName('sort')
                .setDescription('Sort results')
                .setRequired(false)
                .addChoices(
                    { name: '🔥 Popular (Default)', value: 'popular_desc' },
                    { name: '🆕 Newest First', value: 'date_desc' },
                    { name: '📅 Oldest First', value: 'date_asc' },
                    { name: '📊 Daily Ranking', value: 'day' },
                    { name: '📈 Weekly Ranking', value: 'week' },
                    { name: '🏆 Monthly Ranking', value: 'month' }
                )
        )
        .addStringOption(option =>
            option.setName('nsfw')
                .setDescription('NSFW content filter')
                .setRequired(false)
                .addChoices(
                    { name: '✅ SFW Only (Default)', value: 'sfw' },
                    { name: '🔞 R18 + SFW (Show All)', value: 'all' },
                    { name: '🔥 R18 Only', value: 'r18only' }
                )
        )
        .addBooleanOption(option =>
            option.setName('ai_filter')
                .setDescription('Hide AI-generated content (Default: OFF - shows AI art)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('quality_filter')
                .setDescription('Hide low quality art (under 1000 views)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('translate')
                .setDescription('Translate your search to Japanese')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Page number (default: 1)')
                .setMinValue(1)
                .setMaxValue(50)
        )
        .addIntegerOption(option =>
            option.setName('min_bookmarks')
                .setDescription('Minimum bookmarks filter (e.g., 100, 500, 1000)')
                .setMinValue(0)
                .setMaxValue(100000)
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused(true);

            if (focused.name !== 'query') {
                return interaction.respond([]).catch(() => {});
            }

            const focusedValue = focused.value?.trim();

            if (!focusedValue || focusedValue.length < 1) {
                return interaction.respond([
                    { name: '💡 Type to search...', value: ' ' }
                ]).catch(() => {});
            }

            // Check cache first
            const cached = pixivCache.getSearchSuggestions(focusedValue);
            if (cached) {
                return interaction.respond(cached).catch(() => {});
            }

            // Set a strict timeout
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 2000)
            );

            const searchPromise = (async () => {
                let choices = [];
                const isEnglish = pixivService.isEnglishText(focusedValue);

                // ALWAYS add the exact user input as FIRST option
                choices.push({
                    name: `🔍 "${focusedValue}"`.slice(0, 100),
                    value: focusedValue.slice(0, 100)
                });

                if (isEnglish) {
                    // English input - also offer translation
                    try {
                        const translated = await pixivService.translateToJapanese(focusedValue);
                        if (translated && translated !== focusedValue) {
                            choices.push({
                                name: `🌐 ${translated} (${focusedValue})`.slice(0, 100),
                                value: translated.slice(0, 100)
                            });
                        }

                        // Get suggestions based on translated query
                        const suggestions = await pixivService.getAutocompleteSuggestions(translated);
                        
                        if (suggestions.length > 0) {
                            // Translate suggestions to English for display
                            const limitedSuggestions = suggestions.slice(0, 12);
                            
                            for (const keyword of limitedSuggestions) {
                                if (keyword.toLowerCase() === focusedValue.toLowerCase() || 
                                    keyword.toLowerCase() === translated?.toLowerCase()) {
                                    continue;
                                }

                                try {
                                    const englishTranslation = await pixivService.translateToEnglish(keyword);
                                    if (englishTranslation && englishTranslation !== keyword) {
                                        choices.push({
                                            name: `${keyword} (${englishTranslation})`.slice(0, 100),
                                            value: keyword.slice(0, 100)
                                        });
                                    } else {
                                        choices.push({
                                            name: keyword.slice(0, 100),
                                            value: keyword.slice(0, 100)
                                        });
                                    }
                                } catch {
                                    choices.push({
                                        name: keyword.slice(0, 100),
                                        value: keyword.slice(0, 100)
                                    });
                                }
                            }
                        }
                    } catch {}
                } else {
                    // Japanese/non-English input - get suggestions and translate them
                    try {
                        const suggestions = await pixivService.getAutocompleteSuggestions(focusedValue);
                        
                        if (suggestions.length > 0) {
                            // Translate each suggestion to English for better understanding
                            const limitedSuggestions = suggestions.slice(0, 18);
                            
                            for (const keyword of limitedSuggestions) {
                                // Skip if same as user input
                                if (keyword.toLowerCase() === focusedValue.toLowerCase()) {
                                    continue;
                                }

                                try {
                                    const englishTranslation = await pixivService.translateToEnglish(keyword);
                                    if (englishTranslation && englishTranslation !== keyword) {
                                        // Show as "巫女 (shrine maiden)" but value is just "巫女"
                                        choices.push({
                                            name: `${keyword} (${englishTranslation})`.slice(0, 100),
                                            value: keyword.slice(0, 100)
                                        });
                                    } else {
                                        // Translation failed or same - just show keyword
                                        choices.push({
                                            name: keyword.slice(0, 100),
                                            value: keyword.slice(0, 100)
                                        });
                                    }
                                } catch {
                                    // Translation error - just show keyword
                                    choices.push({
                                        name: keyword.slice(0, 100),
                                        value: keyword.slice(0, 100)
                                    });
                                }
                            }
                        }
                    } catch {}
                }

                return choices.slice(0, 25);
            })();

            const choices = await Promise.race([searchPromise, timeoutPromise]);

            // Cache results
            pixivCache.setSearchSuggestions(focusedValue, choices);
            
            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            console.log('[Pixiv Autocomplete] Error, responding with user input');
            const focusedValue = interaction.options.getFocused() || '';
            await interaction.respond([
                { name: `🔍 "${focusedValue.slice(0, 90)}"`, value: focusedValue.slice(0, 100) || 'search' }
            ]).catch(() => {});
        }
    },

    async execute(interaction) {
        const accessCheck = await checkAccess(interaction, AccessType.SUB);
        if (accessCheck.blocked) {
            return interaction.reply({ embeds: [accessCheck.embed], ephemeral: true });
        }

        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const contentType = interaction.options.getString('type') || 'illust';
        const sortMode = interaction.options.getString('sort') || 'popular_desc';
        const nsfwMode = interaction.options.getString('nsfw') || 'sfw'; // 'sfw', 'all', 'r18only'
        const aiFilter = interaction.options.getBoolean('ai_filter') ?? false; // Changed default to false (show AI)
        const qualityFilter = interaction.options.getBoolean('quality_filter') ?? false;
        const shouldTranslate = interaction.options.getBoolean('translate') || false;
        const page = interaction.options.getInteger('page') || 1;
        const minBookmarks = interaction.options.getInteger('min_bookmarks') || 0;

        // Determine NSFW settings
        const showNsfw = nsfwMode !== 'sfw'; // true for 'all' or 'r18only'
        const r18Only = nsfwMode === 'r18only';

        // Check if query is an artwork ID (all digits)
        const isArtworkId = /^\d+$/.test(query.trim());

        if (isArtworkId) {
            // Direct artwork lookup
            const modeText = '🔍 Artwork ID Lookup';
            await interaction.editReply({ content: `${modeText}: ${query}` }).catch(() => {});

            try {
                const artwork = await pixivService.getArtworkById(query.trim());
                
                if (!artwork) {
                    return interaction.editReply({ 
                        content: `❌ Artwork with ID **${query}** not found.` 
                    });
                }

                const cacheKey = `${interaction.user.id}-${interaction.id}`;
                
                pixivCache.setResults(cacheKey, {
                    items: [artwork],
                    query: query,
                    originalQuery: query,
                    contentType: artwork.type || 'illust',
                    showNsfw: true,
                    r18Only: false,
                    aiFilter: false,
                    qualityFilter: false,
                    minBookmarks: 0,
                    shouldTranslate: false,
                    sortMode: 'popular_desc',
                    page: 1,
                    hasNextPage: false,
                    currentResultIndex: 0,
                    currentPageIndex: 0
                });

                const { embed, rows } = await contentHandler.createContentEmbed(artwork, {
                    resultIndex: 0,
                    totalResults: 1,
                    searchPage: 1,
                    cacheKey,
                    contentType: artwork.type || 'illust',
                    hasNextPage: false,
                    shouldTranslate: false,
                    originalQuery: query,
                    translatedQuery: query,
                    mangaPageIndex: 0,
                    sortMode: 'popular_desc',
                    showNsfw: true
                });

                return interaction.editReply({ content: null, embeds: [embed], components: rows });

            } catch (error) {
                console.error('[Pixiv ID Lookup Error]', error);
                return interaction.editReply({ 
                    content: `❌ Failed to fetch artwork **${query}**: ${error.message}` 
                });
            }
        }

        // Regular search
        const modeText = nsfwMode === 'sfw' ? '✅ SFW Mode' : nsfwMode === 'r18only' ? '🔥 R18 Only' : '🔞 All Content';
        await interaction.editReply({ 
            content: `🔍 Searching Pixiv... (${modeText})` 
        }).catch(() => {});

        let translatedQuery = query;
        if (shouldTranslate) {
            translatedQuery = await pixivService.translateToJapanese(query);
        }

        try {
            const offset = (page - 1) * 30;
            let result;

            const searchOptions = {
                offset,
                contentType,
                showNsfw,
                r18Only,
                aiFilter,
                qualityFilter,
                minBookmarks,
                sort: sortMode // Pass sort mode
            };

            // Check if it's a ranking mode
            const isRankingMode = ['day', 'week', 'month'].includes(sortMode);

            if (isRankingMode) {
                result = await pixivService.getRanking({
                    mode: sortMode,
                    contentType,
                    showNsfw,
                    r18Only,
                    aiFilter,
                    offset,
                    qualityFilter,
                    minBookmarks
                });

                // Filter by query if provided
                if (translatedQuery?.trim()) {
                    result.items = result.items.filter(item =>
                        item.title.toLowerCase().includes(translatedQuery.toLowerCase()) ||
                        item.tags.some(tag => tag.name.toLowerCase().includes(translatedQuery.toLowerCase())) ||
                        item.user.name.toLowerCase().includes(translatedQuery.toLowerCase())
                    );
                }
            } else {
                result = await pixivService.search(translatedQuery, searchOptions);
            }

            if (!result.items || result.items.length === 0) {
                const embed = contentHandler.createNoResultsEmbed(query, translatedQuery, shouldTranslate, contentType);
                
                if (showNsfw) {
                    embed.addFields({
                        name: '💡 Tip',
                        value: 'Try adding "R-18" to your search, e.g., `R-18 巫女`\nOr use the artwork ID directly if you know it.',
                        inline: false
                    });
                }
                
                return interaction.editReply({ content: null, embeds: [embed] });
            }

            // Calculate stats
            const r18Count = result.items.filter(item => item.x_restrict > 0).length;
            const sfwCount = result.items.filter(item => item.x_restrict === 0).length;
            const aiCount = result.items.filter(item => item.illust_ai_type === 2).length;
            
            // Create summary text
            let summaryText;
            if (r18Only) {
                summaryText = `🔥 Found **${r18Count}** R18 results`;
            } else if (showNsfw) {
                summaryText = `🔞 Found **${result.items.length}** results (**${r18Count}** R18, **${sfwCount}** SFW)`;
            } else {
                summaryText = `✅ Found **${sfwCount}** SFW results`;
            }
            
            if (aiCount > 0) {
                summaryText += ` | 🤖 ${aiCount} AI`;
            }

            console.log(`[Pixiv] ${summaryText} for "${translatedQuery}" | Mode: ${nsfwMode}`);

            const cacheKey = `${interaction.user.id}-${interaction.id}`;

            // Store all search parameters for page navigation
            pixivCache.setResults(cacheKey, {
                items: result.items,
                query: translatedQuery,
                originalQuery: query,
                contentType,
                showNsfw,
                r18Only,
                aiFilter,
                qualityFilter,
                minBookmarks,
                shouldTranslate,
                sortMode,
                page,
                hasNextPage: !!result.nextUrl,
                currentResultIndex: 0,
                currentPageIndex: 0,
                stats: { r18Count, sfwCount, aiCount, total: result.items.length }
            });

            const { embed, rows } = await contentHandler.createContentEmbed(result.items[0], {
                resultIndex: 0,
                totalResults: result.items.length,
                searchPage: page,
                cacheKey,
                contentType,
                hasNextPage: !!result.nextUrl,
                shouldTranslate,
                originalQuery: query,
                translatedQuery,
                mangaPageIndex: 0,
                sortMode,
                showNsfw,
                stats: { r18Count, sfwCount, aiCount }
            });

            // Add summary to embed description or as a field
            embed.setAuthor({ 
                name: summaryText.replace(/\*\*/g, ''), 
                iconURL: 'https://s.pximg.net/common/images/apple-touch-icon.png' 
            });

            return interaction.editReply({ content: null, embeds: [embed], components: rows });

        } catch (error) {
            console.error('[Pixiv Command Error]', error);
            const embed = contentHandler.createErrorEmbed(error);
            return interaction.editReply({ content: null, embeds: [embed] }).catch(() => {});
        }
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const cacheKey = parts.slice(2).join('_');

        const cached = pixivCache.getResults(cacheKey);

        if (!cached) {
            return interaction.reply({
                content: '⏱️ This search has expired. Please run the command again.',
                ephemeral: true
            });
        }

        if (action === 'counter' || action === 'pagecounter' || action === 'searchpageinfo') {
            return interaction.deferUpdate();
        }

        await interaction.deferUpdate();

        const { items, query, originalQuery, contentType, page, shouldTranslate, sortMode, showNsfw, aiFilter, qualityFilter, minBookmarks } = cached;
        
        // Get current indices from cache
        let currentResultIndex = cached.currentResultIndex || 0;
        let currentPageIndex = cached.currentPageIndex || 0;

        const currentItem = items[currentResultIndex];
        const totalPages = currentItem?.page_count || 1;

        switch (action) {
            case 'prev':
                // Previous result
                currentResultIndex = (currentResultIndex - 1 + items.length) % items.length;
                currentPageIndex = 0;
                break;
            case 'next':
                // Next result
                currentResultIndex = (currentResultIndex + 1) % items.length;
                currentPageIndex = 0;
                break;
            case 'pagedown':
                // Previous manga/multi-image page
                currentPageIndex = Math.max(0, currentPageIndex - 1);
                break;
            case 'pageup':
                // Next manga/multi-image page
                currentPageIndex = Math.min(totalPages - 1, currentPageIndex + 1);
                break;
            case 'searchprev':
                // Previous search page - fetch new results
                return await this._handleSearchPageNav(interaction, cached, cacheKey, -1);
            case 'searchnext':
                // Next search page - fetch new results
                return await this._handleSearchPageNav(interaction, cached, cacheKey, 1);
        }

        // Update cache with new indices
        cached.currentResultIndex = currentResultIndex;
        cached.currentPageIndex = currentPageIndex;
        pixivCache.setResults(cacheKey, cached);

        try {
            const { embed, rows } = await contentHandler.createContentEmbed(items[currentResultIndex], {
                resultIndex: currentResultIndex,
                totalResults: items.length,
                searchPage: page,
                cacheKey,
                contentType,
                hasNextPage: cached.hasNextPage,
                shouldTranslate,
                originalQuery,
                translatedQuery: query,
                mangaPageIndex: currentPageIndex,
                sortMode: sortMode || 'popular',
                showNsfw
            });

            return interaction.editReply({ embeds: [embed], components: rows });
        } catch (error) {
            console.error('[Pixiv Button Error]', error);
            return interaction.followUp({ content: '❌ Failed to navigate. Please try again.', ephemeral: true });
        }
    },

    async _handleSearchPageNav(interaction, cached, cacheKey, direction) {
        const newPage = cached.page + direction;
        
        if (newPage < 1) {
            return interaction.followUp({ content: '❌ Already on the first page!', ephemeral: true });
        }

        try {
            // IMPORTANT: Calculate correct offset for new page
            // Each page = 30 items, but we fetch multiple pages per search
            // For R18/NSFW mode we fetch 3 pages (90 items), so offset needs to account for that
            const itemsPerSearch = (cached.showNsfw) ? 90 : 30;
            const offset = (newPage - 1) * itemsPerSearch;
            
            console.log(`[Pixiv Nav] Page ${cached.page} -> ${newPage} | Offset: ${offset}`);

            const searchOptions = {
                offset,
                contentType: cached.contentType,
                showNsfw: cached.showNsfw,
                r18Only: cached.r18Only,
                aiFilter: cached.aiFilter,
                qualityFilter: cached.qualityFilter,
                minBookmarks: cached.minBookmarks,
                sort: cached.sortMode,
                fetchMultiple: true
            };

            let result;
            const isRankingMode = ['day', 'week', 'month'].includes(cached.sortMode);

            if (isRankingMode) {
                result = await pixivService.getRanking({
                    mode: cached.sortMode,
                    contentType: cached.contentType,
                    showNsfw: cached.showNsfw,
                    r18Only: cached.r18Only,
                    aiFilter: cached.aiFilter,
                    offset,
                    qualityFilter: cached.qualityFilter,
                    minBookmarks: cached.minBookmarks
                });

                if (cached.query?.trim()) {
                    result.items = result.items.filter(item =>
                        item.title.toLowerCase().includes(cached.query.toLowerCase()) ||
                        item.tags.some(tag => tag.name.toLowerCase().includes(cached.query.toLowerCase())) ||
                        item.user.name.toLowerCase().includes(cached.query.toLowerCase())
                    );
                }
            } else {
                result = await pixivService.search(cached.query, searchOptions);
            }

            if (!result.items || result.items.length === 0) {
                return interaction.followUp({ content: '❌ No more results available!', ephemeral: true });
            }

            // Calculate new stats
            const r18Count = result.items.filter(item => item.x_restrict > 0).length;
            const sfwCount = result.items.filter(item => item.x_restrict === 0).length;
            const aiCount = result.items.filter(item => item.illust_ai_type === 2).length;

            console.log(`[Pixiv Nav] New page has ${result.items.length} items (${r18Count} R18, ${sfwCount} SFW)`);

            // Update cache with new results
            cached.items = result.items;
            cached.page = newPage;
            cached.hasNextPage = !!result.nextUrl;
            cached.currentResultIndex = 0;
            cached.currentPageIndex = 0;
            cached.stats = { r18Count, sfwCount, aiCount, total: result.items.length };
            pixivCache.setResults(cacheKey, cached);

            const { embed, rows } = await contentHandler.createContentEmbed(result.items[0], {
                resultIndex: 0,
                totalResults: result.items.length,
                searchPage: newPage,
                cacheKey,
                contentType: cached.contentType,
                hasNextPage: !!result.nextUrl,
                shouldTranslate: cached.shouldTranslate,
                originalQuery: cached.originalQuery,
                translatedQuery: cached.query,
                mangaPageIndex: 0,
                sortMode: cached.sortMode || 'popular_desc',
                showNsfw: cached.showNsfw,
                stats: { r18Count, sfwCount, aiCount }
            });

            // Add summary to embed
            let summaryText;
            if (cached.r18Only) {
                summaryText = `🔥 Page ${newPage} - ${r18Count} R18 results`;
            } else if (cached.showNsfw) {
                summaryText = `🔞 Page ${newPage} - ${result.items.length} results (${r18Count} R18, ${sfwCount} SFW)`;
            } else {
                summaryText = `✅ Page ${newPage} - ${sfwCount} SFW results`;
            }
            if (aiCount > 0) {
                summaryText += ` | 🤖 ${aiCount} AI`;
            }

            embed.setAuthor({ 
                name: summaryText, 
                iconURL: 'https://s.pximg.net/common/images/apple-touch-icon.png' 
            });

            return interaction.editReply({ embeds: [embed], components: rows });
        } catch (error) {
            console.error('[Pixiv Search Page Nav Error]', error);
            return interaction.followUp({ content: '❌ Failed to load page. Please try again.', ephemeral: true });
        }
    }
};