const queueService = require('../Service/QueueService');
const lavalinkService = require('../Service/LavalinkService');
const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const ControlsController = require('./ControlsController');

class PlaybackController {
    bindPlayerEvents(guildId, interaction) {
        const manager = lavalinkService.getManager();
        const queue = queueService.getOrCreateQueue(guildId);
        
        if (queue._eventsBound) return;
        queue._eventsBound = true;

        const handleTrackStart = async (player, track) => {
            if (player.guildId !== guildId) return;

            const currentTrack = queueService.getCurrentTrack(guildId);
            if (!currentTrack) return;

            logger.log(`Now playing: ${currentTrack.title}`, interaction);
            queueService.clearInactivityTimer(guildId);

            await queueService.disableNowMessageControls(guildId);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: currentTrack.title,
                    url: currentTrack.url,
                    lengthSeconds: currentTrack.lengthSeconds,
                    thumbnail: currentTrack.thumbnail,
                    author: currentTrack.author,
                    requestedBy: currentTrack.requestedBy,
                    source: currentTrack.source
                },
                player.volume,
                currentTrack.requestedBy,
                player,
                queueService.isLooping(guildId)
            );

            const rows = ControlsController.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), currentTrack.url);

            const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
            queueService.setNowMessage(guildId, nowMessage);

            ControlsController.setupCollector(guildId, interaction, nowMessage);
        };

        const handleTrackEnd = async (player, track) => {
            if (player.guildId !== guildId) return;

            const currentTrack = queueService.getCurrentTrack(guildId);
            if (currentTrack) {
                logger.log(`Track ended: ${currentTrack.title}`, interaction);

                await interaction.channel.send({ 
                    embeds: [embedBuilder.buildSongFinishedEmbed({
                        title: currentTrack.title,
                        url: currentTrack.url
                    })] 
                });
            }

            const nextTrack = queueService.nextTrack(guildId);
            
            if (nextTrack) {
                await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
            } else {
                logger.log(`Queue finished`, interaction);

                await queueService.disableNowMessageControls(guildId);
                await interaction.channel.send({ embeds: [embedBuilder.buildQueueFinishedEmbed()] });

                queueService.setInactivityTimer(guildId, async (id) => {
                    await queueService.cleanup(id);
                    await interaction.channel.send({ embeds: [embedBuilder.buildDisconnectedEmbed()] });
                });
            }
        };

        const handleTrackException = async (player, data) => {
            if (player.guildId !== guildId) return;

            logger.error(`Track error: ${data.exception?.message}`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track error occurred. Skipping to next track…')]
            });

            const nextTrack = queueService.nextTrack(guildId);
            if (nextTrack) {
                await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
            }
        };

        const handleTrackStuck = async (player, data) => {
            if (player.guildId !== guildId) return;

            logger.warn(`Track stuck for ${data.thresholdMs}ms`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track stuck. Skipping to next…')]
            });

            const nextTrack = queueService.nextTrack(guildId);
            if (nextTrack) {
                await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
            }
        };

        manager.on('trackStart', handleTrackStart);
        manager.on('trackEnd', handleTrackEnd);
        manager.on('trackException', handleTrackException);
        manager.on('trackStuck', handleTrackStuck);
    }
}

module.exports = new PlaybackController();