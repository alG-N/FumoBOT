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
        return queue.tracks.length;
    }

    removeTrack(guildId, index) {
        const queue = queueRepository.get(guildId);
        if (queue && queue.tracks[index]) {
            return queue.tracks.splice(index, 1)[0];
        }
        return null;
    }

    clearTracks(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue) {
            queue.tracks = [];
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
        queue.tracks = [];
        queue.currentTrack = null;
    }

    fullCleanup(guildId) {
        this.cleanup(guildId);
        queueRepository.delete(guildId);
    }
}

module.exports = new QueueService();