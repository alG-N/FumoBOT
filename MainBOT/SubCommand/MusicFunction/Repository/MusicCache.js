/**
 * Music Cache Manager
 * Handles caching for queue state, user sessions, preferences, and history
 */

class MusicCache {
    constructor() {
        // Guild queue states
        this.guildQueues = new Map();
        // User sessions (DJ controls, etc.)
        this.userSessions = new Map();
        // User preferences
        this.userPreferences = new Map();
        // Listening history
        this.listeningHistory = new Map();
        // Favorite tracks
        this.userFavorites = new Map();
        // Playlist cache
        this.playlistCache = new Map();
        // Recently played per guild
        this.recentlyPlayed = new Map();
        // Skip vote sessions
        this.skipVoteSessions = new Map();
        // DJ lock state per guild
        this.djLockState = new Map();

        // Cache durations
        this.SESSION_DURATION = 60 * 60 * 1000;           // 1 hour
        this.PLAYLIST_CACHE_DURATION = 30 * 60 * 1000;    // 30 minutes
        this.HISTORY_MAX_SIZE = 100;
        this.FAVORITES_MAX_SIZE = 200;
        this.RECENTLY_PLAYED_MAX = 50;

        // Start cleanup interval
        setInterval(() => this._cleanup(), 10 * 60 * 1000);
    }

    // ========== QUEUE MANAGEMENT ==========

    /**
     * Get or create guild queue
     */
    getOrCreateQueue(guildId) {
        if (!this.guildQueues.has(guildId)) {
            this.guildQueues.set(guildId, this._createDefaultQueue(guildId));
        }
        return this.guildQueues.get(guildId);
    }

    /**
     * Create default queue structure
     */
    _createDefaultQueue(guildId) {
        return {
            guildId,
            tracks: [],
            originalTracks: [],
            currentTrack: null,
            position: 0,
            
            // Playback state
            isPaused: false,
            isLooping: false,
            loopMode: 'off', // 'off', 'track', 'queue'
            isShuffled: false,
            volume: 100,
            
            // Messages
            nowPlayingMessage: null,
            controlsMessage: null,
            
            // Voting
            skipVotes: new Set(),
            skipVoteActive: false,
            skipVoteTimeout: null,
            skipVoteMessage: null,
            
            // Priority queue
            priorityQueue: [],
            priorityVotes: new Set(),
            priorityVoteActive: false,
            
            // Timers
            inactivityTimer: null,
            vcMonitorInterval: null,
            
            // State flags
            eventsBound: false,
            isTransitioning: false,
            
            // Metadata
            createdAt: Date.now(),
            updatedAt: Date.now(),
            textChannelId: null,
            voiceChannelId: null,
            requesterId: null
        };
    }

    /**
     * Get queue
     */
    getQueue(guildId) {
        return this.guildQueues.get(guildId);
    }

    /**
     * Update queue property
     */
    updateQueue(guildId, updates) {
        const queue = this.getQueue(guildId);
        if (!queue) return null;
        
        Object.assign(queue, updates, { updatedAt: Date.now() });
        return queue;
    }

    /**
     * Delete queue
     */
    deleteQueue(guildId) {
        const queue = this.guildQueues.get(guildId);
        if (queue) {
            // Clear timers
            if (queue.inactivityTimer) clearTimeout(queue.inactivityTimer);
            if (queue.vcMonitorInterval) clearInterval(queue.vcMonitorInterval);
            if (queue.skipVoteTimeout) clearTimeout(queue.skipVoteTimeout);
        }
        return this.guildQueues.delete(guildId);
    }

    /**
     * Check if queue exists
     */
    hasQueue(guildId) {
        return this.guildQueues.has(guildId);
    }

    // ========== TRACK MANAGEMENT ==========

    /**
     * Add track to queue
     */
    addTrack(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        queue.tracks.push(track);
        queue.originalTracks.push(track);
        queue.updatedAt = Date.now();
        return queue.tracks.length;
    }

    /**
     * Add track to front of queue
     */
    addTrackToFront(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        queue.tracks.unshift(track);
        queue.originalTracks.unshift(track);
        queue.updatedAt = Date.now();
        return 1;
    }

    /**
     * Add tracks (bulk)
     */
    addTracks(guildId, tracks) {
        const queue = this.getOrCreateQueue(guildId);
        queue.tracks.push(...tracks);
        queue.originalTracks.push(...tracks);
        queue.updatedAt = Date.now();
        return queue.tracks.length;
    }

    /**
     * Remove track at index
     */
    removeTrack(guildId, index) {
        const queue = this.getQueue(guildId);
        if (!queue || index < 0 || index >= queue.tracks.length) return null;
        
        const removed = queue.tracks.splice(index, 1)[0];
        queue.updatedAt = Date.now();
        return removed;
    }

    /**
     * Clear all tracks
     */
    clearTracks(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        queue.tracks = [];
        queue.originalTracks = [];
        queue.currentTrack = null;
        queue.position = 0;
        queue.updatedAt = Date.now();
    }

    /**
     * Get next track
     */
    getNextTrack(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || queue.tracks.length === 0) return null;
        
        return queue.tracks.shift();
    }

    /**
     * Shuffle queue
     */
    shuffleQueue(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        // Fisher-Yates shuffle
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
        queue.isShuffled = true;
        queue.updatedAt = Date.now();
    }

    /**
     * Unshuffle queue (restore original order)
     */
    unshuffleQueue(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        // Filter original tracks to only include those still in queue
        const currentIds = new Set(queue.tracks.map(t => t.url));
        queue.tracks = queue.originalTracks.filter(t => currentIds.has(t.url));
        queue.isShuffled = false;
        queue.updatedAt = Date.now();
    }

    // ========== PLAYBACK STATE ==========

    /**
     * Set current track
     */
    setCurrentTrack(guildId, track) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        queue.currentTrack = track;
        queue.updatedAt = Date.now();
        
        // Add to recently played
        if (track) {
            this.addToRecentlyPlayed(guildId, track);
        }
    }

    /**
     * Get current track
     */
    getCurrentTrack(guildId) {
        return this.getQueue(guildId)?.currentTrack || null;
    }

    /**
     * Toggle pause state
     */
    togglePause(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return false;
        
        queue.isPaused = !queue.isPaused;
        queue.updatedAt = Date.now();
        return queue.isPaused;
    }

    /**
     * Set loop mode
     */
    setLoopMode(guildId, mode) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        queue.loopMode = mode;
        queue.isLooping = mode !== 'off';
        queue.updatedAt = Date.now();
    }

    /**
     * Cycle loop mode
     */
    cycleLoopMode(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return 'off';
        
        const modes = ['off', 'track', 'queue'];
        const currentIndex = modes.indexOf(queue.loopMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        queue.loopMode = modes[nextIndex];
        queue.isLooping = queue.loopMode !== 'off';
        queue.updatedAt = Date.now();
        
        return queue.loopMode;
    }

    /**
     * Set volume
     */
    setVolume(guildId, volume) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        queue.volume = Math.max(0, Math.min(200, volume));
        queue.updatedAt = Date.now();
        return queue.volume;
    }

    // ========== VOTING ==========

    /**
     * Start skip vote
     */
    startSkipVote(guildId, userId, listenerCount) {
        const queue = this.getQueue(guildId);
        if (!queue) return null;
        
        queue.skipVoteActive = true;
        queue.skipVotes = new Set([userId]);
        queue.skipVoteListenerCount = listenerCount;
        queue.updatedAt = Date.now();
        
        return { voteCount: 1, required: this.getRequiredVotes(listenerCount) };
    }

    /**
     * Add skip vote
     */
    addSkipVote(guildId, userId) {
        const queue = this.getQueue(guildId);
        if (!queue || !queue.skipVoteActive) return null;
        
        if (queue.skipVotes.has(userId)) {
            return { added: false, voteCount: queue.skipVotes.size, message: 'Already voted' };
        }
        
        queue.skipVotes.add(userId);
        queue.updatedAt = Date.now();
        
        return {
            added: true,
            voteCount: queue.skipVotes.size,
            required: this.getRequiredVotes(queue.skipVoteListenerCount)
        };
    }

    /**
     * End skip vote
     */
    endSkipVote(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        const voteCount = queue.skipVotes.size;
        queue.skipVoteActive = false;
        queue.skipVotes.clear();
        queue.skipVoteListenerCount = null;
        
        if (queue.skipVoteTimeout) {
            clearTimeout(queue.skipVoteTimeout);
            queue.skipVoteTimeout = null;
        }
        queue.skipVoteMessage = null;
        queue.updatedAt = Date.now();
        
        return voteCount;
    }

    /**
     * Get required votes (majority minus the requester)
     */
    getRequiredVotes(listenerCount) {
        // Require ~60% of listeners to agree (excluding song requester who may not want to skip)
        // 5 listeners -> 3 votes, 6 -> 4, 7 -> 4, 8 -> 5, 10 -> 6
        return Math.ceil(listenerCount * 0.6);
    }

    /**
     * Check if enough votes
     */
    hasEnoughSkipVotes(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || !queue.skipVoteActive) return false;
        
        return queue.skipVotes.size >= this.getRequiredVotes(queue.skipVoteListenerCount);
    }

    // ========== USER PREFERENCES ==========

    /**
     * Default preferences
     */
    getDefaultPreferences() {
        return {
            defaultVolume: 100,
            autoPlay: false,
            announceTrack: true,
            compactMode: false,
            djMode: false,
            maxTrackDuration: 600,     // 10 minutes
            maxQueueSize: 100,
            preferredSource: 'youtube',
            showThumbnails: true,
            autoLeaveEmpty: true,
            voteSkipEnabled: true
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
     * Set user preferences
     */
    setPreferences(userId, preferences) {
        const current = this.getPreferences(userId);
        const updated = { ...current, ...preferences };
        this.userPreferences.set(userId, updated);
        return updated;
    }

    /**
     * Reset user preferences
     */
    resetPreferences(userId) {
        this.userPreferences.delete(userId);
        return this.getDefaultPreferences();
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
    addFavorite(userId, track) {
        const favorites = this.getFavorites(userId);
        
        // Check if already exists
        if (favorites.some(f => f.url === track.url)) {
            return { success: false, message: 'Already in favorites' };
        }
        
        favorites.unshift({
            url: track.url,
            title: track.title,
            author: track.author,
            duration: track.lengthSeconds,
            thumbnail: track.thumbnail,
            addedAt: Date.now()
        });
        
        // Limit size
        if (favorites.length > this.FAVORITES_MAX_SIZE) {
            favorites.pop();
        }
        
        this.userFavorites.set(userId, favorites);
        return { success: true, favorites };
    }

    /**
     * Remove from favorites
     */
    removeFavorite(userId, trackUrl) {
        const favorites = this.getFavorites(userId);
        const updated = favorites.filter(f => f.url !== trackUrl);
        this.userFavorites.set(userId, updated);
        return updated;
    }

    /**
     * Check if favorited
     */
    isFavorited(userId, trackUrl) {
        return this.getFavorites(userId).some(f => f.url === trackUrl);
    }

    // ========== LISTENING HISTORY ==========

    /**
     * Add to listening history
     */
    addToHistory(userId, track) {
        let history = this.listeningHistory.get(userId) || [];
        
        // Remove if exists (to move to front)
        history = history.filter(h => h.url !== track.url);
        
        history.unshift({
            url: track.url,
            title: track.title,
            author: track.author,
            duration: track.lengthSeconds,
            thumbnail: track.thumbnail,
            playedAt: Date.now()
        });
        
        // Limit size
        if (history.length > this.HISTORY_MAX_SIZE) {
            history = history.slice(0, this.HISTORY_MAX_SIZE);
        }
        
        this.listeningHistory.set(userId, history);
        return history;
    }

    /**
     * Get listening history
     */
    getHistory(userId, limit = 20) {
        const history = this.listeningHistory.get(userId) || [];
        return history.slice(0, limit);
    }

    /**
     * Clear listening history
     */
    clearHistory(userId) {
        this.listeningHistory.delete(userId);
    }

    // ========== RECENTLY PLAYED (Per Guild) ==========

    /**
     * Add to recently played
     */
    addToRecentlyPlayed(guildId, track) {
        let recent = this.recentlyPlayed.get(guildId) || [];
        
        recent = recent.filter(r => r.url !== track.url);
        recent.unshift({
            url: track.url,
            title: track.title,
            author: track.author,
            thumbnail: track.thumbnail,
            requestedBy: track.requestedBy?.id || 'Unknown',
            playedAt: Date.now()
        });
        
        if (recent.length > this.RECENTLY_PLAYED_MAX) {
            recent = recent.slice(0, this.RECENTLY_PLAYED_MAX);
        }
        
        this.recentlyPlayed.set(guildId, recent);
        return recent;
    }

    /**
     * Get recently played
     */
    getRecentlyPlayed(guildId, limit = 10) {
        const recent = this.recentlyPlayed.get(guildId) || [];
        return recent.slice(0, limit);
    }

    // ========== DJ LOCK ==========

    /**
     * Set DJ lock
     */
    setDJLock(guildId, enabled, djUserId = null) {
        this.djLockState.set(guildId, {
            enabled,
            djUserId,
            lockedAt: Date.now()
        });
    }

    /**
     * Get DJ lock state
     */
    getDJLock(guildId) {
        return this.djLockState.get(guildId) || { enabled: false, djUserId: null };
    }

    /**
     * Check if user is DJ or owner
     */
    isDJ(guildId, userId) {
        const lock = this.getDJLock(guildId);
        if (!lock.enabled) return true;
        return lock.djUserId === userId;
    }

    // ========== PLAYLIST CACHE ==========

    /**
     * Cache playlist
     */
    cachePlaylist(playlistUrl, playlistData) {
        this.playlistCache.set(playlistUrl, {
            ...playlistData,
            cachedAt: Date.now()
        });
    }

    /**
     * Get cached playlist
     */
    getCachedPlaylist(playlistUrl) {
        const cached = this.playlistCache.get(playlistUrl);
        if (!cached) return null;
        
        if (Date.now() - cached.cachedAt > this.PLAYLIST_CACHE_DURATION) {
            this.playlistCache.delete(playlistUrl);
            return null;
        }
        
        return cached;
    }

    // ========== NOW PLAYING MESSAGE ==========

    /**
     * Set now playing message
     */
    setNowPlayingMessage(guildId, message) {
        const queue = this.getQueue(guildId);
        if (!queue) return;
        
        queue.nowPlayingMessage = message;
        queue.updatedAt = Date.now();
    }

    /**
     * Get now playing message
     */
    getNowPlayingMessage(guildId) {
        return this.getQueue(guildId)?.nowPlayingMessage || null;
    }

    /**
     * Clear now playing message
     */
    async clearNowPlayingMessage(guildId) {
        const queue = this.getQueue(guildId);
        if (!queue || !queue.nowPlayingMessage) return;
        
        try {
            await queue.nowPlayingMessage.delete().catch(() => {});
        } catch (e) {}
        
        queue.nowPlayingMessage = null;
    }

    // ========== CLEANUP ==========

    _cleanup() {
        const now = Date.now();
        
        // Clean sessions
        for (const [key, value] of this.userSessions.entries()) {
            if (now - value.updatedAt > this.SESSION_DURATION) {
                this.userSessions.delete(key);
            }
        }
        
        // Clean playlist cache
        for (const [key, value] of this.playlistCache.entries()) {
            if (now - value.cachedAt > this.PLAYLIST_CACHE_DURATION) {
                this.playlistCache.delete(key);
            }
        }
        
        console.log(`[MusicCache] Cleanup complete. Queues: ${this.guildQueues.size}, Sessions: ${this.userSessions.size}`);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            queues: this.guildQueues.size,
            sessions: this.userSessions.size,
            preferences: this.userPreferences.size,
            favorites: this.userFavorites.size,
            history: this.listeningHistory.size,
            recentlyPlayed: this.recentlyPlayed.size,
            playlistCache: this.playlistCache.size,
            djLocks: this.djLockState.size
        };
    }

    /**
     * Full cleanup for guild
     */
    cleanupGuild(guildId) {
        this.deleteQueue(guildId);
        this.recentlyPlayed.delete(guildId);
        this.djLockState.delete(guildId);
    }
}

module.exports = new MusicCache();
