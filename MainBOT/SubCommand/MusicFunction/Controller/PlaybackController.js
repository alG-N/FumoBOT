const queueService = require('../Service/QueueService');
const lavalinkService = require('../Service/LavalinkService');
const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const ControlsController = require('./ControlsController');
const { TRACK_TRANSITION_DELAY } = require('../Configuration/MusicConfig');

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

        const player = lavalinkService.getPlayer(guildId);
        console.log(`[PlaybackController] Player exists?`, !!player);

        if (!player) {
            console.error(`[PlaybackController] No player found for guild ${guildId}`);
            return;
        }

        const handleTrackStart = async (data) => {
            console.log(`[PlaybackController] start event fired for guild ${guildId}`);
            console.log(`[PlaybackController] Event data:`, data);

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
                    source: currentTrack.source,
                    viewCount: currentTrack.viewCount
                },
                player.volume,
                currentTrack.requestedBy,
                player,
                queueService.isLooping(guildId),
                queueService.isShuffling(guildId)
            );

            const rows = ControlsController.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), queueService.isShuffling(guildId), currentTrack.url);

            console.log(`[PlaybackController] Sending now playing message...`);
            const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
            console.log(`[PlaybackController] Now playing message sent!`);
            
            queueService.setNowMessage(guildId, nowMessage);

            ControlsController.setupCollector(guildId, interaction, nowMessage);
        };

        const handleTrackEnd = async (data) => {
            console.log(`[PlaybackController] end event fired for guild ${guildId}, reason:`, data?.reason);
            
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

            if (data?.reason === 'stopped' || data?.reason === 'replaced') {
                console.log(`[PlaybackController] Track was stopped/replaced, not playing next`);
                return;
            }

            const nextTrack = queueService.nextTrack(guildId);
            console.log(`[PlaybackController] Next track:`, nextTrack?.title);
            
            if (nextTrack) {
                console.log(`[PlaybackController] Waiting ${TRACK_TRANSITION_DELAY}ms before playing next track...`);
                
                await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                
                const playerCheck = lavalinkService.getPlayer(guildId);
                if (!playerCheck) {
                    console.log(`[PlaybackController] Player no longer exists, skipping next track`);
                    return;
                }
                
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

        const handleTrackException = async (data) => {
            console.log(`[PlaybackController] exception event fired for guild ${guildId}`);
            
            logger.error(`Track error: ${data.exception?.message}`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track error occurred. Skipping to next track…')]
            });

            const nextTrack = queueService.nextTrack(guildId);
            if (nextTrack) {
                console.log(`[PlaybackController] Waiting ${TRACK_TRANSITION_DELAY}ms before playing next track after error...`);
                
                await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                
                const playerCheck = lavalinkService.getPlayer(guildId);
                if (playerCheck) {
                    await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                }
            }
        };

        const handleTrackStuck = async (data) => {
            console.log(`[PlaybackController] stuck event fired for guild ${guildId}`);
            
            logger.warn(`Track stuck for ${data.thresholdMs}ms`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track stuck. Skipping to next…')]
            });

            const nextTrack = queueService.nextTrack(guildId);
            if (nextTrack) {
                console.log(`[PlaybackController] Waiting ${TRACK_TRANSITION_DELAY}ms before playing next track after stuck...`);
                
                await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                
                const playerCheck = lavalinkService.getPlayer(guildId);
                if (playerCheck) {
                    await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                }
            }
        };

        console.log(`[PlaybackController] Registering event listeners on player...`);
        player.on('start', handleTrackStart);
        player.on('end', handleTrackEnd);
        player.on('exception', handleTrackException);
        player.on('stuck', handleTrackStuck);
        console.log(`[PlaybackController] Event listeners registered!`);
    }

    unbindPlayerEvents(guildId) {
        console.log(`[PlaybackController] Unbinding events for guild ${guildId}`);
        
        const player = lavalinkService.getPlayer(guildId);
        if (player) {
            player.removeAllListeners('start');
            player.removeAllListeners('end');
            player.removeAllListeners('exception');
            player.removeAllListeners('stuck');
        }
        
        this.boundGuilds.delete(guildId);
    }
}

module.exports = new PlaybackController();