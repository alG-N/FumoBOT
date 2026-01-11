const { BaseCache } = require('../shared/repositories/BaseCache');

/**
 * Pixiv Cache - Extends BaseCache with search-specific functionality
 */
class PixivCache {
    constructor() {
        // Use BaseCache for both caches
        this.searchCache = new BaseCache('pixiv-search', { 
            defaultTTL: 5 * 60 * 1000, // 5 minutes
            maxSize: 200 
        });
        this.resultCache = new BaseCache('pixiv-results', { 
            defaultTTL: 30 * 60 * 1000, // 30 minutes
            maxSize: 100 
        });
    }

    // Search autocomplete cache
    getSearchSuggestions(query) {
        const key = query.toLowerCase();
        return this.searchCache.get(key);
    }

    setSearchSuggestions(query, results) {
        const key = query.toLowerCase();
        this.searchCache.set(key, results);
    }

    // Result cache for pagination
    getResults(cacheKey) {
        return this.resultCache.get(cacheKey);
    }

    setResults(cacheKey, data) {
        this.resultCache.set(cacheKey, data);
    }

    deleteResults(cacheKey) {
        this.resultCache.delete(cacheKey);
    }
}

module.exports = new PixivCache();
