/**
 * Base Cache Class with LRU eviction
 */

class BaseCache {
    constructor(cacheName, config = {}) {
        this.cacheName = cacheName;
        this.defaultTTL = config.defaultTTL || 300000;
        this.maxSize = config.maxSize || 500;
        this.cache = new Map();
        
        setInterval(() => this._cleanup(), 60000);
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        entry.lastAccessed = Date.now();
        return entry.value;
    }

    set(key, value, ttl = this.defaultTTL) {
        if (this.cache.size >= this.maxSize) this._evictLRU();
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
            lastAccessed: Date.now()
        });
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    _evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }
        if (oldestKey) this.cache.delete(oldestKey);
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) this.cache.delete(key);
        }
    }
}

module.exports = { BaseCache };
