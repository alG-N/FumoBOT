/**
 * Unified Cache Manager
 * Consolidates caching for all API commands
 */

class CacheManager {
    constructor() {
        // User-specific caches
        this.userPosts = new Map();      // User posts data
        this.pageStates = new Map();     // Current page per user
        this.sortStates = new Map();     // Sort preference per user
        this.nsfwStates = new Map();     // NSFW channel status
        this.galleryStates = new Map();  // Gallery pagination
        this.searchStates = new Map();   // Search results

        // Content caches with TTL
        this.contentCache = new Map();
        this.defaultTTL = 300000; // 5 minutes
        this.maxSize = 1000;

        // Auto cleanup every 5 minutes
        setInterval(() => this._cleanup(), 300000);
    }

    // === User Posts Management ===
    setPosts(userId, source, posts) {
        const key = `${source}_${userId}`;
        this.userPosts.set(key, posts);
    }

    getPosts(userId, source) {
        return this.userPosts.get(`${source}_${userId}`);
    }

    clearPosts(userId, source) {
        this.userPosts.delete(`${source}_${userId}`);
    }

    // === Page State Management ===
    setPage(userId, source, page) {
        this.pageStates.set(`${source}_${userId}`, page);
    }

    getPage(userId, source) {
        return this.pageStates.get(`${source}_${userId}`) || 0;
    }

    // === Sort State Management ===
    setSort(userId, source, sortBy) {
        this.sortStates.set(`${source}_${userId}`, sortBy);
    }

    getSort(userId, source) {
        return this.sortStates.get(`${source}_${userId}`) || 'top';
    }

    // === NSFW Channel State ===
    setNsfwChannel(userId, isNsfw) {
        this.nsfwStates.set(userId, isNsfw);
    }

    getNsfwChannel(userId) {
        return this.nsfwStates.get(userId) || false;
    }

    // === Gallery State Management ===
    setGalleryPage(userId, source, postIndex, page) {
        const key = `${source}_${userId}_${postIndex}`;
        this.galleryStates.set(key, page);
    }

    getGalleryPage(userId, source, postIndex) {
        const key = `${source}_${userId}_${postIndex}`;
        return this.galleryStates.get(key) || 0;
    }

    // === Search Results Cache ===
    setSearchResults(userId, source, results) {
        this.searchStates.set(`${source}_${userId}`, results);
    }

    getSearchResults(userId, source) {
        return this.searchStates.get(`${source}_${userId}`);
    }

    // === Content Cache with TTL ===
    cacheContent(key, data, ttl = this.defaultTTL) {
        if (this.contentCache.size >= this.maxSize) {
            this._evictOldest();
        }
        this.contentCache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
            accessedAt: Date.now()
        });
    }

    getCachedContent(key) {
        const entry = this.contentCache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.contentCache.delete(key);
            return null;
        }
        entry.accessedAt = Date.now();
        return entry.data;
    }

    // === Clear All User Data ===
    clearAllUserData(userId, source = null) {
        const sources = source ? [source] : ['reddit', 'rule34', 'pixiv', 'nhentai', 'google', 'wikipedia', 'anime', 'steam'];
        
        for (const src of sources) {
            this.userPosts.delete(`${src}_${userId}`);
            this.pageStates.delete(`${src}_${userId}`);
            this.sortStates.delete(`${src}_${userId}`);
            this.searchStates.delete(`${src}_${userId}`);
            
            // Clear gallery states
            for (const key of this.galleryStates.keys()) {
                if (key.startsWith(`${src}_${userId}_`)) {
                    this.galleryStates.delete(key);
                }
            }
        }
        
        this.nsfwStates.delete(userId);
    }

    // === Internal Methods ===
    _evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, entry] of this.contentCache) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.contentCache.delete(oldestKey);
        }
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.contentCache) {
            if (now > entry.expiresAt) {
                this.contentCache.delete(key);
            }
        }
    }
}

module.exports = new CacheManager();
