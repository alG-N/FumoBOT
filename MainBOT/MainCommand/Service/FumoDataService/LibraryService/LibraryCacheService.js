const { CACHE_TTL } = require('../../../Configuration/libraryConfig');

class LibraryCacheService {
    constructor() {
        this.cache = new Map();
        this.startCleanup();
    }

    set(userId, data) {
        this.cache.set(userId, {
            data,
            timestamp: Date.now()
        });
    }

    get(userId) {
        const cached = this.cache.get(userId);
        
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > CACHE_TTL) {
            this.cache.delete(userId);
            return null;
        }
        
        return cached.data;
    }

    invalidate(userId) {
        this.cache.delete(userId);
    }

    clear() {
        this.cache.clear();
    }

    startCleanup() {
        setInterval(() => {
            const now = Date.now();
            const toDelete = [];
            
            for (const [userId, { timestamp }] of this.cache.entries()) {
                if (now - timestamp > CACHE_TTL) {
                    toDelete.push(userId);
                }
            }
            
            toDelete.forEach(userId => this.cache.delete(userId));
            
            if (toDelete.length > 0) {
                console.log(`[LibraryCache] Cleaned ${toDelete.length} expired entries`);
            }
        }, 60000);
    }

    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;
        
        for (const { timestamp } of this.cache.values()) {
            if (now - timestamp < CACHE_TTL) {
                valid++;
            } else {
                expired++;
            }
        }
        
        return {
            total: this.cache.size,
            valid,
            expired,
            ttl: CACHE_TTL
        };
    }
}

module.exports = new LibraryCacheService();