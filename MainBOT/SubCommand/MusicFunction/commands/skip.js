/**
 * Skip Command
 * Skip the current track
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track'),

    async execute(interaction, { playerService }) {
        logger.command('skip', interaction.user, interaction.guild);

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
            playerService.skip(interaction.guild.id);

            await interaction.reply({
                embeds: [EmbedUtil.createSuccess('⏭️ Skipped', 'Current track has been skipped.')],
            });

        } catch (error) {
            if (error.message === 'NO_PLAYER') {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ No Player', ValidationUtil.getErrorMessage('NO_PLAYER'))],
                    ephemeral: true,
                });
            }

            if (error.message === 'NO_CURRENT_TRACK') {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ Nothing Playing', ValidationUtil.getErrorMessage('NO_CURRENT_TRACK'))],
                    ephemeral: true,
                });
            }

            logger.error(`Skip command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while skipping the track.')],
                ephemeral: true,
            });
        }
    },
};