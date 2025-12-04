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

        manager.on('trackStart', async (player, track) => {
            if (player.guild !== guildId) return;

            logger.log(`Now playing: ${track.title}`, interaction);
            queueService.clearInactivityTimer(guildId);

            await queueService.disableNowMessageControls(guildId);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: track.title,
                    url: track.uri,
                    lengthSeconds: Math.floor(track.duration / 1000),
                    thumbnail: track.thumbnail || track.displayThumbnail?.(),
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

        manager.on('trackEnd', async (player, track) => {
            if (player.guild !== guildId) return;

            logger.log(`Track ended: ${track.title}`, interaction);

            await interaction.channel.send({ 
                embeds: [embedBuilder.buildSongFinishedEmbed({
                    title: track.title,
                    url: track.uri
                })] 
            });
        });

        manager.on('queueEnd', async (player) => {
            if (player.guild !== guildId) return;

            logger.log(`Queue finished`, interaction);

            await queueService.disableNowMessageControls(guildId);
            await interaction.channel.send({ embeds: [embedBuilder.buildQueueFinishedEmbed()] });

            queueService.setInactivityTimer(guildId, async (id) => {
                await queueService.cleanup(id);
                await interaction.channel.send({ embeds: [embedBuilder.buildDisconnectedEmbed()] });
            });
        });

        manager.on('trackError', async (player, track, error) => {
            if (player.guild !== guildId) return;

            logger.error(`Track error: ${error.message}`, interaction);

            await interaction.channel.send({
                embeds: [embedBuilder.buildErrorEmbed('Skipping to the next track…')]
            });

            if (player.queue.length > 0) {
                player.stop();
            }
        });
    }
}

module.exports = new PlaybackController();