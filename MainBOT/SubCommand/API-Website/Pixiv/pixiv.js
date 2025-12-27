const { SlashCommandBuilder } = require('discord.js');
const { checkAccess } = require('../shared/middleware/checkAccess');
const pixivService = require('./services/pixivService');
const pixivCache = require('./repositories/pixivCache');
const contentHandler = require('./handlers/contentHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pixiv')
        .setDescription('Search for artwork, manga, or novels on Pixiv')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search for content by tag or keyword')
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
                .setDescription('Sort results by popularity period')
                .setRequired(false)
                .addChoices(
                    { name: '🔥 Popular (Default)', value: 'popular' },
                    { name: '📅 Daily Ranking', value: 'day' },
                    { name: '📊 Weekly Ranking', value: 'week' },
                    { name: '📈 Monthly Ranking', value: 'month' }
                )
        )
        .addBooleanOption(option =>
            option.setName('nsfw_filter')
                .setDescription('Filter NSFW content (ON = hide R18, OFF = show R18)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('ai_filter')
                .setDescription('Filter AI-generated content (ON = hide AI, OFF = show AI)')
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
                .setMaxValue(10)
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused(true);

            if (focused.name !== 'query') {
                return interaction.respond([]).catch(() => {});
            }

            const focusedValue = focused.value;

            if (!focusedValue?.trim() || focusedValue.length < 2) {
                return interaction.respond([
                    { name: '💡 Type at least 2 characters...', value: ' ' }
                ]).catch(() => {});
            }

            // Check cache first
            const cached = pixivCache.getSearchSuggestions(focusedValue);
            if (cached) {
                return interaction.respond(cached).catch(() => {});
            }

            // Set a strict timeout - must respond within 3 seconds
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 2000)
            );

            const searchPromise = (async () => {
                let choices = [];
                const isEnglish = pixivService.isEnglishText(focusedValue);

                if (isEnglish) {
                    // Simplified flow for English - just translate and search
                    const translated = await pixivService.translateToJapanese(focusedValue);
                    const suggestions = await pixivService.getAutocompleteSuggestions(translated);

                    if (suggestions.length > 0) {
                        // Limit translations to speed up response
                        const limitedSuggestions = suggestions.slice(0, 8);
                        const translationPromises = limitedSuggestions.map(async (keyword) => {
                            try {
                                const englishTranslation = await pixivService.translateToEnglish(keyword);
                                const displayName = englishTranslation ? `${keyword} - ${englishTranslation}` : keyword;
                                return {
                                    name: displayName.slice(0, 100),
                                    value: keyword.slice(0, 100)
                                };
                            } catch {
                                return { name: keyword.slice(0, 100), value: keyword.slice(0, 100) };
                            }
                        });

                        choices = await Promise.all(translationPromises);
                    }

                    // Add translated query as first option
                    choices.unshift({
                        name: `🌐 ${translated}`.slice(0, 100),
                        value: translated.slice(0, 100)
                    });
                } else {
                    // Japanese input - just get suggestions
                    const suggestions = await pixivService.getAutocompleteSuggestions(focusedValue);

                    if (suggestions.length > 0) {
                        choices = suggestions.slice(0, 10).map(keyword => ({
                            name: keyword.slice(0, 100),
                            value: keyword.slice(0, 100)
                        }));
                    }
                }

                // Always add the user's input as an option
                choices.unshift({
                    name: `🔍 Search: "${focusedValue.slice(0, 85)}"`,
                    value: focusedValue.slice(0, 100)
                });

                return choices.slice(0, 25);
            })();

            const choices = await Promise.race([searchPromise, timeoutPromise]);

            // Cache results
            pixivCache.setSearchSuggestions(focusedValue, choices);
            
            await interaction.respond(choices).catch(() => {});
        } catch (error) {
            // Silently fail with empty response
            console.log('[Pixiv Autocomplete] Timeout or error, responding empty');
            await interaction.respond([
                { name: `🔍 Search: "${interaction.options.getFocused().slice(0, 85)}"`, value: interaction.options.getFocused().slice(0, 100) || 'search' }
            ]).catch(() => {});
        }
    },

    async execute(interaction) {
        const accessCheck = await checkAccess(interaction);
        if (accessCheck.blocked) {
            return interaction.reply({ embeds: [accessCheck.embed], ephemeral: true });
        }

        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const contentType = interaction.options.getString('type') || 'illust';
        const sortMode = interaction.options.getString('sort') || 'popular';
        const nsfwFilter = interaction.options.getBoolean('nsfw_filter') ?? true;
        const aiFilter = interaction.options.getBoolean('ai_filter') ?? true;
        const shouldTranslate = interaction.options.getBoolean('translate') || false;
        const page = interaction.options.getInteger('page') || 1;

        let translatedQuery = query;
        if (shouldTranslate) {
            translatedQuery = await pixivService.translateToJapanese(query);
        }

        try {
            const offset = (page - 1) * 30;
            let result;

            if (sortMode !== 'popular') {
                if (contentType === 'novel') {
                    result = await pixivService.search(translatedQuery, { offset, contentType, nsfwFilter, aiFilter });
                } else {
                    result = await pixivService.getRanking({ mode: sortMode, contentType, nsfwFilter, aiFilter, offset });

                    if (query?.trim()) {
                        result.items = result.items.filter(item =>
                            item.title.toLowerCase().includes(translatedQuery.toLowerCase()) ||
                            item.tags.some(tag => tag.name.toLowerCase().includes(translatedQuery.toLowerCase())) ||
                            item.user.name.toLowerCase().includes(translatedQuery.toLowerCase())
                        );
                    }
                }
            } else {
                result = await pixivService.search(translatedQuery, { offset, contentType, nsfwFilter, aiFilter });
            }

            if (!result.items || result.items.length === 0) {
                const embed = contentHandler.createNoResultsEmbed(query, translatedQuery, shouldTranslate, contentType);
                return interaction.editReply({ embeds: [embed] });
            }

            const cacheKey = `${interaction.user.id}-${interaction.id}`;

            pixivCache.setResults(cacheKey, {
                items: result.items,
                query: translatedQuery,
                originalQuery: query,
                contentType,
                nsfwFilter,
                aiFilter,
                shouldTranslate,
                sortMode,
                page,
                hasNextPage: !!result.nextUrl
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
                sortMode
            });

            return interaction.editReply({ embeds: [embed], components: rows });

        } catch (error) {
            console.error('[Pixiv Command Error]', error);
            const embed = contentHandler.createErrorEmbed(error);
            return interaction.editReply({ embeds: [embed] });
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

        if (action === 'counter' || action === 'pagecounter') {
            return interaction.deferUpdate();
        }

        await interaction.deferUpdate();

        const currentEmbed = interaction.message.embeds[0];
        const footerText = currentEmbed.footer?.text || '';

        const resultMatch = footerText.match(/Result (\d+)\/(\d+)/);
        const pageMatch = footerText.match(/Page (\d+)\/(\d+)/);

        let currentResultIndex = resultMatch ? parseInt(resultMatch[1]) - 1 : 0;
        let currentPageIndex = pageMatch ? parseInt(pageMatch[1]) - 1 : 0;

        const { items, query, originalQuery, contentType, page, shouldTranslate, hasNextPage, sortMode } = cached;
        const currentItem = items[currentResultIndex];
        const totalPages = currentItem?.page_count || 1;

        switch (action) {
            case 'prev':
                currentResultIndex = (currentResultIndex - 1 + items.length) % items.length;
                currentPageIndex = 0;
                break;
            case 'next':
                currentResultIndex = (currentResultIndex + 1) % items.length;
                currentPageIndex = 0;
                break;
            case 'pagedown':
                currentPageIndex = Math.max(0, currentPageIndex - 1);
                break;
            case 'pageup':
                currentPageIndex = Math.min(totalPages - 1, currentPageIndex + 1);
                break;
        }

        try {
            const { embed, rows } = await contentHandler.createContentEmbed(items[currentResultIndex], {
                resultIndex: currentResultIndex,
                totalResults: items.length,
                searchPage: page,
                cacheKey,
                contentType,
                hasNextPage,
                shouldTranslate,
                originalQuery,
                translatedQuery: query,
                mangaPageIndex: currentPageIndex,
                sortMode: sortMode || 'popular'
            });

            return interaction.editReply({ embeds: [embed], components: rows });
        } catch (error) {
            console.error('[Pixiv Button Error]', error);
            return interaction.followUp({ content: '❌ Failed to navigate. Please try again.', ephemeral: true });
        }
    }
};