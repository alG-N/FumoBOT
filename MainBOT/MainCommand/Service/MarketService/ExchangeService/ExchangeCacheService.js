const { debugLog } = require('../../../Core/logger');

/**
 * Cache for pending exchange requests
 * Prevents expired or invalid errors by storing exchange data temporarily
 */
class ExchangeCacheService {
    constructor() {
        // Map: customId -> exchange data
        this.cache = new Map();
        
        // Cache TTL (5 minutes)
        this.TTL = 5 * 60 * 1000;
        
        // Cleanup interval (every minute)
        this.cleanupInterval = 60 * 1000;
        
        this.startCleanup();
    }

    /**
     * Store exchange request in cache
     */
    store(customId, exchangeData) {
        const cacheEntry = {
            ...exchangeData,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.TTL
        };

        this.cache.set(customId, cacheEntry);
        debugLog('EXCHANGE_CACHE', `Stored exchange: ${customId}`);
        
        return cacheEntry;
    }

    /**
     * Retrieve exchange request from cache
     */
    get(customId) {
        const entry = this.cache.get(customId);
        
        if (!entry) {
            debugLog('EXCHANGE_CACHE', `Exchange not found: ${customId}`);
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            debugLog('EXCHANGE_CACHE', `Exchange expired: ${customId}`);
            this.cache.delete(customId);
            return null;
        }

        return entry;
    }

    /**
     * Check if exchange request is valid and not expired
     */
    isValid(customId) {
        const entry = this.get(customId);
        return entry !== null;
    }

    /**
     * Remove exchange request from cache after completion
     */
    remove(customId) {
        const deleted = this.cache.delete(customId);
        if (deleted) {
            debugLog('EXCHANGE_CACHE', `Removed exchange: ${customId}`);
        }
        return deleted;
    }

    /**
     * Get remaining time for exchange request (in seconds)
     */
    getRemainingTime(customId) {
        const entry = this.cache.get(customId);
        if (!entry) return 0;

        const remaining = Math.max(0, entry.expiresAt - Date.now());
        return Math.floor(remaining / 1000);
    }

    /**
     * Extend TTL for exchange request
     */
    extend(customId, additionalTime = 60000) {
        const entry = this.cache.get(customId);
        if (!entry) return false;

        entry.expiresAt = Date.now() + additionalTime;
        this.cache.set(customId, entry);
        
        debugLog('EXCHANGE_CACHE', `Extended TTL for: ${customId}`);
        return true;
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let removed = 0;

        for (const [customId, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(customId);
                removed++;
            }
        }

        if (removed > 0) {
            debugLog('EXCHANGE_CACHE', `Cleaned up ${removed} expired exchange(s)`);
        }

        return removed;
    }

    /**
     * Start automatic cleanup
     */
    startCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }

        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);

        debugLog('EXCHANGE_CACHE', 'Started automatic cleanup');
    }

    /**
     * Stop automatic cleanup
     */
    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            debugLog('EXCHANGE_CACHE', 'Stopped automatic cleanup');
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const now = Date.now();
        let valid = 0;
        let expired = 0;

        for (const entry of this.cache.values()) {
            if (now > entry.expiresAt) {
                expired++;
            } else {
                valid++;
            }
        }

        return {
            total: this.cache.size,
            valid,
            expired,
            ttl: this.TTL
        };
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        debugLog('EXCHANGE_CACHE', `Cleared ${size} exchange(s)`);
        return size;
    }

    /**
     * Get all exchanges for a specific user
     */
    getUserExchanges(userId) {
        const userExchanges = [];
        
        for (const [customId, entry] of this.cache.entries()) {
            if (entry.userId === userId && Date.now() <= entry.expiresAt) {
                userExchanges.push({
                    customId,
                    ...entry
                });
            }
        }

        return userExchanges;
    }

    /**
     * Cancel all pending exchanges for a user
     */
    cancelUserExchanges(userId) {
        let cancelled = 0;
        
        for (const [customId, entry] of this.cache.entries()) {
            if (entry.userId === userId) {
                this.cache.delete(customId);
                cancelled++;
            }
        }

        if (cancelled > 0) {
            debugLog('EXCHANGE_CACHE', `Cancelled ${cancelled} exchange(s) for user ${userId}`);
        }

        return cancelled;
    }
}

const exchangeCacheInstance = new ExchangeCacheService();

module.exports = exchangeCacheInstance;