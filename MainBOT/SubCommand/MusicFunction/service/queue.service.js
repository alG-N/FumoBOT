/**
 * Queue Service
 * Manages guild-specific queue data and operations
 */

const config = require('../config/music.config');
const logger = require('../utils/logger.util');

class QueueService {
    constructor() {
        this.queues = new Map();
    }

    /**
     * Get or create queue for a guild
     */
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                tracks: [],
                loop: false,
                loopQueue: false,
                skipVotes: new Set(),
                skipVoting: false,
                skipVotingTimeout: null,
                skipVotingMsg: null,
                inactivityTimer: null,
                vcMonitor: null,
                nowPlayingMessage: null,
                volume: config.player.defaultVolume,
            });
        }
        return this.queues.get(guildId);
    }

    /**
     * Add track(s) to queue
     */
    addTrack(guildId, track) {
        const queue = this.getQueue(guildId);
        
        if (queue.tracks.length >= config.player.maxQueueSize) {
            throw new Error('QUEUE_FULL');
        }

        queue.tracks.push(track);
        return queue.tracks.length;
    }

    /**
     * Add multiple tracks to queue
     */
    addTracks(guildId, tracks) {
        const queue = this.getQueue(guildId);
        const remaining = config.player.maxQueueSize - queue.tracks.length;
        
        if (remaining <= 0) {
            throw new Error('QUEUE_FULL');
        }

        const toAdd = tracks.slice(0, remaining);
        queue.tracks.push(...toAdd);
        
        return {
            added: toAdd.length,
            skipped: tracks.length - toAdd.length,
        };
    }

    /**
     * Get current queue
     */
    getTracks(guildId) {
        const queue = this.getQueue(guildId);
        return [...queue.tracks];
    }

    /**
     * Clear queue
     */
    clearQueue(guildId) {
        const queue = this.getQueue(guildId);
        const length = queue.tracks.length;
        queue.tracks = [];
        return length;
    }

    /**
     * Remove track at index
     */
    removeTrack(guildId, index) {
        const queue = this.getQueue(guildId);
        if (index < 0 || index >= queue.tracks.length) {
            throw new Error('INVALID_INDEX');
        }
        const removed = queue.tracks.splice(index, 1)[0];
        return removed;
    }

    /**
     * Shuffle queue
     */
    shuffle(guildId) {
        const queue = this.getQueue(guildId);
        for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
        }
    }

    /**
     * Toggle loop mode
     */
    toggleLoop(guildId) {
        const queue = this.getQueue(guildId);
        queue.loop = !queue.loop;
        return queue.loop;
    }

    /**
     * Toggle queue loop mode
     */
    toggleQueueLoop(guildId) {
        const queue = this.getQueue(guildId);
        queue.loopQueue = !queue.loopQueue;
        return queue.loopQueue;
    }

    /**
     * Get loop status
     */
    getLoopStatus(guildId) {
        const queue = this.getQueue(guildId);
        return {
            loop: queue.loop,
            loopQueue: queue.loopQueue,
        };
    }

    /**
     * Set volume
     */
    setVolume(guildId, volume) {
        const queue = this.getQueue(guildId);
        queue.volume = Math.max(
            config.player.minVolume,
            Math.min(config.player.maxVolume, volume)
        );
        return queue.volume;
    }

    /**
     * Get volume
     */
    getVolume(guildId) {
        const queue = this.getQueue(guildId);
        return queue.volume;
    }

    /**
     * Start skip voting
     */
    startSkipVote(guildId, userId, message) {
        const queue = this.getQueue(guildId);
        
        if (queue.skipVoting) {
            throw new Error('VOTE_IN_PROGRESS');
        }

        queue.skipVoting = true;
        queue.skipVotes = new Set([userId]);
        queue.skipVotingMsg = message;

        return queue.skipVotes.size;
    }

    /**
     * Add skip vote
     */
    addSkipVote(guildId, userId) {
        const queue = this.getQueue(guildId);
        
        if (!queue.skipVoting) {
            throw new Error('NO_VOTE_IN_PROGRESS');
        }

        if (queue.skipVotes.has(userId)) {
            throw new Error('ALREADY_VOTED');
        }

        queue.skipVotes.add(userId);
        return queue.skipVotes.size;
    }

    /**
     * Clear skip voting
     */
    clearSkipVote(guildId) {
        const queue = this.getQueue(guildId);
        
        if (queue.skipVotingTimeout) {
            clearTimeout(queue.skipVotingTimeout);
            queue.skipVotingTimeout = null;
        }

        queue.skipVoting = false;
        queue.skipVotes.clear();
        queue.skipVotingMsg = null;
    }

    /**
     * Check if enough votes to skip
     */
    hasEnoughVotes(guildId) {
        const queue = this.getQueue(guildId);
        return queue.skipVotes.size >= config.voting.requiredVotes;
    }

    /**
     * Clean up queue data
     */
    cleanup(guildId) {
        const queue = this.queues.get(guildId);
        
        if (queue) {
            // Clear timers
            if (queue.inactivityTimer) {
                clearTimeout(queue.inactivityTimer);
            }
            if (queue.vcMonitor) {
                clearInterval(queue.vcMonitor);
            }
            if (queue.skipVotingTimeout) {
                clearTimeout(queue.skipVotingTimeout);
            }

            // Delete queue
            this.queues.delete(guildId);
            logger.debug(`Queue cleaned up for guild ${guildId}`);
        }
    }

    /**
     * Set now playing message
     */
    setNowPlayingMessage(guildId, message) {
        const queue = this.getQueue(guildId);
        queue.nowPlayingMessage = message;
    }

    /**
     * Get now playing message
     */
    getNowPlayingMessage(guildId) {
        const queue = this.getQueue(guildId);
        return queue.nowPlayingMessage;
    }
}

module.exports = new QueueService();