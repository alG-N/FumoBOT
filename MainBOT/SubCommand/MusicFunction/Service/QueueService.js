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
        const player = this.getPlayer(guildId);
        return player?.queue?.current || null;
    }

    getQueueList(guildId) {
        const player = this.getPlayer(guildId);
        return player?.queue || [];
    }

    getQueueLength(guildId) {
        const player = this.getPlayer(guildId);
        return player?.queue?.size || 0;
    }

    toggleLoop(guildId) {
        const queue = this.getOrCreateQueue(guildId);
        const player = this.getPlayer(guildId);
        
        queue.loop = !queue.loop;
        
        if (player) {
            // Kazagumo uses setLoop method
            player.setLoop(queue.loop ? 'queue' : 'none');
        }
        
        return queue.loop;
    }

    isLooping(guildId) {
        const queue = queueRepository.get(guildId);
        return queue?.loop || false;
    }

    setLoop(guildId, enabled) {
        const queue = this.getOrCreateQueue(guildId);
        const player = this.getPlayer(guildId);
        
        queue.loop = enabled;
        
        if (player) {
            player.setLoop(enabled ? 'queue' : 'none');
        }
    }

    setInactivityTimer(guildId, callback) {
        const queue = this.getOrCreateQueue(guildId);
        
        if (queue.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
        }

        const player = this.getPlayer(guildId);
        if (!player || !player.playing) {
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

        lavalinkService.destroyPlayer(guildId);
        
        queue.loop = false;
        queue._eventsBound = false;
    }

    fullCleanup(guildId) {
        this.cleanup(guildId);
        queueRepository.delete(guildId);
    }
}

module.exports = new QueueService();