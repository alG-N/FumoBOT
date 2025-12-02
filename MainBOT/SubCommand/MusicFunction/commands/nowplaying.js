/**
 * Now Playing Command
 * Display currently playing track
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ButtonUtil = require('../utils/button.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing track'),

    async execute(interaction, { playerService }) {
        logger.command('nowplaying', interaction.user, interaction.guild);

        try {
            const player = playerService.lavalink.getPlayer(interaction.guild.id);

            if (!player) {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ No Player', ValidationUtil.getErrorMessage('NO_PLAYER'))],
                    ephemeral: true,
                });
            }

            const current = player.queue.current;

            if (!current) {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ Nothing Playing', ValidationUtil.getErrorMessage('NO_CURRENT_TRACK'))],
                    ephemeral: true,
                });
            }

            const embed = EmbedUtil.createNowPlaying(current, player, current.requester);

            const controls = ButtonUtil.createControls(
                interaction.guild.id,
                player.paused,
                player.trackRepeat
            );

            const volumeControls = ButtonUtil.createVolumeControls(
                interaction.guild.id,
                current.uri
            );

            await interaction.reply({
                embeds: [embed],
                components: [controls, volumeControls],
            });

        } catch (error) {
            logger.error(`Now playing command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while fetching current track.')],
                ephemeral: true,
            });
        }
    },
};