/**
 * Queue Command
 * Display the current queue
 */

const { SlashCommandBuilder } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ValidationUtil = require('../utils/validation.util');
const logger = require('../utils/logger.util');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Display the current queue')
        .addIntegerOption(option =>
            option
                .setName('page')
                .setDescription('Page number')
                .setMinValue(1)
                .setRequired(false)
        ),

    async execute(interaction, { playerService }) {
        logger.command('queue', interaction.user, interaction.guild);

        try {
            const player = playerService.lavalink.getPlayer(interaction.guild.id);

            if (!player) {
                return interaction.reply({
                    embeds: [EmbedUtil.createError('❌ No Player', ValidationUtil.getErrorMessage('NO_PLAYER'))],
                    ephemeral: true,
                });
            }

            const page = interaction.options.getInteger('page') || 1;
            const perPage = 10;

            const current = player.queue.current;
            const queue = [...player.queue];

            const embed = EmbedUtil.createQueueList(current, queue, page, perPage);

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Queue command error: ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            await interaction.reply({
                embeds: [EmbedUtil.createError('❌ Error', 'An error occurred while fetching the queue.')],
                ephemeral: true,
            });
        }
    },
};