const queueRepository = require('../Repository/QueueRepository');
const trackRepository = require('../Repository/TrackRepository');
const audioPlayerService = require('./AudioPlayerService');
const voiceConnectionRepository = require('../Repository/VoiceConnectionRepository');
const { INACTIVITY_TIMEOUT } = require('../Configuration/MusicConfig');

class QueueService {
    getOrCreateQueue(guildId) {
        return queueRepository.getOrCreate(guildId);
    }

    addTrack(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        return trackRepository.enqueue(queue, track);
    }

    getNextTrack(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return null;
        return trackRepository.dequeue(queue);
    }

    getCurrentTrack(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return null;
        return trackRepository.getCurrentTrack(queue);
    }

    setCurrentTrack(guildId, track) {
        const queue = this.getOrCreateQueue(guildId);
        trackRepository.setCurrentTrack(queue, track);
        queue.startTime = Date.now();
    }

    clearCurrentTrack(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue) {
            trackRepository.setCurrentTrack(queue, null);
            queue.startTime = null;
        }
    }

    getQueueList(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return [];
        return trackRepository.getQueue(queue);
    }

    getQueueLength(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return 0;
        return trackRepository.getQueueLength(queue);
    }

    clearQueue(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue) {
            trackRepository.clearQueue(queue);
        }
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

    requeueCurrentTrack(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue || !queue.current) return false;
        
        trackRepository.insertTrackAtPosition(queue, queue.current, 0);
        return true;
    }

    setInactivityTimer(guildId, callback) {
        const queue = this.getOrCreateQueue(guildId);
        
        if (queue.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
        }

        if (!audioPlayerService.isPlaying(queue) && !audioPlayerService.isPaused(queue)) {
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

    cleanup(guildId) {
        const queue = queueRepository.get(guildId);
        if (!queue) return;

        this.clearInactivityTimer(guildId);
        
        if (queue._vcMonitor) {
            clearInterval(queue._vcMonitor);
            queue._vcMonitor = null;
        }

        audioPlayerService.killYtdlpProcess(queue);
        audioPlayerService.stop(queue);
        voiceConnectionRepository.destroyConnection(queue);
        
        trackRepository.clearQueue(queue);
        trackRepository.setCurrentTrack(queue, null);
        queue.loop = false;
        queue._eventsBound = false;
    }

    fullCleanup(guildId) {
        this.cleanup(guildId);
        queueRepository.delete(guildId);
    }
}

module.exports = new QueueService();