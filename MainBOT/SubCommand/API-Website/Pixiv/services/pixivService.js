const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class PixivService {
    constructor() {
        this.auth = {
            accessToken: null,
            refreshToken: process.env.PIXIV_REFRESH_TOKEN,
            expiresAt: 0
        };
        this.clientId = 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
        this.clientSecret = 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
        this.baseHeaders = {
            'User-Agent': 'PixivAndroidApp/5.0.234 (Android 11; Pixel 5)',
            'App-OS': 'android',
            'App-OS-Version': '11',
            'App-Version': '5.0.234'
        };
        this.proxies = ['i.pixiv.cat', 'i.pixiv.nl', 'i.pximg.net'];
        this.translationCache = new Map();
    }

    async authenticate() {
        if (this.auth.accessToken && Date.now() < this.auth.expiresAt) {
            return this.auth.accessToken;
        }

        try {
            const response = await fetch('https://oauth.secure.pixiv.net/auth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': this.baseHeaders['User-Agent']
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token',
                    refresh_token: this.auth.refreshToken,
                    include_policy: 'true'
                })
            });

            const data = await response.json();

            if (!data.access_token) {
                throw new Error('Failed to authenticate with Pixiv');
            }

            this.auth.accessToken = data.access_token;
            this.auth.refreshToken = data.refresh_token;
            this.auth.expiresAt = Date.now() + (data.expires_in * 1000) - 60000;

            return data.access_token;
        } catch (error) {
            console.error('[Pixiv Auth Error]', error);
            throw error;
        }
    }

    async search(query, options = {}) {
        const {
            offset = 0,
            contentType = 'illust',
            showNsfw = false,
            r18Only = false,
            aiFilter = false,
            qualityFilter = false,
            minBookmarks = 0,
            sort = 'popular_desc' // Add sort option
        } = options;

        const token = await this.authenticate();
        const isNovel = contentType === 'novel';

        const url = new URL(isNovel
            ? 'https://app-api.pixiv.net/v1/search/novel'
            : 'https://app-api.pixiv.net/v1/search/illust'
        );

        url.searchParams.append('word', query);
        url.searchParams.append('search_target', 'partial_match_for_tags');
        url.searchParams.append('sort', sort); // Use provided sort
        url.searchParams.append('offset', offset.toString());
        
        // Don't add filter when showing NSFW - this is critical
        if (!showNsfw) {
            url.searchParams.append('filter', 'for_android');
        }

        console.log(`[Pixiv Search] Query: "${query}" | NSFW: ${showNsfw} | R18Only: ${r18Only} | Sort: ${sort} | Offset: ${offset}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...this.baseHeaders
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Pixiv API Error] ${response.status}: ${errorText}`);
            throw new Error(`Pixiv API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Log detailed info about what we got
        const items = isNovel ? data.novels : data.illusts;
        if (items && items.length > 0) {
            const r18Count = items.filter(i => i.x_restrict > 0).length;
            const sfwCount = items.filter(i => i.x_restrict === 0).length;
            const aiCount = items.filter(i => i.illust_ai_type === 2).length;
            console.log(`[Pixiv Search] Raw: ${items.length} items | ${r18Count} R18 | ${sfwCount} SFW | ${aiCount} AI`);
            
            // Log first few items for debugging
            items.slice(0, 3).forEach((item, idx) => {
                const tags = item.tags?.slice(0, 5).map(t => t.name).join(', ') || 'no tags';
                console.log(`  [${idx}] "${item.title}" | R18: ${item.x_restrict > 0} | AI: ${item.illust_ai_type === 2} | Tags: ${tags}`);
            });
        }
        
        return this._filterResults(data, contentType, showNsfw, aiFilter, qualityFilter, minBookmarks, r18Only);
    }

    async getRanking(options = {}) {
        const {
            mode = 'day',
            contentType = 'illust',
            showNsfw = false,
            r18Only = false, // NEW
            aiFilter = false, // Changed default
            offset = 0,
            qualityFilter = false,
            minBookmarks = 0
        } = options;

        const token = await this.authenticate();

        // Use R18 ranking modes when NSFW is enabled
        let rankingMode = mode;
        if (showNsfw) {
            if (mode === 'day') rankingMode = 'day_r18';
            else if (mode === 'week') rankingMode = 'week_r18';
            else if (mode === 'month') rankingMode = 'month_r18';
        }

        const url = new URL('https://app-api.pixiv.net/v1/illust/ranking');
        url.searchParams.append('mode', rankingMode);
        url.searchParams.append('offset', offset.toString());
        
        // Don't add filter for R18 rankings
        if (!showNsfw) {
            url.searchParams.append('filter', 'for_android');
        }

        console.log(`[Pixiv Ranking] Mode: ${rankingMode}, NSFW: ${showNsfw}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...this.baseHeaders
            }
        });

        if (!response.ok) {
            throw new Error(`Pixiv API error: ${response.status}`);
        }

        const data = await response.json();
        return this._filterResults({ illusts: data.illusts, next_url: data.next_url }, contentType, showNsfw, aiFilter, qualityFilter, minBookmarks, r18Only);
    }

    _filterResults(data, contentType, showNsfw, aiFilter, qualityFilter = false, minBookmarks = 0, r18Only = false) {
        const isNovel = contentType === 'novel';
        let items = isNovel ? data.novels : data.illusts;

        if (!items) return { items: [], nextUrl: data.next_url };

        const originalCount = items.length;
        const originalR18 = items.filter(i => i.x_restrict > 0).length;
        const originalSFW = items.filter(i => i.x_restrict === 0).length;

        // NSFW Filter Logic based on x_restrict field (this is Pixiv's official NSFW flag)
        // x_restrict: 0 = SFW, 1 = R18, 2 = R18G
        if (!showNsfw) {
            // SFW only mode
            items = items.filter(item => item.x_restrict === 0);
        } else if (r18Only) {
            // R18 only mode - show only NSFW content
            items = items.filter(item => item.x_restrict > 0);
        }
        // When showNsfw = true and r18Only = false, keep ALL items

        // AI Filter - based on illust_ai_type field (Pixiv's official AI flag)
        // illust_ai_type: 0 = unknown, 1 = not AI, 2 = AI generated
        if (aiFilter) {
            const beforeAI = items.length;
            items = items.filter(item => item.illust_ai_type !== 2);
            const removed = beforeAI - items.length;
            if (removed > 0) {
                console.log(`[Pixiv Filter] AI filter removed ${removed} items`);
            }
        }

        // Quality Filter
        if (qualityFilter) {
            const beforeQuality = items.length;
            items = items.filter(item => (item.total_view || 0) >= 1000);
            const removed = beforeQuality - items.length;
            if (removed > 0) {
                console.log(`[Pixiv Filter] Quality filter removed ${removed} items`);
            }
        }

        // Minimum bookmarks filter
        if (minBookmarks > 0) {
            const beforeBookmarks = items.length;
            items = items.filter(item => (item.total_bookmarks || 0) >= minBookmarks);
            const removed = beforeBookmarks - items.length;
            if (removed > 0) {
                console.log(`[Pixiv Filter] Bookmark filter removed ${removed} items`);
            }
        }

        // Content type filter (manga vs illust)
        if (!isNovel && contentType !== 'all') {
            if (contentType === 'manga') {
                items = items.filter(item => item.type === 'manga');
            } else if (contentType === 'illust') {
                items = items.filter(item => item.type === 'illust' || item.type === 'ugoira');
            }
        }

        // Final stats
        const finalR18 = items.filter(i => i.x_restrict > 0).length;
        const finalSFW = items.filter(i => i.x_restrict === 0).length;
        console.log(`[Pixiv Filter] Result: ${items.length}/${originalCount} | R18: ${finalR18}/${originalR18} | SFW: ${finalSFW}/${originalSFW}`);

        return { items, nextUrl: data.next_url };
    }

    async getAutocompleteSuggestions(query) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000); // Increased timeout

            const url = `https://www.pixiv.net/rpc/cps.php?keyword=${encodeURIComponent(query)}&lang=en`;

            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': 'https://www.pixiv.net/',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!res.ok) return [];

            const data = await res.json();
            return data?.candidates?.map(tag => tag.tag_name).filter(Boolean) || [];
        } catch (err) {
            return [];
        }
    }

    async translateToJapanese(text) {
        // Check cache
        const cacheKey = `en_ja_${text}`;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1000);

            const response = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(text)}`,
                { signal: controller.signal }
            );

            clearTimeout(timeout);

            const data = await response.json();
            const result = data[0][0][0];
            
            // Cache the result
            this.translationCache.set(cacheKey, result);
            
            return result;
        } catch (error) {
            return text;
        }
    }

    async translateToEnglish(text) {
        // Check cache
        const cacheKey = `ja_en_${text}`;
        if (this.translationCache.has(cacheKey)) {
            return this.translationCache.get(cacheKey);
        }

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1000);

            const response = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`,
                { signal: controller.signal }
            );

            clearTimeout(timeout);

            const data = await response.json();
            const result = data[0][0][0];
            
            // Cache the result
            this.translationCache.set(cacheKey, result);
            
            return result;
        } catch (error) {
            return null;
        }
    }

    isEnglishText(text) {
        const asciiLetters = text.match(/[a-zA-Z]/g);
        return asciiLetters && asciiLetters.length / text.length > 0.5;
    }

    async getProxyImageUrl(item, mangaPageIndex = 0) {
        let imageUrl;

        if (item.page_count > 1 && item.meta_pages?.length > mangaPageIndex) {
            const page = item.meta_pages[mangaPageIndex].image_urls;
            imageUrl = page.large || page.medium || page.square_medium || page.original;
        } else {
            imageUrl = item.image_urls.large || item.image_urls.medium || item.image_urls.square_medium;
        }

        for (const proxy of this.proxies) {
            try {
                const proxyUrl = imageUrl.replace('i.pximg.net', proxy);
                const response = await fetch(proxyUrl, { method: 'HEAD', timeout: 3000 });

                if (response.ok) {
                    return proxyUrl;
                }
            } catch {
                continue;
            }
        }

        return imageUrl.replace('i.pximg.net', 'i.pixiv.cat');
    }

    // NEW: Get artwork by ID
    async getArtworkById(artworkId) {
        const token = await this.authenticate();

        const url = new URL('https://app-api.pixiv.net/v1/illust/detail');
        url.searchParams.append('illust_id', artworkId);

        console.log(`[Pixiv] Fetching artwork ID: ${artworkId}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...this.baseHeaders
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Pixiv API Error] ${response.status}: ${errorText}`);
            throw new Error(`Artwork not found or API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.illust) {
            throw new Error('Artwork not found');
        }

        const illust = data.illust;
        console.log(`[Pixiv] Found artwork: "${illust.title}" | R18: ${illust.x_restrict > 0} | AI: ${illust.illust_ai_type === 2}`);
        
        return illust;
    }
}

module.exports = new PixivService();
