/**
 * Loop Command
 * Toggle loop mode
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Toggle loop mode')
        .addStringOption(option =>
            option
                .setName('mode')
                .setDescription('Loop mode')
                .setRequired(false)
                .addChoices(
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' },
                    { name: 'Off', value: 'off' }
                )
        ),

    async execute(interaction, { playerService }) {
        logger.command('loop', interaction.user, interaction.guild);

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

            const mode = interaction.options.getString('mode');

            if (mode === 'track') {
                playerService.toggleLoop(interaction.guild.id);
                const status = player.trackRepeat ? 'enabled' : 'disabled';
                await interaction.reply({
                    embeds: [EmbedUtil.createSuccess('🔁 Track Loop', `Track loop ${status}.`)],
                });
            } else if (mode === 'queue') {
                playerService.toggleQueueLoop(interaction.guild.id);
                const status = player.queueRepeat ? 'enabled' : 'disabled';
                await interaction.reply({
                    embeds: [EmbedUtil.createSuccess('🔁 Queue Loop', `Queue loop ${status}.`)],
                });
            } else if (mode === 'off') {
                player.setTrackRepeat(false);
                player.setQueueRepeat(false);
                await interaction.reply({
                    embeds: [EmbedUtil.createSuccess('🔁 Loop Off', 'Loop mode disabled.')],
                });
            } else {
                // Toggle track loop if no mode specified
                playerService.toggleLoop(interaction.guild.id);
                const status = player.trackRepeat ? 'enabled' : 'disabled';
                await interaction.reply({
                    embeds: [EmbedUtil.createSuccess('🔁 Track Loop', `Track loop ${status}.`)],
                });
            }

        } catch (error) {
            logger.error(`Loop command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while toggling loop mode.')],
                ephemeral: true,
            });
        }
    },
};