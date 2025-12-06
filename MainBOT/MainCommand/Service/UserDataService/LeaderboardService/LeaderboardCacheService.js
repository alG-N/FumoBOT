const LEADERBOARD_CONFIG = require('../../../Configuration/leaderboardConfig');

class LeaderboardCacheService {
    constructor() {
        this.cache = new Map();
        this.userCache = new Map();
        this.setupCleanup();
    }

    setupCleanup() {
        setInterval(() => {
            const now = Date.now();
            const toDelete = [];

            for (const [key, { timestamp }] of this.cache.entries()) {
                if (now - timestamp > LEADERBOARD_CONFIG.CACHE_TTL) {
                    toDelete.push(key);
                }
            }

            toDelete.forEach(key => this.cache.delete(key));

            if (toDelete.length > 0) {
                console.log(`[LeaderboardCache] Cleaned ${toDelete.length} expired entries`);
            }
        }, 60000);
    }

    getCacheKey(category, page = 0) {
        return `${category}_page${page}`;
    }

    get(category, page = 0) {
        const key = this.getCacheKey(category, page);
        const cached = this.cache.get(key);

        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > LEADERBOARD_CONFIG.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    set(category, data, page = 0) {
        const key = this.getCacheKey(category, page);
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    getUserCache(userId) {
        const cached = this.userCache.get(userId);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > LEADERBOARD_CONFIG.CACHE_TTL) {
            this.userCache.delete(userId);
            return null;
        }

        return cached.data;
    }

    setUserCache(userId, data) {
        this.userCache.set(userId, {
            data,
            timestamp: Date.now()
        });
    }

    invalidate(category = null) {
        if (category) {
            const toDelete = [];
            for (const key of this.cache.keys()) {
                if (key.startsWith(category)) {
                    toDelete.push(key);
                }
            }
            toDelete.forEach(key => this.cache.delete(key));
        } else {
            this.cache.clear();
        }
    }

    invalidateUser(userId) {
        this.userCache.delete(userId);
    }

    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const { timestamp } of this.cache.values()) {
            if (now - timestamp < LEADERBOARD_CONFIG.CACHE_TTL) {
                valid++;
            } else {
                expired++;
            }
        }

        return {
            total: this.cache.size,
            valid,
            expired,
            userCacheSize: this.userCache.size,
            ttl: LEADERBOARD_CONFIG.CACHE_TTL
        };
    }

    clear() {
        this.cache.clear();
        this.userCache.clear();
    }
}

module.exports = new LeaderboardCacheService();