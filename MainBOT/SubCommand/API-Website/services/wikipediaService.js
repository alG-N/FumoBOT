/**
 * Wikipedia Service
 * Handles all Wikipedia API interactions
 */

const axios = require('axios');

// Wikipedia API endpoints
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const WIKIPEDIA_REST = 'https://en.wikipedia.org/api/rest_v1';

// Supported languages
const LANGUAGE_ENDPOINTS = {
    en: { api: 'https://en.wikipedia.org/w/api.php', rest: 'https://en.wikipedia.org/api/rest_v1' },
    ja: { api: 'https://ja.wikipedia.org/w/api.php', rest: 'https://ja.wikipedia.org/api/rest_v1' },
    de: { api: 'https://de.wikipedia.org/w/api.php', rest: 'https://de.wikipedia.org/api/rest_v1' },
    fr: { api: 'https://fr.wikipedia.org/w/api.php', rest: 'https://fr.wikipedia.org/api/rest_v1' },
    es: { api: 'https://es.wikipedia.org/w/api.php', rest: 'https://es.wikipedia.org/api/rest_v1' }
};

const REQUEST_CONFIG = {
    timeout: 10000,
    headers: {
        'User-Agent': 'FumoBOT/2.0 (Discord Bot; https://github.com/fumobot)',
        'Accept': 'application/json'
    }
};

class WikipediaService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 600000; // 10 minutes (Wikipedia content changes less frequently)
        this.maxCacheSize = 100;
        this.defaultLanguage = 'en';
        
        // Auto-cleanup every 15 minutes
        setInterval(() => this._cleanupCache(), 900000);
    }
    
    _cleanupCache() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Search Wikipedia for articles
     */
    async search(query, options = {}) {
        const { language = this.defaultLanguage, limit = 5 } = options;
        const endpoints = LANGUAGE_ENDPOINTS[language] || LANGUAGE_ENDPOINTS.en;
        
        // Check cache
        const cacheKey = `search_${language}_${query}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return { ...cached, fromCache: true };

        try {
            const response = await axios.get(endpoints.api, {
                ...REQUEST_CONFIG,
                params: {
                    action: 'opensearch',
                    search: query,
                    limit: Math.min(limit, 10),
                    namespace: 0,
                    format: 'json'
                }
            });

            const [searchTerm, titles, descriptions, urls] = response.data;

            if (!titles || titles.length === 0) {
                return { success: true, results: [], query: searchTerm };
            }

            const results = titles.map((title, i) => ({
                title,
                description: descriptions[i] || 'No description available.',
                url: urls[i]
            }));

            const result = { success: true, results, query: searchTerm };
            this._setCache(cacheKey, result);
            
            return result;
        } catch (error) {
            console.error('[Wikipedia Search Error]', error.message);
            return { success: false, error: 'Failed to search Wikipedia. Please try again.' };
        }
    }

    /**
     * Get article summary
     */
    async getArticleSummary(title, language = 'en') {
        const endpoints = LANGUAGE_ENDPOINTS[language] || LANGUAGE_ENDPOINTS.en;
        
        // Check cache
        const cacheKey = `article_${language}_${title}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return { ...cached, fromCache: true };

        try {
            const encodedTitle = encodeURIComponent(title.replace(/ /g, '_'));
            const response = await axios.get(`${endpoints.rest}/page/summary/${encodedTitle}`, REQUEST_CONFIG);

            const data = response.data;
            const article = {
                title: data.title,
                displayTitle: data.displaytitle || data.title,
                description: data.description || null,
                extract: data.extract || 'No summary available.',
                extractHtml: data.extract_html || null,
                url: data.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodedTitle}`,
                mobileUrl: data.content_urls?.mobile?.page || null,
                thumbnail: data.thumbnail?.source || null,
                originalImage: data.originalimage?.source || null,
                type: data.type,
                timestamp: data.timestamp,
                language,
                coordinates: data.coordinates || null
            };

            const result = { success: true, article };
            this._setCache(cacheKey, result);
            
            return result;
        } catch (error) {
            if (error.response?.status === 404) {
                return { success: false, error: 'Article not found.', code: 'NOT_FOUND' };
            }
            console.error('[Wikipedia Article Error]', error.message);
            return { success: false, error: 'Failed to fetch article. Please try again.' };
        }
    }

    /**
     * Get random article
     */
    async getRandomArticle(language = 'en') {
        const endpoints = LANGUAGE_ENDPOINTS[language] || LANGUAGE_ENDPOINTS.en;

        try {
            const response = await axios.get(`${endpoints.rest}/page/random/summary`, REQUEST_CONFIG);

            const data = response.data;
            return {
                success: true,
                article: {
                    title: data.title,
                    displayTitle: data.displaytitle || data.title,
                    description: data.description || null,
                    extract: data.extract || 'No summary available.',
                    url: data.content_urls?.desktop?.page,
                    thumbnail: data.thumbnail?.source || null,
                    originalImage: data.originalimage?.source || null,
                    type: data.type,
                    language
                }
            };
        } catch (error) {
            console.error('[Wikipedia Random Error]', error.message);
            return { success: false, error: 'Failed to fetch random article. Please try again.' };
        }
    }

    /**
     * Get "On This Day" events
     */
    async getOnThisDay(month, day, language = 'en') {
        const endpoints = LANGUAGE_ENDPOINTS[language] || LANGUAGE_ENDPOINTS.en;

        try {
            const response = await axios.get(
                `${endpoints.rest}/feed/onthisday/events/${month}/${day}`,
                REQUEST_CONFIG
            );

            const events = response.data.events?.slice(0, 5).map(event => ({
                year: event.year,
                text: event.text,
                pages: event.pages?.slice(0, 3).map(p => ({
                    title: p.title,
                    url: p.content_urls?.desktop?.page
                }))
            })) || [];

            return { success: true, events, date: { month, day } };
        } catch (error) {
            console.error('[Wikipedia OnThisDay Error]', error.message);
            return { success: false, error: 'Failed to fetch events. Please try again.' };
        }
    }

    /**
     * Get featured article of the day
     */
    async getFeaturedArticle(date = new Date(), language = 'en') {
        const endpoints = LANGUAGE_ENDPOINTS[language] || LANGUAGE_ENDPOINTS.en;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        try {
            const response = await axios.get(
                `${endpoints.rest}/feed/featured/${year}/${month}/${day}`,
                REQUEST_CONFIG
            );

            const tfa = response.data.tfa;
            if (!tfa) {
                return { success: false, error: 'No featured article available for this date.' };
            }

            return {
                success: true,
                article: {
                    title: tfa.title,
                    displayTitle: tfa.displaytitle || tfa.title,
                    extract: tfa.extract,
                    url: tfa.content_urls?.desktop?.page,
                    thumbnail: tfa.thumbnail?.source || null
                }
            };
        } catch (error) {
            console.error('[Wikipedia Featured Error]', error.message);
            return { success: false, error: 'Failed to fetch featured article.' };
        }
    }

    /**
     * Cache management
     */
    _getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _setCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, { data, expiresAt: Date.now() + this.cacheExpiry });
    }
}

module.exports = new WikipediaService();
