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
            nsfwFilter = true,
            aiFilter = true
        } = options;

        const token = await this.authenticate();
        const isNovel = contentType === 'novel';

        const url = new URL(isNovel
            ? 'https://app-api.pixiv.net/v1/search/novel'
            : 'https://app-api.pixiv.net/v1/search/illust'
        );

        url.searchParams.append('word', query);
        url.searchParams.append('search_target', 'partial_match_for_tags');
        url.searchParams.append('sort', 'popular_desc');
        url.searchParams.append('offset', offset);
        url.searchParams.append('filter', 'for_android');

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
        return this._filterResults(data, contentType, nsfwFilter, aiFilter);
    }

    async getRanking(options = {}) {
        const {
            mode = 'day',
            contentType = 'illust',
            nsfwFilter = true,
            aiFilter = true,
            offset = 0
        } = options;

        const token = await this.authenticate();

        let rankingMode = mode;
        if (!nsfwFilter) {
            if (mode === 'day') rankingMode = 'day_r18';
            else if (mode === 'week') rankingMode = 'week_r18';
        }

        const url = new URL('https://app-api.pixiv.net/v1/illust/ranking');
        url.searchParams.append('mode', rankingMode);
        url.searchParams.append('filter', 'for_android');
        url.searchParams.append('offset', offset);

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
        return this._filterResults({ illusts: data.illusts, next_url: data.next_url }, contentType, true, aiFilter);
    }

    _filterResults(data, contentType, nsfwFilter, aiFilter) {
        const isNovel = contentType === 'novel';
        let items = isNovel ? data.novels : data.illusts;

        if (!items) return { items: [], nextUrl: data.next_url };

        if (nsfwFilter) {
            items = items.filter(item => item.x_restrict === 0);
        }

        if (aiFilter) {
            items = items.filter(item => item.illust_ai_type !== 2);
        }

        if (!isNovel) {
            if (contentType === 'manga') {
                items = items.filter(item => item.type === 'manga');
            } else if (contentType === 'illust') {
                items = items.filter(item => item.type === 'illust' || item.type === 'ugoira');
            }
        }

        return { items, nextUrl: data.next_url };
    }

    async getAutocompleteSuggestions(query) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);

            const url = `https://www.pixiv.net/rpc/cps.php?keyword=${encodeURIComponent(query)}`;

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
}

module.exports = new PixivService();
