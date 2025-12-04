const { AudioPlayerStatus } = require("@discordjs/voice");
const queueService = require('../Service/QueueService');
const audioPlayerService = require('../Service/AudioPlayerService');
const streamService = require('../Service/StreamService');
const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const ControlsController = require('./ControlsController');
const { PLAYBACK_DELAY } = require('../Configuration/MusicConfig');

class PlaybackController {
    async playNext(interaction, guildId) {
        const queue = queueService.getOrCreateQueue(guildId);

        audioPlayerService.killYtdlpProcess(queue);

        if (queue.current || audioPlayerService.isPlaying(queue)) {
            return;
        }

        const track = queueService.getNextTrack(guildId);
        if (!track) {
            return;
        }

        queueService.setCurrentTrack(guildId, track);

        let resource;
        try {
            resource = await streamService.createStream(track, queue);
        } catch (e) {
            console.error(`[PlaybackController] Stream creation failed: ${e.message}`);
            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed("Could not play this track. Skipping...")]
            });
            queueService.clearCurrentTrack(guildId);
            
            if (queueService.getQueueLength(guildId) > 0) {
                setTimeout(() => this.playNext(interaction, guildId), 1000);
            }
            return;
        }

        if (!resource) {
            console.error("[PlaybackController] No resource created, aborting playback.");
            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed("Could not play this track. Skipping...")]
            });
            queueService.clearCurrentTrack(guildId);
            
            if (queueService.getQueueLength(guildId) > 0) {
                setTimeout(() => this.playNext(interaction, guildId), 1000);
            }
            return;
        }

        audioPlayerService.play(queue, resource);

        await queueService.disableNowMessageControls(guildId);

        const embed = embedBuilder.buildNowPlayingEmbed(
            track,
            audioPlayerService.getVolume(queue) * 100,
            track.requestedBy,
            queue,
            queueService.isLooping(guildId)
        );

        const rows = ControlsController.buildControlRows(guildId, false, queueService.isLooping(guildId), track.url);

        const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
        queueService.setNowMessage(guildId, nowMessage);

        ControlsController.setupCollector(queue, guildId, interaction, nowMessage);

        logger.log(`Now playing: ${track.title}`, interaction);
    }

    bindPlayerEvents(queue, guildId, interaction) {
        const self = this;
        
        audioPlayerService.bindEvents(queue, guildId, {
            onIdle: async (gid) => {
                logger.log(`[player] Status: Idle`, interaction);

                audioPlayerService.killYtdlpProcess(queue);

                const currentTrack = queueService.getCurrentTrack(gid);

                if (queueService.isLooping(gid) && currentTrack) {
                    queueService.requeueCurrentTrack(gid);
                    await queueService.disableNowMessageControls(gid);

                    const embed = embedBuilder.buildNowPlayingEmbed(
                        currentTrack,
                        audioPlayerService.getVolume(queue) * 100,
                        currentTrack.requestedBy,
                        queue,
                        queueService.isLooping(gid)
                    );

                    const rows = ControlsController.buildControlRows(gid, false, queueService.isLooping(gid), currentTrack.url);
                    const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
                    queueService.setNowMessage(gid, nowMessage);

                    await interaction.channel.send({ embeds: [embedBuilder.buildSongFinishedEmbed(currentTrack)] });
                    ControlsController.setupCollector(queue, gid, interaction, nowMessage);
                } else if (currentTrack) {
                    await interaction.channel.send({ embeds: [embedBuilder.buildSongFinishedEmbed(currentTrack)] });
                }

                queueService.clearCurrentTrack(gid);

                if (queueService.getQueueLength(gid) > 0) {
                    setTimeout(() => self.playNext(interaction, gid), PLAYBACK_DELAY);
                } else {
                    await queueService.disableNowMessageControls(gid);
                    await interaction.channel.send({ embeds: [embedBuilder.buildQueueFinishedEmbed()] });
                    queueService.setInactivityTimer(gid, async (id) => {
                        await queueService.cleanup(id);
                        await interaction.channel.send({ embeds: [embedBuilder.buildDisconnectedEmbed()] });
                    });
                }
            },

            onPlaying: (gid) => {
                logger.log(`[player] Status: Playing`, interaction);
                queueService.clearInactivityTimer(gid);
            },

            onPaused: (gid) => {
                logger.log(`[player] Status: Paused`, interaction);
                queueService.clearInactivityTimer(gid);
            },

            onError: async (gid, error) => {
                logger.error(`[player] Error: ${error}`, interaction);
                const nowMessage = queueService.getNowMessage(gid);
                if (nowMessage) {
                    await nowMessage.reply({ 
                        embeds: [embedBuilder.buildErrorEmbed("Skipping to the next track…")] 
                    }).catch(() => {});
                }
                audioPlayerService.stop(queue);
            }
        });
    }
}

module.exports = new PlaybackController();