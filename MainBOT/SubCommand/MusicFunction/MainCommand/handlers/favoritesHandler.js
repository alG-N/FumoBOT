/**
 * Favorites Handler
 * Handles favorites management
 */

const musicService = require('../../Service/MusicService');
const trackHandler = require('../../Handler/trackHandler');
const { checkVoiceChannel, checkVoicePermissions } = require('../../Middleware/voiceChannelCheck');

module.exports = {
    async handleFavorites(interaction, subcommand, userId) {
        switch (subcommand) {
            case 'list':
                return await this.handleFavoritesList(interaction, userId);
            case 'play':
                return await this.handleFavoritesPlay(interaction, userId);
            case 'remove':
                return await this.handleFavoritesRemove(interaction, userId);
            case 'clear':
                return await this.handleFavoritesClear(interaction, userId);
        }
    },

    async handleFavoritesList(interaction, userId) {
        const favorites = musicService.getFavorites(userId);
        const page = interaction.options.getInteger('page') || 1;

        const embed = trackHandler.createFavoritesEmbed(favorites, userId, page);
        await interaction.reply({ embeds: [embed] });
    },

    async handleFavoritesPlay(interaction, userId) {
        const number = interaction.options.getInteger('number');
        const favorites = musicService.getFavorites(userId);

        if (number > favorites.length) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed(`Invalid number. You only have ${favorites.length} favorites.`)],
                ephemeral: true
            });
        }

        const favorite = favorites[number - 1];
        
        // Redirect to play command logic
        if (!await checkVoiceChannel(interaction)) return;
        if (!await checkVoicePermissions(interaction)) return;

        await interaction.deferReply();

        const guildId = interaction.guild.id;
        await musicService.connect(interaction);

        const trackData = await musicService.search(favorite.url, interaction.user);
        
        if (!trackData) {
            return interaction.editReply({
                embeds: [trackHandler.createErrorEmbed('Failed to load favorite track')]
            });
        }

        musicService.addTrack(guildId, trackData);

        const currentTrack = musicService.getCurrentTrack(guildId);
        if (!currentTrack) {
            const nextTrack = musicService.getQueueList(guildId)[0];
            if (nextTrack) {
                musicService.removeTrack(guildId, 0);
                await musicService.playTrack(guildId, nextTrack);
            }
        }

        const position = currentTrack ? musicService.getQueueLength(guildId) : 0;
        const embed = trackHandler.createQueuedEmbed(trackData, position, interaction.user);
        await interaction.editReply({ embeds: [embed] });
    },

    async handleFavoritesRemove(interaction, userId) {
        const number = interaction.options.getInteger('number');
        const favorites = musicService.getFavorites(userId);

        if (number > favorites.length) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed(`Invalid number. You only have ${favorites.length} favorites.`)],
                ephemeral: true
            });
        }

        const removed = favorites[number - 1];
        musicService.removeFavorite(userId, removed.url);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('💔 Removed', `Removed **${removed.title}** from favorites`, 'success')]
        });
    },

    async handleFavoritesClear(interaction, userId) {
        const favorites = musicService.getFavorites(userId);
        if (favorites.length === 0) {
            return interaction.reply({
                embeds: [trackHandler.createInfoEmbed('💖 Favorites', 'You have no favorites to clear.')],
                ephemeral: true
            });
        }

        // Clear all favorites
        favorites.forEach(fav => musicService.removeFavorite(userId, fav.url));

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🗑️ Cleared', 'All favorites have been cleared', 'success')]
        });
    }
};
