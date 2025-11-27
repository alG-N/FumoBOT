const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { maintenance, developerID } = require("../../../MainCommand/Maintenace/MaintenaceConfig.js");
const { isBanned } = require("../../../MainCommand/Banned/BanUtils.js");

const fetch = require('node-fetch');
require('dotenv').config({ path: __dirname + '/.env' });

const PIXIV_REFRESH_TOKEN = process.env.PIXIV_REFRESH_TOKEN;

let pixivAuth = {
    access_token: null,
    refresh_token: PIXIV_REFRESH_TOKEN,
    expires_at: 0
};

const searchCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const resultCache = new Map();
const RESULT_CACHE_DURATION = 30 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of resultCache.entries()) {
        if (now - value.timestamp > RESULT_CACHE_DURATION) {
            resultCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

async function authenticatePixiv() {
    if (pixivAuth.access_token && Date.now() < pixivAuth.expires_at) {
        return pixivAuth.access_token;
    }

    try {
        const response = await fetch('https://oauth.secure.pixiv.net/auth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)',
            },
            body: new URLSearchParams({
                client_id: 'MOBrBDS8blbauoSck0ZfDbtuzpyT',
                client_secret: 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj',
                grant_type: 'refresh_token',
                refresh_token: pixivAuth.refresh_token,
                include_policy: 'true',
            }),
        });

        const data = await response.json();

        if (data.access_token) {
            pixivAuth.access_token = data.access_token;
            pixivAuth.refresh_token = data.refresh_token;
            pixivAuth.expires_at = Date.now() + (data.expires_in * 1000);
            return data.access_token;
        }

        throw new Error('Failed to authenticate with Pixiv');
    } catch (error) {
        console.error('[Pixiv Auth Error]', error);
        throw error;
    }
}

async function searchPixiv(query, offset = 0, contentType = 'illust', nsfwFilter = true, aiFilter = true) {
    const token = await authenticatePixiv();

    let url;
    if (contentType === 'novel') {
        url = new URL('https://app-api.pixiv.net/v1/search/novel');
    } else {
        url = new URL('https://app-api.pixiv.net/v1/search/illust');
    }

    url.searchParams.append('word', query);
    url.searchParams.append('search_target', 'partial_match_for_tags');
    url.searchParams.append('sort', 'popular_desc');
    url.searchParams.append('offset', offset);
    url.searchParams.append('filter', 'for_android');

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)',
            'App-OS': 'android',
            'App-OS-Version': '11',
            'App-Version': '5.0.234',
        },
    });

    if (!response.ok) {
        throw new Error(`Pixiv API error: ${response.status}`);
    }

    const data = await response.json();

    if (contentType === 'novel') {
        if (data.novels) {
            if (nsfwFilter) {
                data.novels = data.novels.filter(item => item.x_restrict === 0);
            }
            if (aiFilter) {
                data.novels = data.novels.filter(item => item.illust_ai_type !== 2);
            }
        }
    } else {
        if (data.illusts) {
            if (nsfwFilter) {
                data.illusts = data.illusts.filter(item => item.x_restrict === 0);
            }
            if (aiFilter) {
                data.illusts = data.illusts.filter(item => item.illust_ai_type !== 2);
            }
            if (contentType === 'manga') {
                data.illusts = data.illusts.filter(item => item.type === 'manga');
            } else if (contentType === 'illust') {
                data.illusts = data.illusts.filter(item => item.type === 'illust' || item.type === 'ugoira');
            }
        }
    }

    return data;
}

async function getPixivRanking(mode = 'day', contentType = 'illust', nsfwFilter = true, aiFilter = true, offset = 0) {
    const token = await authenticatePixiv();

    const url = new URL('https://app-api.pixiv.net/v1/illust/ranking');

    let rankingMode = mode;

    if (!nsfwFilter) {
        if (mode === 'day') rankingMode = 'day_r18';
        else if (mode === 'week') rankingMode = 'week_r18';
    }

    url.searchParams.append('mode', rankingMode);
    url.searchParams.append('filter', 'for_android');
    url.searchParams.append('offset', offset);

    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)',
            'App-OS': 'android',
            'App-OS-Version': '11',
            'App-Version': '5.0.234',
        },
    });

    if (!response.ok) {
        throw new Error(`Pixiv API error: ${response.status}`);
    }

    const data = await response.json();

    if (aiFilter && data.illusts) {
        data.illusts = data.illusts.filter(item => item.illust_ai_type !== 2);
    }

    if (contentType === 'manga' && data.illusts) {
        data.illusts = data.illusts.filter(item => item.type === 'manga');
    } else if (contentType === 'illust' && data.illusts) {
        data.illusts = data.illusts.filter(item => item.type === 'illust' || item.type === 'ugoira');
    }

    return data;
}

function isEnglishText(text) {
    const asciiLetters = text.match(/[a-zA-Z]/g);
    return asciiLetters && asciiLetters.length / text.length > 0.5;
}

async function getAutocompleteSuggestions(query) {
    try {
        const url = `https://www.pixiv.net/rpc/cps.php?keyword=${encodeURIComponent(query)}`;

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Referer": "https://www.pixiv.net/",
                "Accept": "application/json, text/javascript, */*; q=0.01"
            }
        });

        if (!res.ok) {
            console.log("Pixiv returned status:", res.status);
            return [];
        }

        const data = await res.json();

        if (!data || !data.candidates) {
            console.log("Pixiv returned empty response:", data);
            return [];
        }

        // console.log("Pixiv autocomplete result:", data);
        // console.log("Pixiv candidates:", data.candidates);

        return data.candidates.map(tag => tag.tag_name).filter(Boolean);

    } catch (err) {
        console.error("Autocomplete API failed:", err);
        return [];
    }
}

async function translateToJapanese(text) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        return data[0][0][0];
    } catch (error) {
        console.error('Translation error:', error);
        return text;
    }
}

async function translateToEnglish(text) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        return data[0][0][0];
    } catch (error) {
        console.error('Translation error:', error);
        return null;
    }
}

async function getProxyImageUrl(item, mangaPageIndex = 0) {
    let imageUrl;

    if (item.page_count > 1 && item.meta_pages && item.meta_pages.length > mangaPageIndex) {
        const page = item.meta_pages[mangaPageIndex].image_urls;
        imageUrl = page.large || page.medium || page.square_medium || page.original;
    } else {
        imageUrl = item.image_urls.large ||
            item.image_urls.medium ||
            item.image_urls.square_medium;
    }

    const proxyUrl = imageUrl.replace('i.pximg.net', 'i.pixiv.re');
    return proxyUrl;
}

async function createContentEmbed(item, resultIndex, totalResults, searchPage, cacheKey, contentType, hasNextPage, shouldTranslate, originalQuery, translatedQuery, mangaPageIndex = 0, sortMode = 'popular') {
    const embed = new EmbedBuilder().setColor('#0096FA');
    const rows = [];

    const sortModeText = {
        'popular': '🔥 Popular',
        'day': '📅 Daily',
        'week': '📊 Weekly',
        'month': '📈 Monthly'
    }[sortMode] || '🔥 Popular';

    const isNSFW = item.x_restrict > 0;
    const nsfwStatus = isNSFW ? '🔞 Yes' : '✅ No';
    const isAI = item.illust_ai_type === 2;
    const aiStatus = isAI ? '🤖 Yes' : '✅ No';

    if (contentType === 'novel') {
        const textPreview = item.text.substring(0, 400) + (item.text.length > 400 ? '...' : '');

        embed
            .setTitle(item.title)
            .setURL(`https://www.pixiv.net/novel/show.php?id=${item.id}`)
            .setDescription(`**Author:** ${item.user.name}\n**NSFW:** ${nsfwStatus}\n**AI-Generated:** ${aiStatus}\n**Views:** ${item.total_view.toLocaleString()}\n**Bookmarks:** ${item.total_bookmarks.toLocaleString()}\n\n**Preview:**\n${textPreview}`)
            .addFields(
                {
                    name: '🏷️ Tags',
                    value: item.tags.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                    inline: false
                },
                {
                    name: '📊 Stats',
                    value: `📝 ${item.text_length.toLocaleString()} characters\n${item.is_bookmarked ? '⭐ Bookmarked' : ''}`,
                    inline: true
                }
            )
            .setFooter({
                text: `${sortModeText} • Page ${searchPage} • Novel ${resultIndex + 1}/${totalResults} • ID: ${item.id}${shouldTranslate ? ` • From "${originalQuery}"` : ''}`
            })
            .setTimestamp(new Date(item.create_date));

        if (item.image_urls && item.image_urls.large) {
            try {
                const proxyImageUrl = await getProxyImageUrl(item, 0);
                embed.setThumbnail(proxyImageUrl);
            } catch (err) {
                console.error('Failed to set thumbnail:', err);
            }
        }
    } else {
        try {
            const proxyImageUrl = await getProxyImageUrl(item, mangaPageIndex);

            const typeEmoji = item.type === 'manga' ? '📚' : item.type === 'ugoira' ? '🎬' : '🎨';
            const typeText = item.type === 'manga' ? 'Manga' : item.type === 'ugoira' ? 'Animated' : 'Illustration';

            embed
                .setTitle(item.title)
                .setURL(`https://www.pixiv.net/artworks/${item.id}`)
                .setDescription(`**Artist:** ${item.user.name}\n**Type:** ${typeEmoji} ${typeText}${item.page_count > 1 ? ` (${item.page_count} pages)` : ''}\n**NSFW:** ${nsfwStatus}\n**AI-Generated:** ${aiStatus}\n**Views:** ${item.total_view.toLocaleString()}\n**Bookmarks:** ${item.total_bookmarks.toLocaleString()}`)
                .setImage(proxyImageUrl)
                .addFields(
                    {
                        name: '🏷️ Tags',
                        value: item.tags.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                        inline: false
                    }
                )
                .setFooter({
                    text: `${sortModeText} • Page ${searchPage} • Result ${resultIndex + 1}/${totalResults}${item.page_count > 1 ? ` • Page ${mangaPageIndex + 1}/${item.page_count}` : ''} • ID: ${item.id}${shouldTranslate ? ` • From "${originalQuery}"` : ''}`
                })
                .setTimestamp(new Date(item.create_date));
        } catch (err) {
            console.error('Failed to load image:', err);
            const typeEmoji = item.type === 'manga' ? '📚' : item.type === 'ugoira' ? '🎬' : '🎨';
            const typeText = item.type === 'manga' ? 'Manga' : item.type === 'ugoira' ? 'Animated' : 'Illustration';

            embed
                .setTitle(item.title)
                .setURL(`https://www.pixiv.net/artworks/${item.id}`)
                .setDescription(`**Artist:** ${item.user.name}\n**Type:** ${typeEmoji} ${typeText}\n⚠️ *Image failed to load - click link to view*\n**NSFW:** ${nsfwStatus}\n**AI-Generated:** ${aiStatus}`)
                .addFields(
                    {
                        name: '🏷️ Tags',
                        value: item.tags.slice(0, 10).map(t => `\`${t.name}\``).join(' ') || 'None',
                        inline: false
                    }
                )
                .setFooter({
                    text: `${sortModeText} • Page ${searchPage} • Result ${resultIndex + 1}/${totalResults} • ID: ${item.id}`
                })
                .setTimestamp(new Date(item.create_date));
        }
    }

    const resultNavRow = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('◀ Prev Result')
                .setCustomId(`pixiv_prev_${cacheKey}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false),
            new ButtonBuilder()
                .setLabel(`${resultIndex + 1}/${totalResults}`)
                .setCustomId(`pixiv_counter_${cacheKey}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setLabel('Next Result ▶')
                .setCustomId(`pixiv_next_${cacheKey}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false),
            new ButtonBuilder()
                .setLabel('View on Pixiv')
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗')
                .setURL(contentType === 'novel'
                    ? `https://www.pixiv.net/novel/show.php?id=${item.id}`
                    : `https://www.pixiv.net/artworks/${item.id}`)
        );

    rows.push(resultNavRow);

    if (contentType !== 'novel' && item.page_count > 1) {
        const pageNavRow = new ActionRowBuilder()
            .addComponents(
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
            if (!interaction.isAutocomplete()) return;

            const focused = interaction.options.getFocused(true);

            // Only run autocomplete for the 'query' option
            if (focused.name !== "query") {
                return interaction.respond([]);
            }

            const focusedValue = focused.value;

            // If empty input, show helpful message
            if (!focusedValue || focusedValue.trim() === '') {
                return interaction.respond([
                    { name: '💡 Type in English or Japanese...', value: ' ' }
                ]);
            }

            const cacheKey = focusedValue.toLowerCase();
            const cached = searchCache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return interaction.respond(cached.results);
            }

            let choices = [];
            const isEnglish = isEnglishText(focusedValue);

            // If English input, translate to Japanese and search
            if (isEnglish) {
                try {
                    const translated = await translateToJapanese(focusedValue);
                    // console.log(`Translated "${focusedValue}" → "${translated}"`);

                    // Search with translated term
                    const suggestions = await getAutocompleteSuggestions(translated);

                    if (suggestions && suggestions.length > 0) {
                        // Translate each Japanese tag to English
                        const translationPromises = suggestions.slice(0, 23).map(async (keyword) => {
                            const englishTranslation = await translateToEnglish(keyword);
                            const displayName = englishTranslation
                                ? `${keyword} - ${englishTranslation}`
                                : keyword;

                            return {
                                name: displayName.length > 100 ? displayName.slice(0, 97) + "..." : displayName,
                                value: keyword.slice(0, 100)
                            };
                        });

                        choices = await Promise.all(translationPromises);
                    }

                    // Add the translated term as an option
                    const englishBack = await translateToEnglish(translated);
                    choices.unshift({
                        name: `🌐 ${translated}${englishBack ? ` - ${englishBack}` : ''}`,
                        value: translated.slice(0, 100)
                    });
                } catch (err) {
                    console.error("Translation failed:", err);
                }
            } else {
                // Japanese input - search directly and translate to English
                const suggestions = await getAutocompleteSuggestions(focusedValue);

                if (suggestions && suggestions.length > 0) {
                    const translationPromises = suggestions.slice(0, 24).map(async (keyword) => {
                        const englishTranslation = await translateToEnglish(keyword);
                        const displayName = englishTranslation
                            ? `${keyword} - ${englishTranslation}`
                            : keyword;

                        return {
                            name: displayName.length > 100 ? displayName.slice(0, 97) + "..." : displayName,
                            value: keyword.slice(0, 100)
                        };
                    });

                    choices = await Promise.all(translationPromises);
                }
            }

            // Always add the user's original input as a search option
            const userInput = focusedValue.slice(0, 100);
            choices.unshift({
                name: `🔍 Search: "${focusedValue.length > 85 ? focusedValue.slice(0, 82) + "..." : focusedValue}"`,
                value: userInput
            });

            // Limit to 25 total choices (Discord's limit)
            choices = choices.slice(0, 25);

            searchCache.set(cacheKey, {
                results: choices,
                timestamp: Date.now()
            });

            return interaction.respond(choices);

        } catch (err) {
            console.error("[Pixiv Autocomplete Error]", err);

            try {
                const focused = interaction.options.getFocused(true);
                const fallbackValue = focused.value.slice(0, 100);
                return interaction.respond([
                    {
                        name: `🔍 Search: "${focused.value.slice(0, 90)}"`,
                        value: fallbackValue || 'error'
                    }
                ]);
            } catch (secondaryErr) {
                console.error("[Pixiv Autocomplete Secondary Error]", secondaryErr);
                return interaction.respond([]);
            }
        }
    },

    async execute(interaction) {
        const banData = await isBanned(interaction.user.id);

        if ((maintenance === "yes" && interaction.user.id !== developerID) || banData) {
            let description = '';
            let footerText = '';

            if (maintenance === "yes" && interaction.user.id !== developerID) {
                description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
                footerText = "Thank you for your patience";
            } else if (banData) {
                description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

                if (banData.expiresAt) {
                    const remaining = banData.expiresAt - Date.now();
                    const seconds = Math.floor((remaining / 1000) % 60);
                    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

                    const timeString = [
                        days ? `${days}d` : '',
                        hours ? `${hours}h` : '',
                        minutes ? `${minutes}m` : '',
                        seconds ? `${seconds}s` : ''
                    ].filter(Boolean).join(' ');

                    description += `\n**Time Remaining:** ${timeString}`;
                } else {
                    description += `\n**Ban Type:** Permanent`;
                }

                footerText = "Ban enforced by developer";
            }

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle(maintenance === "yes" ? '🚧 Maintenance Mode' : '⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: footerText })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        await interaction.deferReply();

        let query = interaction.options.getString('query');
        const contentType = interaction.options.getString('type') || 'illust';
        const sortMode = interaction.options.getString('sort') || 'popular';
        const nsfwFilter = interaction.options.getBoolean('nsfw_filter') ?? true;
        const aiFilter = interaction.options.getBoolean('ai_filter') ?? true;
        const shouldTranslate = interaction.options.getBoolean('translate') || false;
        const page = interaction.options.getInteger('page') || 1;

        let translatedQuery = query;
        if (shouldTranslate) {
            translatedQuery = await translateToJapanese(query);
        }

        try {
            const offset = (page - 1) * 30;
            let results;
            let items;

            if (sortMode !== 'popular') {
                if (contentType === 'novel') {
                    results = await searchPixiv(translatedQuery, offset, contentType, nsfwFilter, aiFilter);
                    items = results.novels;
                } else {
                    results = await getPixivRanking(sortMode, contentType, nsfwFilter, aiFilter, offset);
                    items = results.illusts;

                    if (query && query.trim() !== '') {
                        items = items.filter(item =>
                            item.title.toLowerCase().includes(translatedQuery.toLowerCase()) ||
                            item.tags.some(tag => tag.name.toLowerCase().includes(translatedQuery.toLowerCase())) ||
                            item.user.name.toLowerCase().includes(translatedQuery.toLowerCase())
                        );
                    }
                }
            } else {
                results = await searchPixiv(translatedQuery, offset, contentType, nsfwFilter, aiFilter);
                items = contentType === 'novel' ? results.novels : results.illusts;
            }

            if (!items || items.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('❌ No Results Found')
                    .setDescription(`No ${contentType === 'novel' ? 'novels' : 'artwork'} found for: **${translatedQuery}**${shouldTranslate ? `\n(Translated from: "${query}")` : ''}`)
                    .setFooter({ text: 'Try a different search term or adjust filters' })
                    .setTimestamp();

                return interaction.editReply({ embeds: [noResultsEmbed] });
            }

            const cacheKey = `${interaction.user.id}-${interaction.id}`;

            resultCache.set(cacheKey, {
                items,
                query: translatedQuery,
                originalQuery: query,
                contentType,
                nsfwFilter,
                aiFilter,
                shouldTranslate,
                sortMode,
                page,
                hasNextPage: !!results.next_url,
                timestamp: Date.now()
            });

            const { embed, rows } = await createContentEmbed(
                items[0],
                0,
                items.length,
                page,
                cacheKey,
                contentType,
                results.next_url,
                shouldTranslate,
                query,
                translatedQuery,
                0,
                sortMode
            );

            return interaction.editReply({ embeds: [embed], components: rows });

        } catch (error) {
            console.error('[Pixiv Command Error]', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Error')
                .setDescription('Failed to fetch content from Pixiv. Please try again later.')
                .addFields({
                    name: 'Error Details',
                    value: `\`\`\`${error.message}\`\`\``
                })
                .setFooter({ text: 'If this persists, contact the developer' })
                .setTimestamp();

            return interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    async handleButton(interaction) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const cacheKey = parts.slice(2).join('_');

        const cached = resultCache.get(cacheKey);

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
        const footerText = currentEmbed.footer.text;

        const resultMatch = footerText.match(/Result (\d+)\/(\d+)/);
        const pageMatch = footerText.match(/Page (\d+)\/(\d+)/);

        let currentResultIndex = resultMatch ? parseInt(resultMatch[1]) - 1 : 0;
        let currentPageIndex = pageMatch ? parseInt(pageMatch[1]) - 1 : 0;

        const { items, query, originalQuery, contentType, page, shouldTranslate, hasNextPage, sortMode } = cached;
        const currentItem = items[currentResultIndex];
        const totalPages = currentItem.page_count || 1;

        if (action === 'result' || action === 'prev') {
            currentResultIndex = (currentResultIndex - 1 + items.length) % items.length;
            currentPageIndex = 0;
        } else if (action === 'next') {
            currentResultIndex = (currentResultIndex + 1) % items.length;
            currentPageIndex = 0;
        } else if (action === 'pagedown') {
            currentPageIndex = Math.max(0, currentPageIndex - 1);
        } else if (action === 'pageup') {
            currentPageIndex = Math.min(totalPages - 1, currentPageIndex + 1);
        }

        const { embed, rows } = await createContentEmbed(
            items[currentResultIndex],
            currentResultIndex,
            items.length,
            page,
            cacheKey,
            contentType,
            hasNextPage,
            shouldTranslate,
            originalQuery,
            query,
            currentPageIndex,
            sortMode || 'popular'
        );

        return interaction.editReply({ embeds: [embed], components: rows });
    }
};