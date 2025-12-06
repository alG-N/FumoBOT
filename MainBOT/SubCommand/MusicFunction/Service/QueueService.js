const queueRepository = require('../Repository/QueueRepository');
const lavalinkService = require('./LavalinkService');
const { INACTIVITY_TIMEOUT } = require('../Configuration/MusicConfig');

class QueueService {
    getOrCreateQueue(guildId) {
        return queueRepository.getOrCreate(guildId);
    }

    getPlayer(guildId) {
        return lavalinkService.getPlayer(guildId);
    }

    getCurrentTrack(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.currentTrack || null;
    }

    getQueueList(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.tracks || [];
    }

    getQueueLength(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.tracks?.length || 0;
    }

    addTrack(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        queue.tracks.push(track);
        if (!queue.shuffle) {
            queue.originalTracks.push(track);
        }
        return queue.tracks.length;
    }

    removeTrack(guildId, index) {
        const queue = queueRepository.get(guildId);
        if (queue && queue.tracks[index]) {
            const removed = queue.tracks.splice(index, 1)[0];
            const originalIndex = queue.originalTracks.findIndex(t => t.url === removed.url);
            if (originalIndex !== -1) {
                queue.originalTracks.splice(originalIndex, 1);
            }
            return removed;
        }
        return null;
    }

    clearTracks(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue) {
            queue.tracks = [];
            queue.originalTracks = [];
            queue.currentTrack = null;
        }
    }

    nextTrack(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return null;

        const isLooped = queue.loop && queue.currentTrack;
        
        if (isLooped) {
            return queue.currentTrack;
        }

        queue.currentTrack = queue.tracks.shift() || null;
        return queue.currentTrack;
    }

    setCurrentTrack(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        queue.currentTrack = track;
    }

    toggleLoop(guildId) {
        const queue = this.getOrCreateQueue(guildId);
        queue.loop = !queue.loop;
        return queue.loop;
    }

    isLooping(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.loop || false;
    }

    setLoop(guildId, enabled) {
        const queue = this.getOrCreateQueue(guildId);
        queue.loop = enabled;
    }

    toggleShuffle(guildId) {
        const queue = this.getOrCreateQueue(guildId);
        queue.shuffle = !queue.shuffle;

        if (queue.shuffle) {
            queue.originalTracks = [...queue.tracks];
            queue.tracks = this.shuffleArray([...queue.tracks]);
        } else {
            queue.tracks = [...queue.originalTracks];
        }

        return queue.shuffle;
    }

    isShuffling(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.shuffle || false;
    }

    setShuffle(guildId, enabled) {
        const queue = this.getOrCreateQueue(guildId);
        if (queue.shuffle === enabled) return;

        queue.shuffle = enabled;

        if (enabled) {
            queue.originalTracks = [...queue.tracks];
            queue.tracks = this.shuffleArray([...queue.tracks]);
        } else {
            queue.tracks = [...queue.originalTracks];
        }
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    setInactivityTimer(guildId, callback) {
        const queue = this.getOrCreateQueue(guildId);
        
        if (queue.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
        }

        const player = this.getPlayer(guildId);
        if (!player || player.paused || !player.track) {
            queue.inactivityTimer = setTimeout(() => callback(guildId), INACTIVITY_TIMEOUT);
        }
    }

    clearInactivityTimer(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue?.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
            queue.inactivityTimer = null;
        }
    }

    setNowMessage(guildId, message) {
        const queue = this.getOrCreateQueue(guildId);
        queue.nowMessage = message;
    }

    getNowMessage(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.nowMessage || null;
    }

    clearNowMessage(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue) {
            queue.nowMessage = null;
        }
    }

    async disableNowMessageControls(guildId) {
        const { ActionRowBuilder, ButtonBuilder } = require('discord.js');
        const queue = queueRepository.get(guildId);
        
        if (queue?.nowMessage) {
            const disabledRows = queue.nowMessage.components?.map(row => {
                return ActionRowBuilder.from(row).setComponents(
                    row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
                );
            }) || [];
            
            await queue.nowMessage.edit({ components: disabledRows }).catch(() => {});
            queue.nowMessage = null;
        }
    }

    async cleanup(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return;

        this.clearInactivityTimer(guildId);
        
        if (queue._vcMonitor) {
            clearInterval(queue._vcMonitor);
            queue._vcMonitor = null;
        }

        lavalinkService.destroyPlayer(guildId);
        
        const PlaybackController = require('../Controller/PlaybackController');
        PlaybackController.unbindPlayerEvents(guildId);
        
        queue.loop = false;
        queue.shuffle = false;
        queue.tracks = [];
        queue.originalTracks = [];
        queue.currentTrack = null;
    }

    fullCleanup(guildId) {
        this.cleanup(guildId);
        queueRepository.delete(guildId);
    }
}

module.exports = new QueueService();