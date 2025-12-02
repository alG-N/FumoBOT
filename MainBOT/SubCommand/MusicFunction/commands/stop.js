/**
 * Stop Command
 * Stop playback and leave voice channel
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback, clear queue, and leave voice channel'),

    async execute(interaction, { playerService }) {
        logger.command('stop', interaction.user, interaction.guild);

        // Validate user is in voice channel
        if (!ValidationUtil.isInVoiceChannel(interaction.member)) {
            return interaction.reply({
                embeds: [EmbedUtil.createError('❌ No Voice Channel', ValidationUtil.getErrorMessage('NO_VC'))],
                ephemeral: true,
            });
        }

        // Validate user is in same voice channel
        if (!playerService.isInSameVoiceChannel(interaction.guild.id, interaction.user.id, interaction.guild)) {
            return interaction.reply({
                embeds: [EmbedUtil.createError('❌ Not Same Channel', ValidationUtil.getErrorMessage('NOT_SAME_VC'))],
                ephemeral: true,
            });
        }

        try {
            playerService.stop(interaction.guild.id);

            await interaction.reply({
                embeds: [EmbedUtil.createSuccess('🛑 Stopped', 'Playback stopped and queue cleared.')],
            });

        } catch (error) {
            if (error.message === 'NO_PLAYER') {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ No Player', ValidationUtil.getErrorMessage('NO_PLAYER'))],
                    ephemeral: true,
                });
            }

            logger.error(`Stop command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while stopping playback.')],
                ephemeral: true,
            });
        }
    },
};