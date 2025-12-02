/**
 * Button Handler
 * Handles all button interactions for music controls
 */

const { ComponentType } = require('discord.js');
const EmbedUtil = require('../utils/embed.util');
const ButtonUtil = require('../utils/button.util');
const ValidationUtil = require('../utils/validation.util');
const queueService = require('../services/queue.service');
const config = require('../config/music.config');
const logger = require('../utils/logger.util');

class ButtonHandler {
    constructor(playerService) {
        this.playerService = playerService;
    }

    /**
     * Handle button interaction
     */
    async handleInteraction(interaction) {
        const [action, guildId] = interaction.customId.split(':');

        // Validate user is in same voice channel
        if (!this.playerService.isInSameVoiceChannel(guildId, interaction.user.id, interaction.guild)) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('NOT_SAME_VC'),
                ephemeral: true,
            });
        }

        try {
            switch (action) {
                case 'pause':
                    await this.handlePause(interaction, guildId);
                    break;
                case 'stop':
                    await this.handleStop(interaction, guildId);
                    break;
                case 'skip':
                    await this.handleSkip(interaction, guildId);
                    break;
                case 'list':
                    await this.handleList(interaction, guildId);
                    break;
                case 'loop':
                    await this.handleLoop(interaction, guildId);
                    break;
                case 'volDown':
                    await this.handleVolumeDown(interaction, guildId);
                    break;
                case 'volUp':
                    await this.handleVolumeUp(interaction, guildId);
                    break;
                case 'vote_skip':
                    await this.handleVoteSkip(interaction, guildId);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown button action.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            logger.error(`Button handler error (${action}): ${error.message}`, {
                user: interaction.user,
                guild: interaction.guild,
            });

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An error occurred.',
                    ephemeral: true,
                });
            }
        }
    }

    /**
     * Handle pause/resume button
     */
    async handlePause(interaction, guildId) {
        const player = this.playerService.lavalink.getPlayer(guildId);
        if (!player) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('NO_PLAYER'),
                ephemeral: true,
            });
        }

        if (player.paused) {
            this.playerService.resume(guildId);
        } else {
            this.playerService.pause(guildId);
        }

        const embed = EmbedUtil.createNowPlaying(
            player.queue.current,
            player,
            player.queue.current.requester
        );

        const controls = ButtonUtil.createControls(guildId, player.paused, player.trackRepeat);
        const volumeControls = ButtonUtil.createVolumeControls(guildId, player.queue.current.uri);

        await interaction.update({
            embeds: [embed],
            components: [controls, volumeControls],
        });
    }

    /**
     * Handle stop button
     */
    async handleStop(interaction, guildId) {
        this.playerService.stop(guildId);

        // Disable buttons
        const disabledComponents = ButtonUtil.disableAll(interaction.message.components);
        await interaction.update({ components: disabledComponents });

        await interaction.followUp({
            embeds: [EmbedUtil.createSuccess('🛑 Stopped', 'Playback stopped and queue cleared.')],
        });
    }

    /**
     * Handle skip button
     */
    async handleSkip(interaction, guildId) {
        const player = this.playerService.lavalink.getPlayer(guildId);
        if (!player) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('NO_PLAYER'),
                ephemeral: true,
            });
        }

        // Get voice channel members
        const voiceChannel = interaction.guild.channels.cache.get(player.voiceChannel);
        const listeners = voiceChannel?.members.filter(m => !m.user.bot).size || 0;

        // If 3+ users, initiate skip voting
        if (listeners >= config.voting.minUsersForVote) {
            await this.initiateSkipVote(interaction, guildId);
        } else {
            // Skip immediately
            this.playerService.skip(guildId);
            await interaction.reply({
                embeds: [EmbedUtil.createSuccess('⏭️ Skipped', 'Track has been skipped.')],
            });
        }
    }

    /**
     * Initiate skip voting
     */
    async initiateSkipVote(interaction, guildId) {
        const queue = queueService.getQueue(guildId);

        if (queue.skipVoting) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('VOTE_IN_PROGRESS'),
                ephemeral: true,
            });
        }

        const message = await interaction.reply({
            embeds: [EmbedUtil.createSkipVote(config.voting.requiredVotes, 1)],
            components: [ButtonUtil.createSkipVote()],
            fetchReply: true,
        });

        queueService.startSkipVote(guildId, interaction.user.id, message);

        // Set timeout
        queue.skipVotingTimeout = setTimeout(async () => {
            const votes = queue.skipVotes.size;
            queueService.clearSkipVote(guildId);

            if (votes >= config.voting.requiredVotes) {
                this.playerService.skip(guildId);
                await message.edit({
                    embeds: [EmbedUtil.createSuccess('⏭️ Vote Passed', 'Track skipped by vote.')],
                    components: [],
                });
            } else {
                await message.edit({
                    embeds: [EmbedUtil.createInfo('⏭️ Vote Failed', 'Not enough votes to skip.')],
                    components: [],
                });
            }
        }, config.voting.votingTimeout);
    }

    /**
     * Handle skip vote button
     */
    async handleVoteSkip(interaction, guildId) {
        try {
            const votes = queueService.addSkipVote(guildId, interaction.user.id);

            await interaction.reply({
                content: `✅ Vote counted! (${votes}/${config.voting.requiredVotes})`,
                ephemeral: true,
            });

            // Check if enough votes
            if (queueService.hasEnoughVotes(guildId)) {
                const queue = queueService.getQueue(guildId);
                clearTimeout(queue.skipVotingTimeout);

                this.playerService.skip(guildId);
                
                await queue.skipVotingMsg.edit({
                    embeds: [EmbedUtil.createSuccess('⏭️ Vote Passed', 'Track skipped by vote.')],
                    components: [],
                });

                queueService.clearSkipVote(guildId);
            }

        } catch (error) {
            await interaction.reply({
                content: ValidationUtil.getErrorMessage(error.message),
                ephemeral: true,
            });
        }
    }

    /**
     * Handle queue list button
     */
    async handleList(interaction, guildId) {
        const player = this.playerService.lavalink.getPlayer(guildId);
        if (!player) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('NO_PLAYER'),
                ephemeral: true,
            });
        }

        const current = player.queue.current;
        const queue = [...player.queue];

        const embed = EmbedUtil.createQueueList(current, queue);

        await interaction.reply({
            embeds: [embed],
            ephemeral: true,
        });
    }

    /**
     * Handle loop button
     */
    async handleLoop(interaction, guildId) {
        const player = this.playerService.lavalink.getPlayer(guildId);
        if (!player) {
            return interaction.reply({
                content: ValidationUtil.getErrorMessage('NO_PLAYER'),
                ephemeral: true,
            });
        }

        this.playerService.toggleLoop(guildId);

        const embed = EmbedUtil.createNowPlaying(
            player.queue.current,
            player,
            player.queue.current.requester
        );

        const controls = ButtonUtil.createControls(guildId, player.paused, player.trackRepeat);
        const volumeControls = ButtonUtil.createVolumeControls(guildId, player.queue.current.uri);

        await interaction.update({
            embeds: [embed],
            components: [controls, volumeControls],
        });
    }

    /**
     * Handle volume down button
     */
    async handleVolumeDown(interaction, guildId) {
        const newVolume = this.playerService.adjustVolume(guildId, false);
        await this.updateVolumeDisplay(interaction, guildId, newVolume);
    }

    /**
     * Handle volume up button
     */
    async handleVolumeUp(interaction, guildId) {
        const newVolume = this.playerService.adjustVolume(guildId, true);
        await this.updateVolumeDisplay(interaction, guildId, newVolume);
    }

    /**
     * Update volume display
     */
    async updateVolumeDisplay(interaction, guildId, volume) {
        const player = this.playerService.lavalink.getPlayer(guildId);

        const embed = EmbedUtil.createNowPlaying(
            player.queue.current,
            player,
            player.queue.current.requester
        );

        const controls = ButtonUtil.createControls(guildId, player.paused, player.trackRepeat);
        const volumeControls = ButtonUtil.createVolumeControls(guildId, player.queue.current.uri);

        await interaction.update({
            embeds: [embed],
            components: [controls, volumeControls],
        });
    }
}

module.exports = ButtonHandler;