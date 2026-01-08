/**
 * Music Service
 * Comprehensive music playback service combining queue, playback, and voice management
 */

const musicCache = require('../Repository/MusicCache');
const lavalinkService = require('./LavalinkService');
const trackHandler = require('../Handler/trackHandler');
const { INACTIVITY_TIMEOUT, VC_CHECK_INTERVAL, TRACK_TRANSITION_DELAY } = require('../Configuration/musicConfig');

class MusicService {
    constructor() {
        this.boundGuilds = new Set();
    }

    // ========== QUEUE OPERATIONS ==========

    /**
     * Get or create queue
     */
    getQueue(guildId) {
        return musicCache.getOrCreateQueue(guildId);
    }

    /**
     * Get queue list
     */
    getQueueList(guildId) {
        const queue = musicCache.getQueue(guildId);
        return queue?.tracks || [];
    }

    /**
     * Get queue length
     */
    getQueueLength(guildId) {
        return this.getQueueList(guildId).length;
    }

    /**
     * Get current track
     */
    getCurrentTrack(guildId) {
        return musicCache.getCurrentTrack(guildId);
    }

    /**
     * Add track to queue
     */
    addTrack(guildId, track) {
        return musicCache.addTrack(guildId, track);
    }

    /**
     * Add track to front (priority)
     */
    addTrackToFront(guildId, track) {
        return musicCache.addTrackToFront(guildId, track);
    }

    /**
     * Add multiple tracks
     */
    addTracks(guildId, tracks) {
        return musicCache.addTracks(guildId, tracks);
    }

    /**
     * Remove track at index
     */
    removeTrack(guildId, index) {
        return musicCache.removeTrack(guildId, index);
    }

    /**
     * Clear queue
     */
    clearQueue(guildId) {
        musicCache.clearTracks(guildId);
    }

    /**
     * Move track in queue
     */
    moveTrack(guildId, fromIndex, toIndex) {
        const queue = musicCache.getQueue(guildId);
        if (!queue || fromIndex < 0 || fromIndex >= queue.tracks.length) return false;
        if (toIndex < 0 || toIndex >= queue.tracks.length) return false;
        
        const [track] = queue.tracks.splice(fromIndex, 1);
        queue.tracks.splice(toIndex, 0, track);
        return true;
    }

    // ========== PLAYBACK CONTROL ==========

    /**
     * Play track
     */
    async playTrack(guildId, track) {
        const player = lavalinkService.getPlayer(guildId);
        if (!player || !track?.track?.encoded) {
            throw new Error('NO_PLAYER');
        }

        musicCache.setCurrentTrack(guildId, track);
        
        // Shoukaku expects { track: { encoded: "..." } }
        await player.playTrack({ track: { encoded: track.track.encoded } });
        this.clearInactivityTimer(guildId);
        
        return track;
    }

    /**
     * Play next track from queue
     */
    async playNext(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (!queue) return null;
        
        // Handle loop mode
        if (queue.loopMode === 'track' && queue.currentTrack) {
            await this.playTrack(guildId, queue.currentTrack);
            return queue.currentTrack;
        }
        
        // Get next track
        let nextTrack = musicCache.getNextTrack(guildId);
        
        // If queue loop, add current track back to end
        if (queue.loopMode === 'queue' && queue.currentTrack) {
            musicCache.addTrack(guildId, queue.currentTrack);
        }
        
        if (!nextTrack) {
            // Queue empty
            await this.handleQueueEnd(guildId);
            return null;
        }
        
        await this.playTrack(guildId, nextTrack);
        return nextTrack;
    }

    /**
     * Skip current track
     */
    async skip(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        if (!player) return null;
        
        // Clear skip votes
        musicCache.endSkipVote(guildId);
        
        // Get next track from queue
        const nextTrack = musicCache.getNextTrack(guildId);
        
        if (nextTrack && nextTrack.track?.encoded) {
            // Set the new current track
            musicCache.setCurrentTrack(guildId, nextTrack);
            // Play the next track (this will trigger 'replaced' reason for current track)
            await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
            return nextTrack;
        } else {
            // No next track, stop playback
            musicCache.setCurrentTrack(guildId, null);
            await player.stopTrack();
            return null;
        }
    }

    /**
     * Pause/Resume
     */
    async togglePause(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        if (!player) return false;
        
        const isPaused = musicCache.togglePause(guildId);
        await player.setPaused(isPaused);
        
        if (isPaused) {
            this.setInactivityTimer(guildId, () => this.cleanup(guildId));
        } else {
            this.clearInactivityTimer(guildId);
        }
        
        return isPaused;
    }

    /**
     * Set paused state
     */
    async setPaused(guildId, paused) {
        const player = lavalinkService.getPlayer(guildId);
        if (!player) return;
        
        const queue = musicCache.getQueue(guildId);
        if (queue) {
            queue.isPaused = paused;
        }
        
        await player.setPaused(paused);
    }

    /**
     * Stop playback
     */
    async stop(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        if (player) {
            await player.stopTrack();
        }
        
        musicCache.clearTracks(guildId);
        musicCache.setCurrentTrack(guildId, null);
        musicCache.endSkipVote(guildId);
    }

    // ========== LOOP & SHUFFLE ==========

    /**
     * Toggle loop mode
     */
    toggleLoop(guildId) {
        return musicCache.cycleLoopMode(guildId);
    }

    /**
     * Set loop mode
     */
    setLoopMode(guildId, mode) {
        musicCache.setLoopMode(guildId, mode);
    }

    /**
     * Get loop mode
     */
    getLoopMode(guildId) {
        const queue = musicCache.getQueue(guildId);
        return queue?.loopMode || 'off';
    }

    /**
     * Toggle shuffle
     */
    toggleShuffle(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (!queue) return false;
        
        if (queue.isShuffled) {
            musicCache.unshuffleQueue(guildId);
        } else {
            musicCache.shuffleQueue(guildId);
        }
        
        return queue.isShuffled;
    }

    /**
     * Is shuffled
     */
    isShuffled(guildId) {
        return musicCache.getQueue(guildId)?.isShuffled || false;
    }

    // ========== VOLUME CONTROL ==========

    /**
     * Set volume
     */
    async setVolume(guildId, volume) {
        const player = lavalinkService.getPlayer(guildId);
        if (!player) return 100;
        
        const clampedVolume = Math.max(0, Math.min(200, volume));
        musicCache.setVolume(guildId, clampedVolume);
        
        // Shoukaku setGlobalVolume: 100 = 100% volume, 200 = 200% volume
        await player.setGlobalVolume(clampedVolume);
        
        return clampedVolume;
    }

    /**
     * Get volume
     */
    getVolume(guildId) {
        return musicCache.getQueue(guildId)?.volume || 100;
    }

    /**
     * Adjust volume by delta
     */
    async adjustVolume(guildId, delta) {
        const currentVolume = this.getVolume(guildId);
        return this.setVolume(guildId, currentVolume + delta);
    }

    // ========== VOICE CONNECTION ==========

    /**
     * Connect to voice channel
     */
    async connect(interaction) {
        const guildId = interaction.guild.id;
        const voiceChannel = interaction.member.voice?.channel;
        
        if (!voiceChannel) {
            throw new Error('NO_VOICE_CHANNEL');
        }
        
        let player = lavalinkService.getPlayer(guildId);
        
        if (!player) {
            player = await lavalinkService.createPlayer(
                guildId,
                voiceChannel.id,
                interaction.channel.id
            );
            
            // Setup event bindings
            this.bindPlayerEvents(guildId, interaction);
        }
        
        // Update queue with channel info (both ID and object for sending messages)
        const queue = musicCache.getOrCreateQueue(guildId);
        queue.voiceChannelId = voiceChannel.id;
        queue.textChannelId = interaction.channel.id;
        queue.textChannel = interaction.channel; // Store the actual channel object
        
        return player;
    }

    /**
     * Disconnect from voice
     */
    disconnect(guildId) {
        this.unbindPlayerEvents(guildId);
        lavalinkService.destroyPlayer(guildId);
    }

    /**
     * Check if connected
     */
    isConnected(guildId) {
        return !!lavalinkService.getPlayer(guildId);
    }

    /**
     * Get voice channel ID
     */
    getVoiceChannelId(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        return player?.connection?.channelId || null;
    }

    // ========== PLAYER EVENTS ==========

    /**
     * Bind player events
     */
    bindPlayerEvents(guildId, interaction) {
        if (this.boundGuilds.has(guildId)) return;
        
        const player = lavalinkService.getPlayer(guildId);
        if (!player) return;
        
        this.boundGuilds.add(guildId);
        
        const queue = musicCache.getQueue(guildId);
        if (queue) {
            queue.eventsBound = true;
            queue.textChannel = interaction.channel; // Store channel for sending messages
        }
        
        player.on('start', async () => {
            this.clearInactivityTimer(guildId);
            // Embeds handled by command handlers, not here
        });
        
        player.on('end', async (data) => {
            if (data.reason === 'replaced') return; // Skip was pressed
            if (data.reason === 'stopped') return;
            
            const queue = musicCache.getQueue(guildId);
            // Prevent multiple handlers from running
            if (queue?.isTransitioning) return;
            if (queue) queue.isTransitioning = true;
            
            try {
                await this.disableNowPlayingControls(guildId);
                await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                
                const nextTrack = await this.playNext(guildId);
                if (nextTrack) {
                    await this.sendNowPlayingEmbed(guildId);
                }
            } finally {
                if (queue) queue.isTransitioning = false;
            }
        });
        
        player.on('exception', async (data) => {
            console.error(`[MusicService] Track exception:`, data?.message || data);
            const queue = musicCache.getQueue(guildId);
            if (queue?.isTransitioning) return;
            if (queue) queue.isTransitioning = true;
            
            try {
                await this.playNext(guildId);
            } finally {
                if (queue) queue.isTransitioning = false;
            }
        });
        
        player.on('stuck', async () => {
            const queue = musicCache.getQueue(guildId);
            if (queue?.isTransitioning) return;
            if (queue) queue.isTransitioning = true;
            
            try {
                await this.playNext(guildId);
            } finally {
                if (queue) queue.isTransitioning = false;
            }
        });
        
        player.on('closed', async () => {
            await this.cleanup(guildId);
        });
    }

    /**
     * Unbind player events
     */
    unbindPlayerEvents(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        if (player) {
            player.removeAllListeners();
        }
        
        this.boundGuilds.delete(guildId);
        
        const queue = musicCache.getQueue(guildId);
        if (queue) queue.eventsBound = false;
    }

    // ========== INACTIVITY MANAGEMENT ==========

    /**
     * Set inactivity timer
     */
    setInactivityTimer(guildId, callback) {
        this.clearInactivityTimer(guildId);
        
        const queue = musicCache.getQueue(guildId);
        if (!queue) return;
        
        queue.inactivityTimer = setTimeout(() => {
            callback();
        }, INACTIVITY_TIMEOUT);
    }

    /**
     * Clear inactivity timer
     */
    clearInactivityTimer(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (queue?.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
            queue.inactivityTimer = null;
        }
    }

    // ========== VOICE CHANNEL MONITORING ==========

    /**
     * Start voice channel monitoring
     */
    startVCMonitor(guildId, guild) {
        const queue = musicCache.getQueue(guildId);
        if (!queue || queue.vcMonitorInterval) return;
        
        queue.vcMonitorInterval = setInterval(async () => {
            const vcId = this.getVoiceChannelId(guildId);
            if (!vcId) {
                this.stopVCMonitor(guildId);
                return;
            }
            
            const channel = guild.channels.cache.get(vcId);
            if (!channel) {
                await this.cleanup(guildId);
                return;
            }
            
            // Count non-bot members
            const listeners = channel.members.filter(m => !m.user.bot).size;
            
            if (listeners === 0) {
                await this.cleanup(guildId);
            }
        }, VC_CHECK_INTERVAL);
    }

    /**
     * Stop voice channel monitoring
     */
    stopVCMonitor(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (queue?.vcMonitorInterval) {
            clearInterval(queue.vcMonitorInterval);
            queue.vcMonitorInterval = null;
        }
    }

    /**
     * Get listener count
     */
    getListenerCount(guildId, guild) {
        const vcId = this.getVoiceChannelId(guildId);
        if (!vcId) return 0;
        
        const channel = guild.channels.cache.get(vcId);
        if (!channel) return 0;
        
        return channel.members.filter(m => !m.user.bot).size;
    }

    /**
     * Get listeners
     */
    getListeners(guildId, guild) {
        const vcId = this.getVoiceChannelId(guildId);
        if (!vcId) return [];
        
        const channel = guild.channels.cache.get(vcId);
        if (!channel) return [];
        
        return Array.from(channel.members.filter(m => !m.user.bot).values());
    }

    // ========== QUEUE END HANDLING ==========

    /**
     * Handle queue end
     */
    async handleQueueEnd(guildId) {
        musicCache.setCurrentTrack(guildId, null);
        
        // Disable old now playing buttons
        await this.disableNowPlayingControls(guildId);
        
        // Send queue finished message
        const queue = musicCache.getQueue(guildId);
        if (queue?.textChannel) {
            const finishedEmbed = trackHandler.createQueueFinishedEmbed?.() || 
                trackHandler.createInfoEmbed?.('Queue Finished', 'All songs have been played!') ||
                { description: '✅ Queue finished! Add more songs to keep the party going.' };
            
            await queue.textChannel.send({ embeds: [finishedEmbed] }).catch(() => {});
        }
        
        // Set inactivity timer
        this.setInactivityTimer(guildId, () => this.cleanup(guildId));
    }

    // ========== CLEANUP ==========

    /**
     * Full cleanup
     */
    async cleanup(guildId) {
        // Clear now playing message
        await musicCache.clearNowPlayingMessage(guildId);
        
        // Stop monitoring
        this.stopVCMonitor(guildId);
        
        // Clear timers
        this.clearInactivityTimer(guildId);
        
        // Unbind events
        this.unbindPlayerEvents(guildId);
        
        // Disconnect
        this.disconnect(guildId);
        
        // Delete queue
        musicCache.deleteQueue(guildId);
    }

    // ========== VOTING ==========

    /**
     * Start skip vote
     */
    startSkipVote(guildId, userId, listenerCount) {
        return musicCache.startSkipVote(guildId, userId, listenerCount);
    }

    /**
     * Add skip vote
     */
    addSkipVote(guildId, userId) {
        return musicCache.addSkipVote(guildId, userId);
    }

    /**
     * End skip vote
     */
    endSkipVote(guildId) {
        return musicCache.endSkipVote(guildId);
    }

    /**
     * Check if enough skip votes
     */
    hasEnoughSkipVotes(guildId) {
        return musicCache.hasEnoughSkipVotes(guildId);
    }

    /**
     * Is skip vote active
     */
    isSkipVoteActive(guildId) {
        return musicCache.getQueue(guildId)?.skipVoteActive || false;
    }

    // ========== NOW PLAYING MESSAGE ==========

    /**
     * Set now playing message
     */
    setNowPlayingMessage(guildId, message) {
        musicCache.setNowPlayingMessage(guildId, message);
    }

    /**
     * Get now playing message
     */
    getNowPlayingMessage(guildId) {
        return musicCache.getNowPlayingMessage(guildId);
    }

    /**
     * Update now playing message
     */
    async updateNowPlayingMessage(guildId, payload) {
        const message = this.getNowPlayingMessage(guildId);
        if (!message) return null;
        
        try {
            await message.edit(payload);
            return message;
        } catch (error) {
            console.error(`[MusicService] Failed to update now playing message:`, error);
            return null;
        }
    }

    /**
     * Disable now playing controls
     */
    async disableNowPlayingControls(guildId) {
        const message = this.getNowPlayingMessage(guildId);
        if (!message?.components) return;
        
        try {
            const disabledRows = message.components.map(row => ({
                type: row.type,
                components: row.components.map(c => ({
                    ...c.data,
                    disabled: true
                }))
            }));
            
            await message.edit({ components: disabledRows });
        } catch (error) {
            console.error(`[MusicService] Failed to disable controls:`, error);
        }
    }

    /**
     * Send new now playing embed when track starts
     */
    async sendNowPlayingEmbed(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (!queue?.textChannel) return;
        
        const currentTrack = this.getCurrentTrack(guildId);
        if (!currentTrack) return;
        
        try {
            // Disable old now playing controls first
            await this.disableNowPlayingControls(guildId);
            
            const queueList = this.getQueueList(guildId);
            
            const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                volume: this.getVolume(guildId),
                isPaused: queue.isPaused || false,
                loopMode: this.getLoopMode(guildId),
                isShuffled: this.isShuffled(guildId),
                queueLength: queueList.length,
                nextTrack: queueList[0] || null
            });
            
            const rows = trackHandler.createControlButtons(guildId, {
                isPaused: queue.isPaused || false,
                loopMode: this.getLoopMode(guildId),
                isShuffled: this.isShuffled(guildId),
                trackUrl: currentTrack.url,
                userId: currentTrack.requestedBy?.id || ''
            });
            
            const nowMessage = await queue.textChannel.send({ embeds: [embed], components: rows });
            this.setNowPlayingMessage(guildId, nowMessage);
        } catch (error) {
            // Silent fail - embed sending is best effort
        }
    }

    // ========== FAVORITES ==========

    addFavorite(userId, track) {
        return musicCache.addFavorite(userId, track);
    }

    removeFavorite(userId, trackUrl) {
        return musicCache.removeFavorite(userId, trackUrl);
    }

    getFavorites(userId) {
        return musicCache.getFavorites(userId);
    }

    isFavorited(userId, trackUrl) {
        return musicCache.isFavorited(userId, trackUrl);
    }

    // ========== HISTORY ==========

    addToHistory(userId, track) {
        return musicCache.addToHistory(userId, track);
    }

    getHistory(userId, limit) {
        return musicCache.getHistory(userId, limit);
    }

    clearHistory(userId) {
        musicCache.clearHistory(userId);
    }

    // ========== PREFERENCES ==========

    getPreferences(userId) {
        return musicCache.getPreferences(userId);
    }

    setPreferences(userId, prefs) {
        return musicCache.setPreferences(userId, prefs);
    }

    // ========== RECENTLY PLAYED ==========

    getRecentlyPlayed(guildId, limit) {
        return musicCache.getRecentlyPlayed(guildId, limit);
    }

    // ========== SEARCH ==========

    /**
     * Search for track
     */
    async search(query, requester) {
        return lavalinkService.search(query, requester);
    }

    /**
     * Search for playlist
     */
    async searchPlaylist(query, requester) {
        return lavalinkService.searchPlaylist(query, requester);
    }

    // ========== UTILITIES ==========

    /**
     * Get player
     */
    getPlayer(guildId) {
        return lavalinkService.getPlayer(guildId);
    }

    /**
     * Check if Lavalink is ready
     */
    isLavalinkReady() {
        return lavalinkService.isReady;
    }

    /**
     * Get queue state
     */
    getQueueState(guildId) {
        const queue = musicCache.getQueue(guildId);
        if (!queue) return null;
        
        return {
            currentTrack: queue.currentTrack,
            queueLength: queue.tracks.length,
            isPaused: queue.isPaused,
            loopMode: queue.loopMode,
            isShuffled: queue.isShuffled,
            volume: queue.volume,
            voiceChannelId: queue.voiceChannelId,
            textChannelId: queue.textChannelId
        };
    }

    /**
     * Get cache stats
     */
    getStats() {
        return musicCache.getStats();
    }
}

module.exports = new MusicService();
