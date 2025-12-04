const lavalinkService = require('./LavalinkService');
const { VC_CHECK_INTERVAL } = require('../Configuration/MusicConfig');
const queueRepository = require('../Repository/QueueRepository');

class VoiceService {
    async connect(interaction, guildId) {
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) {
            throw new Error('NO_VC');
        }

        let player = lavalinkService.getPlayer(guildId);
        
        if (!player) {
            player = await lavalinkService.createPlayer(
                guildId,
                voiceChannel.id,
                interaction.channel.id
            );
        } else {
            // Update voice channel if changed
            if (player.voiceId !== voiceChannel.id) {
                player.setVoiceChannel(voiceChannel.id);
            }
        }

        return player;
    }

    disconnect(guildId) {
        lavalinkService.destroyPlayer(guildId);
        console.log('[VoiceService] Disconnected from voice channel');
    }

    isConnected(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        return player?.state === 'CONNECTED' || false;
    }

    getChannelId(guildId) {
        const player = lavalinkService.getPlayer(guildId);
        return player?.voiceId || null;
    }

    monitorVoiceChannel(guildId, channel, onEmpty) {
        const queue = queueRepository.getOrCreate(guildId);
        
        if (queue._vcMonitor) {
            clearInterval(queue._vcMonitor);
        }

        queue._vcMonitor = setInterval(async () => {
            const player = lavalinkService.getPlayer(guildId);
            if (!player || player.state !== 'CONNECTED') return;

            const vcId = player.voiceId;
            const vc = channel.guild.channels.cache.get(vcId);
            
            if (!vc) return;

            const listeners = Array.from(vc.members.values()).filter(m => !m.user.bot);
            
            if (listeners.length === 0) {
                console.log(`[VoiceService] No users in VC, disconnecting`);
                
                if (queue._vcMonitor) {
                    clearInterval(queue._vcMonitor);
                    queue._vcMonitor = null;
                }

                if (typeof onEmpty === 'function') {
                    await onEmpty(guildId);
                }
            }
        }, VC_CHECK_INTERVAL);
    }

    stopMonitoring(guildId) {
        const queue = queueRepository.get(guildId);
        if (queue?._vcMonitor) {
            clearInterval(queue._vcMonitor);
            queue._vcMonitor = null;
        }
    }

    getListenersCount(guildId, guild) {
        const player = lavalinkService.getPlayer(guildId);
        const vcId = player?.voiceId;
        if (!vcId) return 0;

        const vc = guild.channels.cache.get(vcId);
        if (!vc) return 0;

        const listeners = Array.from(vc.members.values()).filter(m => !m.user.bot);
        return listeners.length;
    }

    getListeners(guildId, guild) {
        const player = lavalinkService.getPlayer(guildId);
        const vcId = player?.voiceId;
        if (!vcId) return [];

        const vc = guild.channels.cache.get(vcId);
        if (!vc) return [];

        return Array.from(vc.members.values()).filter(m => !m.user.bot);
    }
}

module.exports = new VoiceService();