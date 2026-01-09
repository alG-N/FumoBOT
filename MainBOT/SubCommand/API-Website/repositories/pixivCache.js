class PixivCache {
    constructor() {
        this.searchCache = new Map();
        this.resultCache = new Map();
        this.SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.RESULT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

        // Auto cleanup
        setInterval(() => this._cleanup(), 5 * 60 * 1000);
    }

    // Search autocomplete cache
    getSearchSuggestions(query) {
        const key = query.toLowerCase();
        const cached = this.searchCache.get(key);

        if (cached && Date.now() - cached.timestamp < this.SEARCH_CACHE_DURATION) {
            return cached.results;
        }

        return null;
    }

    setSearchSuggestions(query, results) {
        const key = query.toLowerCase();
        this.searchCache.set(key, {
            results,
            timestamp: Date.now()
        });
    }

    // Result cache for pagination
    getResults(cacheKey) {
        const cached = this.resultCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.RESULT_CACHE_DURATION) {
            return cached;
        }

        return null;
    }

    setResults(cacheKey, data) {
        this.resultCache.set(cacheKey, {
            ...data,
            timestamp: Date.now()
        });
    }

    deleteResults(cacheKey) {
        this.resultCache.delete(cacheKey);
    }

    _cleanup() {
        const now = Date.now();

        for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > this.SEARCH_CACHE_DURATION) {
                this.searchCache.delete(key);
            }
        }

        for (const [key, value] of this.resultCache.entries()) {
            if (now - value.timestamp > this.RESULT_CACHE_DURATION) {
                this.resultCache.delete(key);
            }
        }
    }
}

module.exports = new PixivCache();
