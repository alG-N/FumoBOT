/**
 * NHentai Service
 * Handles all API interactions with nhentai
 */

const axios = require('axios');

// API Configuration
const API_BASE = 'https://nhentai.net/api';
const GALLERY_ENDPOINT = '/gallery';
const THUMBNAIL_BASE = 'https://t.nhentai.net/galleries';
const IMAGE_BASE = 'https://i.nhentai.net/galleries';

// Image type mapping
const IMAGE_TYPES = {
    'j': 'jpg',
    'p': 'png',
    'g': 'gif'
};

// Known popular gallery IDs (curated fallback list)
const POPULAR_GALLERIES = [
    177013, 228922, 265918, 139808, 297974, 
    331461, 255662, 324303, 271048, 317115,
    356399, 367270, 349115, 361710, 366028,
    386483, 393321, 393497, 396823, 400485
];

// Request configuration
const REQUEST_CONFIG = {
    timeout: 15000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
    }
};

class NHentaiService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 300000; // 5 minutes
        this.maxCacheSize = 100;
        
        // Auto-cleanup every 10 minutes
        this._cleanupInterval = setInterval(() => this._cleanupCache(), 600000);
    }
    
    _cleanupCache() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
    }

    /**
     * Fetch gallery data by code
     */
    async fetchGallery(code) {
        // Check cache first
        const cached = this._getFromCache(`gallery_${code}`);
        if (cached) return { success: true, data: cached, fromCache: true };

        try {
            const response = await axios.get(`${API_BASE}${GALLERY_ENDPOINT}/${code}`, REQUEST_CONFIG);
            
            // Cache successful response
            this._setCache(`gallery_${code}`, response.data);
            
            return { success: true, data: response.data };
        } catch (error) {
            return this._handleError(error);
        }
    }

    /**
     * Fetch random gallery
     */
    async fetchRandomGallery() {
        const maxAttempts = 5;
        
        for (let i = 0; i < maxAttempts; i++) {
            // Generate random ID between 1 and current max (~500000)
            const randomCode = Math.floor(Math.random() * 500000) + 1;
            const result = await this.fetchGallery(randomCode);
            
            if (result.success) {
                return result;
            }
            
            // Small delay between retries
            await new Promise(r => setTimeout(r, 200));
        }
        
        // Fallback to known popular galleries
        return this.fetchPopularGallery();
    }

    /**
     * Fetch a popular gallery from curated list
     */
    async fetchPopularGallery() {
        const randomIndex = Math.floor(Math.random() * POPULAR_GALLERIES.length);
        return this.fetchGallery(POPULAR_GALLERIES[randomIndex]);
    }

    /**
     * Get page image URLs for a gallery
     */
    getPageUrls(gallery, startPage = 1, endPage = null) {
        const { media_id, images } = gallery;
        const pages = images?.pages || [];
        
        if (pages.length === 0) {
            return [];
        }

        const end = endPage ? Math.min(endPage, pages.length) : pages.length;
        const urls = [];

        for (let i = startPage - 1; i < end; i++) {
            const page = pages[i];
            if (page) {
                const ext = IMAGE_TYPES[page.t] || 'jpg';
                urls.push({
                    pageNum: i + 1,
                    url: `${IMAGE_BASE}/${media_id}/${i + 1}.${ext}`,
                    width: page.w,
                    height: page.h
                });
            }
        }

        return urls;
    }

    /**
     * Get thumbnail URL for gallery cover
     */
    getThumbnailUrl(mediaId, coverType) {
        const ext = IMAGE_TYPES[coverType] || 'jpg';
        return `${THUMBNAIL_BASE}/${mediaId}/cover.${ext}`;
    }

    /**
     * Get page thumbnail URL (smaller size for preview)
     */
    getPageThumbnailUrl(mediaId, pageNum, pageType) {
        const ext = IMAGE_TYPES[pageType] || 'jpg';
        return `${THUMBNAIL_BASE}/${mediaId}/${pageNum}t.${ext}`;
    }

    /**
     * Parse tags by type
     */
    getTagsByType(tags, type) {
        if (!tags || !Array.isArray(tags)) return [];
        return tags
            .filter(tag => tag.type === type)
            .map(tag => tag.name)
            .slice(0, 15);
    }

    /**
     * Get all tag types from gallery
     */
    parseAllTags(tags) {
        return {
            artists: this.getTagsByType(tags, 'artist'),
            characters: this.getTagsByType(tags, 'character'),
            parodies: this.getTagsByType(tags, 'parody'),
            groups: this.getTagsByType(tags, 'group'),
            tags: this.getTagsByType(tags, 'tag'),
            languages: this.getTagsByType(tags, 'language'),
            categories: this.getTagsByType(tags, 'category')
        };
    }

    /**
     * Handle API errors
     */
    _handleError(error) {
        if (error.response?.status === 404) {
            return { success: false, error: 'Gallery not found. Please check the code.', code: 'NOT_FOUND' };
        }
        if (error.response?.status === 403) {
            return { success: false, error: 'Access denied. The gallery may be region-locked.', code: 'FORBIDDEN' };
        }
        if (error.response?.status === 429) {
            return { success: false, error: 'Rate limited. Please wait a moment.', code: 'RATE_LIMITED' };
        }
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return { success: false, error: 'Request timed out. Please try again.', code: 'TIMEOUT' };
        }
        
        console.error('[NHentai Service Error]', error.message);
        return { success: false, error: 'Failed to fetch gallery. Please try again later.', code: 'UNKNOWN' };
    }

    /**
     * Cache management
     */
    _getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _setCache(key, data) {
        // Evict oldest if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.cacheExpiry
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = new NHentaiService();
