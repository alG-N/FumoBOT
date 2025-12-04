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

        // Track Start Event
        manager.on('playerStart', async (player, track) => {
            if (player.guildId !== guildId) return;

            logger.log(`Now playing: ${track.title}`, interaction);
            queueService.clearInactivityTimer(guildId);

            await queueService.disableNowMessageControls(guildId);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: track.title,
                    url: track.uri,
                    lengthSeconds: Math.floor(track.length / 1000),
                    thumbnail: track.thumbnail || track.artworkUrl,
                    author: track.author,
                    requestedBy: track.requester,
                    source: track.sourceName || 'YouTube'
                },
                player.volume,
                track.requester,
                player,
                queueService.isLooping(guildId)
            );

            const rows = ControlsController.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), track.uri);

            const nowMessage = await interaction.channel.send({ embeds: [embed], components: rows });
            queueService.setNowMessage(guildId, nowMessage);

            ControlsController.setupCollector(guildId, interaction, nowMessage);
        });

        // Track End Event
        manager.on('playerEnd', async (player, track) => {
            if (player.guildId !== guildId) return;

            logger.log(`Track ended: ${track.title}`, interaction);

            await interaction.channel.send({ 
                embeds: [embedBuilder.buildSongFinishedEmbed({
                    title: track.title,
                    url: track.uri
                })] 
            });
        });

        // Queue Empty Event
        manager.on('playerEmpty', async (player) => {
            if (player.guildId !== guildId) return;

            logger.log(`Queue finished`, interaction);

            await queueService.disableNowMessageControls(guildId);
            await interaction.channel.send({ embeds: [embedBuilder.buildQueueFinishedEmbed()] });

            queueService.setInactivityTimer(guildId, async (id) => {
                await queueService.cleanup(id);
                await interaction.channel.send({ embeds: [embedBuilder.buildDisconnectedEmbed()] });
            });
        });

        // Track Exception Event
        manager.on('playerException', async (player, data) => {
            if (player.guildId !== guildId) return;

            logger.error(`Track error: ${data.exception?.message}`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track error occurred. Skipping to next track…')]
            });

            if (player.queue.size > 0) {
                player.skip();
            }
        });

        // Track Stuck Event
        manager.on('playerStuck', async (player, data) => {
            if (player.guildId !== guildId) return;

            logger.warn(`Track stuck for ${data.thresholdMs}ms`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Track stuck. Skipping to next…')]
            });

            if (player.queue.size > 0) {
                player.skip();
            }
        });
    }
}

module.exports = new PlaybackController();