/**
 * Queue Handler
 * Handles queue viewing and management
 */

const musicService = require('../../Service/MusicService');
const musicCache = require('../../Repository/MusicCache');
const trackHandler = require('../../Handler/trackHandler');
const { checkSameVoiceChannel } = require('../../Middleware/voiceChannelCheck');

module.exports = {
    async handleQueue(interaction, guildId) {
        const tracks = musicService.getQueueList(guildId);
        const currentTrack = musicService.getCurrentTrack(guildId);
        const page = interaction.options.getInteger('page') || 1;

        const embed = trackHandler.createQueueListEmbed(tracks, currentTrack, {
            page,
            loopMode: musicService.getLoopMode(guildId),
            isShuffled: musicService.isShuffled(guildId),
            volume: musicService.getVolume(guildId)
        });

        const totalPages = Math.ceil(tracks.length / 10) || 1;
        const row = trackHandler.createQueuePaginationButtons(guildId, page, totalPages);

        await interaction.reply({ embeds: [embed], components: [row] });
    },

    async handleNowPlaying(interaction, guildId) {
        const currentTrack = musicService.getCurrentTrack(guildId);

        if (!currentTrack) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Nothing is currently playing')],
                ephemeral: true
            });
        }

        const queueList = musicService.getQueueList(guildId);
        const nextTrack = queueList.length > 0 ? queueList[0] : null;

        const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
            volume: musicService.getVolume(guildId),
            isPaused: musicCache.getQueue(guildId)?.isPaused || false,
            loopMode: musicService.getLoopMode(guildId),
            isShuffled: musicService.isShuffled(guildId),
            queueLength: queueList.length,
            nextTrack
        });

        const rows = trackHandler.createControlButtons(guildId, {
            isPaused: musicCache.getQueue(guildId)?.isPaused || false,
            loopMode: musicService.getLoopMode(guildId),
            isShuffled: musicService.isShuffled(guildId),
            trackUrl: currentTrack.url,
            userId: interaction.user.id
        });

        await interaction.reply({ embeds: [embed], components: rows });
    },

    async handleRemove(interaction, guildId) {
        const position = interaction.options.getInteger('position');
        const tracks = musicService.getQueueList(guildId);

        if (position > tracks.length) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed(`Invalid position. Queue only has ${tracks.length} tracks.`)],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        const removed = musicService.removeTrack(guildId, position - 1);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🗑️ Removed', `Removed: **${removed?.title || 'Unknown'}**`, 'success')]
        });
    },

    async handleMove(interaction, guildId) {
        const from = interaction.options.getInteger('from');
        const to = interaction.options.getInteger('to');
        const tracks = musicService.getQueueList(guildId);

        if (from > tracks.length || to > tracks.length) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed(`Invalid position. Queue only has ${tracks.length} tracks.`)],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        const success = musicService.moveTrack(guildId, from - 1, to - 1);

        if (success) {
            await interaction.reply({
                embeds: [trackHandler.createInfoEmbed('📝 Moved', `Moved track from position ${from} to ${to}`, 'success')]
            });
        } else {
            await interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Failed to move track')],
                ephemeral: true
            });
        }
    },

    async handleClear(interaction, guildId) {
        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        const cleared = musicService.getQueueLength(guildId);
        musicService.clearQueue(guildId);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🗑️ Queue Cleared', `Removed **${cleared}** tracks from queue`, 'success')]
        });
    },

    async handleRecent(interaction, guildId) {
        const recent = musicService.getRecentlyPlayed(guildId, 10);

        if (recent.length === 0) {
            return interaction.reply({
                embeds: [trackHandler.createInfoEmbed('📜 Recently Played', 'No recently played tracks in this server.')],
                ephemeral: true
            });
        }

        const recentText = recent.map((track, i) => {
            const timeAgo = this._timeAgo(track.playedAt);
            return `\`${i + 1}.\` **${track.title}** - ${timeAgo}`;
        }).join('\n');

        const embed = trackHandler.createInfoEmbed('📜 Recently Played', recentText);
        await interaction.reply({ embeds: [embed] });
    },

    _timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }
};
