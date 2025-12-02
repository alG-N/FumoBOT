/**
 * Play Command
 * Main command to play music
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ButtonUtil = require('../utils/button.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name, URL, or playlist URL')
                .setRequired(true)
        ),

    async execute(interaction, { lavalinkService, playerService }) {
        logger.command('play', interaction.user, interaction.guild);

        // Validate user is in voice channel
        if (!ValidationUtil.isInVoiceChannel(interaction.member)) {
            return interaction.reply({
                embeds: [EmbedUtil.createError('❌ No Voice Channel', ValidationUtil.getErrorMessage('NO_VC'))],
                ephemeral: true,
            });
        }

        const voiceChannel = ValidationUtil.getVoiceChannel(interaction.member);

        // Check permissions
        if (!ValidationUtil.hasVoicePermissions(voiceChannel, interaction.guild)) {
            return interaction.reply({
                embeds: [EmbedUtil.createError('❌ No Permissions', ValidationUtil.getErrorMessage('NO_PERMISSIONS'))],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const query = interaction.options.getString('query');

        try {
            // Search for tracks
            const result = await lavalinkService.search(query, interaction.user);

            if (!result.success) {
                const errorMsg = ValidationUtil.getErrorMessage(result.error);
                return interaction.editReply({
                    embeds: [EmbedUtil.createError('❌ Search Failed', errorMsg)],
                });
            }

            // Handle playlist
            if (result.playlist) {
                const playResult = await playerService.playTracks(
                    interaction.guild.id,
                    voiceChannel.id,
                    interaction.channel.id,
                    result.tracks
                );

                if (!playResult.success) {
                    throw new Error(playResult.error);
                }

                const embed = EmbedUtil.createPlaylistQueued(
                    result.playlist,
                    playResult.added,
                    interaction.user
                );

                await interaction.editReply({ embeds: [embed] });

                // Start monitoring
                playerService.monitorVoiceChannel(
                    interaction.guild.id,
                    interaction.guild,
                    interaction.channel
                );

                return;
            }

            // Handle single track
            const track = result.tracks[0];

            // Play the track
            const playResult = await playerService.play(
                interaction.guild.id,
                voiceChannel.id,
                interaction.channel.id,
                track
            );

            if (!playResult.success) {
                throw new Error(playResult.error);
            }

            const player = playResult.player;
            const position = player.queue.size + 1;

            // Send queued embed
            const queuedEmbed = EmbedUtil.createTrackQueued(
                track,
                position,
                interaction.user
            );

            await interaction.editReply({ embeds: [queuedEmbed] });

            // Start monitoring
            playerService.monitorVoiceChannel(
                interaction.guild.id,
                interaction.guild,
                interaction.channel
            );

            // If this is the first track, send now playing
            if (position === 1 && player.playing) {
                const nowPlayingEmbed = EmbedUtil.createNowPlaying(
                    player.queue.current,
                    player,
                    interaction.user
                );

                const controls = ButtonUtil.createControls(
                    interaction.guild.id,
                    player.paused,
                    player.trackRepeat
                );

                const volumeControls = ButtonUtil.createVolumeControls(
                    interaction.guild.id,
                    player.queue.current.uri
                );

                await interaction.channel.send({
                    embeds: [nowPlayingEmbed],
                    components: [controls, volumeControls],
                });
            }

        } catch (error) {
            logger.error(`Play command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.editReply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while trying to play the track.')],
            });
        }
    },
};