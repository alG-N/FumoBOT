/**
 * Rule34 Cache Manager
 * Handles caching for search results, user sessions, blacklists, and preferences
 */

class Rule34Cache {
    constructor() {
        // Search result cache
        this.searchCache = new Map();
        // User session data (current search state, pagination, etc.)
        this.userSessions = new Map();
        // User blacklists (persistent tags to exclude)
        this.userBlacklists = new Map();
        // User preferences
        this.userPreferences = new Map();
        // Autocomplete cache
        this.autocompleteCache = new Map();
        // Favorites cache
        this.userFavorites = new Map();
        // View history
        this.viewHistory = new Map();
        
        // Cache durations
        this.SEARCH_CACHE_DURATION = 10 * 60 * 1000;      // 10 minutes
        this.SESSION_DURATION = 30 * 60 * 1000;           // 30 minutes
        this.AUTOCOMPLETE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.HISTORY_MAX_SIZE = 50;

        // Start cleanup interval
        setInterval(() => this._cleanup(), 5 * 60 * 1000);
    }

    // ========== SESSION MANAGEMENT ==========

    /**
     * Create or update user session
     */
    setSession(userId, sessionData) {
        const session = {
            ...sessionData,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.userSessions.set(userId, session);
        return session;
    }

    /**
     * Get user session
     */
    getSession(userId) {
        const session = this.userSessions.get(userId);
        if (!session) return null;
        
        if (Date.now() - session.updatedAt > this.SESSION_DURATION) {
            this.userSessions.delete(userId);
            return null;
        }
        
        return session;
    }

    /**
     * Update session property
     */
    updateSession(userId, updates) {
        const session = this.getSession(userId);
        if (!session) return null;
        
        const updated = {
            ...session,
            ...updates,
            updatedAt: Date.now()
        };
        this.userSessions.set(userId, updated);
        return updated;
    }

    /**
     * Clear user session
     */
    clearSession(userId) {
        this.userSessions.delete(userId);
    }

    // ========== SEARCH CACHE ==========

    /**
     * Cache search results
     */
    setSearchResults(cacheKey, data) {
        this.searchCache.set(cacheKey, {
            ...data,
            timestamp: Date.now()
        });
    }

    /**
     * Get cached search results
     */
    getSearchResults(cacheKey) {
        const cached = this.searchCache.get(cacheKey);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.SEARCH_CACHE_DURATION) {
            this.searchCache.delete(cacheKey);
            return null;
        }
        
        return cached;
    }

    /**
     * Generate cache key for search
     */
    generateSearchKey(userId, query, options = {}) {
        const optStr = JSON.stringify(options);
        return `${userId}_${query}_${optStr}`;
    }

    // ========== BLACKLIST MANAGEMENT ==========

    /**
     * Get user's blacklist
     */
    getBlacklist(userId) {
        return this.userBlacklists.get(userId) || [];
    }

    /**
     * Add tags to blacklist
     */
    addToBlacklist(userId, tags) {
        const current = this.getBlacklist(userId);
        const newTags = Array.isArray(tags) ? tags : [tags];
        const updated = [...new Set([...current, ...newTags])];
        this.userBlacklists.set(userId, updated);
        return updated;
    }

    /**
     * Remove tags from blacklist
     */
    removeFromBlacklist(userId, tags) {
        const current = this.getBlacklist(userId);
        const toRemove = Array.isArray(tags) ? tags : [tags];
        const updated = current.filter(t => !toRemove.includes(t));
        this.userBlacklists.set(userId, updated);
        return updated;
    }

    /**
     * Clear entire blacklist
     */
    clearBlacklist(userId) {
        this.userBlacklists.set(userId, []);
    }

    /**
     * Check if tag is blacklisted
     */
    isBlacklisted(userId, tag) {
        return this.getBlacklist(userId).includes(tag);
    }

    // ========== USER PREFERENCES ==========

    /**
     * Default preferences
     */
    getDefaultPreferences() {
        return {
            aiFilter: true,          // Filter out AI by default
            defaultRating: null,     // null = all ratings
            minScore: 0,             // Minimum score filter
            excludeLowQuality: true, // Exclude low quality by default
            highQualityOnly: false,  // Only show high quality
            showAnimatedOnly: false, // Only show animated content
            resultsPerPage: 10,      // Results per page
            autoplay: false,         // Autoplay videos
            compactMode: false,      // Compact embed mode
            sortMode: 'score:desc',  // Default sort
            safeMode: false          // Extra safe filtering
        };
    }

    /**
     * Get user preferences
     */
    getPreferences(userId) {
        const prefs = this.userPreferences.get(userId);
        return { ...this.getDefaultPreferences(), ...prefs };
    }

    /**
     * Update user preferences
     */
    setPreferences(userId, preferences) {
        const current = this.getPreferences(userId);
        const updated = { ...current, ...preferences };
        this.userPreferences.set(userId, updated);
        return updated;
    }

    /**
     * Reset preferences to default
     */
    resetPreferences(userId) {
        this.userPreferences.delete(userId);
        return this.getDefaultPreferences();
    }

    // ========== AUTOCOMPLETE CACHE ==========

    /**
     * Cache autocomplete suggestions
     */
    setAutocompleteSuggestions(query, suggestions) {
        this.autocompleteCache.set(query.toLowerCase(), {
            suggestions,
            timestamp: Date.now()
        });
    }

    /**
     * Get cached autocomplete suggestions
     */
    getAutocompleteSuggestions(query) {
        const cached = this.autocompleteCache.get(query.toLowerCase());
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.AUTOCOMPLETE_CACHE_DURATION) {
            this.autocompleteCache.delete(query.toLowerCase());
            return null;
        }
        
        return cached.suggestions;
    }

    // ========== FAVORITES ==========

    /**
     * Get user favorites
     */
    getFavorites(userId) {
        return this.userFavorites.get(userId) || [];
    }

    /**
     * Add to favorites
     */
    addFavorite(userId, postId, postInfo = {}) {
        const favorites = this.getFavorites(userId);
        
        // Check if already favorited
        if (favorites.some(f => f.id === postId)) {
            return { success: false, message: 'Already favorited' };
        }
        
        favorites.unshift({
            id: postId,
            ...postInfo,
            addedAt: Date.now()
        });
        
        // Limit favorites
        if (favorites.length > 100) {
            favorites.pop();
        }
        
        this.userFavorites.set(userId, favorites);
        return { success: true, favorites };
    }

    /**
     * Remove from favorites
     */
    removeFavorite(userId, postId) {
        const favorites = this.getFavorites(userId);
        const updated = favorites.filter(f => f.id !== postId);
        this.userFavorites.set(userId, updated);
        return updated;
    }

    /**
     * Check if favorited
     */
    isFavorited(userId, postId) {
        return this.getFavorites(userId).some(f => f.id === postId);
    }

    // ========== VIEW HISTORY ==========

    /**
     * Add to view history
     */
    addToHistory(userId, postId, postInfo = {}) {
        let history = this.viewHistory.get(userId) || [];
        
        // Remove if exists (to move to front)
        history = history.filter(h => h.id !== postId);
        
        history.unshift({
            id: postId,
            ...postInfo,
            viewedAt: Date.now()
        });
        
        // Limit history size
        if (history.length > this.HISTORY_MAX_SIZE) {
            history = history.slice(0, this.HISTORY_MAX_SIZE);
        }
        
        this.viewHistory.set(userId, history);
        return history;
    }

    /**
     * Get view history
     */
    getHistory(userId, limit = 20) {
        const history = this.viewHistory.get(userId) || [];
        return history.slice(0, limit);
    }

    /**
     * Clear view history
     */
    clearHistory(userId) {
        this.viewHistory.delete(userId);
    }

    // ========== PAGINATION STATE ==========

    /**
     * Set pagination state
     */
    setPagination(userId, state) {
        return this.updateSession(userId, {
            pagination: {
                currentIndex: state.currentIndex || 0,
                currentPage: state.currentPage || 0,
                totalResults: state.totalResults || 0,
                hasMore: state.hasMore || false
            }
        });
    }

    /**
     * Get pagination state
     */
    getPagination(userId) {
        const session = this.getSession(userId);
        return session?.pagination || null;
    }

    // ========== CLEANUP ==========

    _cleanup() {
        const now = Date.now();
        
        // Clean search cache
        for (const [key, value] of this.searchCache.entries()) {
            if (now - value.timestamp > this.SEARCH_CACHE_DURATION) {
                this.searchCache.delete(key);
            }
        }
        
        // Clean sessions
        for (const [key, value] of this.userSessions.entries()) {
            if (now - value.updatedAt > this.SESSION_DURATION) {
                this.userSessions.delete(key);
            }
        }
        
        // Clean autocomplete cache
        for (const [key, value] of this.autocompleteCache.entries()) {
            if (now - value.timestamp > this.AUTOCOMPLETE_CACHE_DURATION) {
                this.autocompleteCache.delete(key);
            }
        }

        console.log(`[Rule34 Cache] Cleanup complete. Sessions: ${this.userSessions.size}, Search: ${this.searchCache.size}`);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            sessions: this.userSessions.size,
            searchCache: this.searchCache.size,
            blacklists: this.userBlacklists.size,
            preferences: this.userPreferences.size,
            favorites: this.userFavorites.size,
            history: this.viewHistory.size,
            autocomplete: this.autocompleteCache.size
        };
    }
}

module.exports = new Rule34Cache();