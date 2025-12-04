const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const voiceConnectionRepository = require('../Repository/VoiceConnectionRepository');
const { connectionOptions, connectionTimeout } = require('../Configuration/playerConfig');
const { VC_CHECK_INTERVAL } = require('../Configuration/MusicConfig');
const queueRepository = require('../Repository/QueueRepository');

class VoiceService {
    async connect(interaction, queue) {
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) {
            throw new Error("NO_VC");
        }

        if (!voiceConnectionRepository.hasConnection(queue)) {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                ...connectionOptions
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, connectionTimeout);
            } catch (error) {
                connection.destroy();
                throw new Error("CONNECTION_READY_TIMEOUT");
            }

            voiceConnectionRepository.setConnection(queue, connection);
            voiceConnectionRepository.subscribe(queue, queue.player);

            console.log('[VoiceService] Connected to voice channel');
        }

        return voiceConnectionRepository.getConnection(queue);
    }

    disconnect(queue) {
        voiceConnectionRepository.destroyConnection(queue);
        console.log('[VoiceService] Disconnected from voice channel');
    }

    isConnected(queue) {
        return voiceConnectionRepository.isConnected(queue);
    }

    getChannelId(queue) {
        return voiceConnectionRepository.getChannelId(queue);
    }

    monitorVoiceChannel(guildId, channel, queue, onEmpty) {
        if (queue._vcMonitor) {
            clearInterval(queue._vcMonitor);
        }

        queue._vcMonitor = setInterval(async () => {
            if (!queue.connection) return;

            const vcId = voiceConnectionRepository.getChannelId(queue);
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

    stopMonitoring(queue) {
        if (queue._vcMonitor) {
            clearInterval(queue._vcMonitor);
            queue._vcMonitor = null;
        }
    }

    getListenersCount(queue, guild) {
        const vcId = voiceConnectionRepository.getChannelId(queue);
        if (!vcId) return 0;

        const vc = guild.channels.cache.get(vcId);
        if (!vc) return 0;

        const listeners = Array.from(vc.members.values()).filter(m => !m.user.bot);
        return listeners.length;
    }

    getListeners(queue, guild) {
        const vcId = voiceConnectionRepository.getChannelId(queue);
        if (!vcId) return [];

        const vc = guild.channels.cache.get(vcId);
        if (!vc) return [];

        return Array.from(vc.members.values()).filter(m => !m.user.bot);
    }
}

module.exports = new VoiceService();