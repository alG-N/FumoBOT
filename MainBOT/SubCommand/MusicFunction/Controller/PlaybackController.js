const queueService = require('../Service/QueueService');
const lavalinkService = require('../Service/LavalinkService');
const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const ControlsController = require('./ControlsController');

class PlaybackController {
    constructor() {
        this.boundGuilds = new Set();
    }

    bindPlayerEvents(guildId, interaction) {
        console.log(`[PlaybackController] Attempting to bind events for guild ${guildId}`);
        console.log(`[PlaybackController] Already bound?`, this.boundGuilds.has(guildId));
        
        if (this.boundGuilds.has(guildId)) {
            console.log(`[PlaybackController] Events already bound for guild ${guildId}, skipping`);
            return;
        }
        
        this.boundGuilds.add(guildId);
        console.log(`[PlaybackController] Added guild ${guildId} to bound set`);

        const manager = lavalinkService.getManager();
        console.log(`[PlaybackController] Manager exists?`, !!manager);

        const handleTrackStart = async (player, track) => {
            console.log(`[PlaybackController] trackStart event fired for guild ${player.guildId}`);
            console.log(`[PlaybackController] Target guild: ${guildId}, Event guild: ${player.guildId}`);
            console.log(`[PlaybackController] Match?`, player.guildId === guildId);
            
            if (player.guildId !== guildId) return;

            const currentTrack = queueService.getCurrentTrack(guildId);
            console.log(`[PlaybackController] Current track:`, currentTrack?.title);
            
            if (!currentTrack) {
                console.log(`[PlaybackController] No current track found!`);
                return;
            }

            logger.log(`Now playing: ${currentTrack.title}`, interaction);
            queueService.clearInactivityTimer(guildId);

            await queueService.disableNowMessageControls(guildId);

            console.log(`[PlaybackController] Building embed...`);
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

            console.log(`[PlaybackController] Sending now playing message...`);
            const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
            console.log(`[PlaybackController] Now playing message sent!`);
            
            queueService.setNowMessage(guildId, nowMessage);

            ControlsController.setupCollector(guildId, interaction, nowMessage);
        };

        const handleTrackEnd = async (player, track, reason) => {
            console.log(`[PlaybackController] trackEnd event fired for guild ${player.guildId}, reason: ${reason}`);
            
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

            if (reason === 'stopped' || reason === 'replaced') {
                console.log(`[PlaybackController] Track was stopped/replaced, not playing next`);
                return;
            }

            const nextTrack = queueService.nextTrack(guildId);
            console.log(`[PlaybackController] Next track:`, nextTrack?.title);
            
            if (nextTrack) {
                logger.log(`Starting next track: ${nextTrack.title}`, interaction);
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
            console.log(`[PlaybackController] trackException event fired for guild ${player.guildId}`);
            
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
            console.log(`[PlaybackController] trackStuck event fired for guild ${player.guildId}`);
            
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

        console.log(`[PlaybackController] Registering event listeners...`);
        manager.on('trackStart', handleTrackStart);
        manager.on('trackEnd', handleTrackEnd);
        manager.on('trackException', handleTrackException);
        manager.on('trackStuck', handleTrackStuck);
        console.log(`[PlaybackController] Event listeners registered!`);
    }

    unbindPlayerEvents(guildId) {
        console.log(`[PlaybackController] Unbinding events for guild ${guildId}`);
        this.boundGuilds.delete(guildId);
    }
}

module.exports = new PlaybackController();