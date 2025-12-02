/**
 * Volume Command
 * Adjust player volume
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');
const config = require('../config/music.config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set or view the player volume')
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription(`Volume level (${config.player.minVolume}-${config.player.maxVolume})`)
                .setMinValue(config.player.minVolume)
                .setMaxValue(config.player.maxVolume)
                .setRequired(false)
        ),

    async execute(interaction, { playerService }) {
        logger.command('volume', interaction.user, interaction.guild);

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
            const player = playerService.lavalink.getPlayer(interaction.guild.id);

            if (!player) {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ No Player', ValidationUtil.getErrorMessage('NO_PLAYER'))],
                    ephemeral: true,
                });
            }

            const level = interaction.options.getInteger('level');

            // If no level provided, show current volume
            if (level === null) {
                await interaction.reply({
                    embeds: [EmbedUtil.createInfo('🔊 Current Volume', `Volume is set to **${player.volume}%**`)],
                });
                return;
            }

            // Set new volume
            const newVolume = playerService.setVolume(interaction.guild.id, level);

            await interaction.reply({
                embeds: [EmbedUtil.createSuccess('🔊 Volume Updated', `Volume set to **${newVolume}%**`)],
            });

        } catch (error) {
            logger.error(`Volume command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while adjusting volume.')],
                ephemeral: true,
            });
        }
    },
};