/**
 * History Handler
 * Handles listening history
 */

const musicService = require('../../Service/MusicService');
const trackHandler = require('../../Handler/trackHandler');
const { checkVoiceChannel, checkVoicePermissions } = require('../../Middleware/voiceChannelCheck');

module.exports = {
    async handleHistory(interaction, subcommand, userId) {
        switch (subcommand) {
            case 'list':
                return await this.handleHistoryList(interaction, userId);
            case 'play':
                return await this.handleHistoryPlay(interaction, userId);
            case 'clear':
                return await this.handleHistoryClear(interaction, userId);
        }
    },

    async handleHistoryList(interaction, userId) {
        const history = musicService.getHistory(userId, 100);
        const page = interaction.options.getInteger('page') || 1;

        const embed = trackHandler.createHistoryEmbed(history, userId, page);
        await interaction.reply({ embeds: [embed] });
    },

    async handleHistoryPlay(interaction, userId) {
        const number = interaction.options.getInteger('number');
        const history = musicService.getHistory(userId, 100);

        if (number > history.length) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed(`Invalid number. History only has ${history.length} items.`)],
                ephemeral: true
            });
        }

        const historyItem = history[number - 1];
        
        if (!await checkVoiceChannel(interaction)) return;
        if (!await checkVoicePermissions(interaction)) return;

        await interaction.deferReply();

        const guildId = interaction.guild.id;
        await musicService.connect(interaction);

        const trackData = await musicService.search(historyItem.url, interaction.user);
        
        if (!trackData) {
            return interaction.editReply({
                embeds: [trackHandler.createErrorEmbed('Failed to load track')]
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

    async handleHistoryClear(interaction, userId) {
        musicService.clearHistory(userId);
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🗑️ Cleared', 'Listening history cleared', 'success')]
        });
    }
};
