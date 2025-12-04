const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AudioPlayerStatus } = require('@discordjs/voice');

const queueService = require('../Service/QueueService');
const audioPlayerService = require('../Service/AudioPlayerService');
const voiceService = require('../Service/VoiceService');
const votingService = require('../Service/VotingService');
const streamService = require('../Service/StreamService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const interactionHandler = require('../Middleware/interactionHandler');
const { checkSameVoiceChannel } = require('../Middleware/voiceChannelCheck');

const { MIN_VOTES_REQUIRED } = require('../Configuration/MusicConfig');

class ControlsController {
    buildControlRows(guildId, isPaused, isLooped, trackUrl) {
        const mainRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`pause:${guildId}`)
                .setLabel(isPaused ? "▶️ Resume" : "⏸️ Pause")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`stop:${guildId}`)
                .setLabel("🛑 Stop")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`skip:${guildId}`)
                .setLabel("⏭️ Skip")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`list:${guildId}`)
                .setLabel("🧾 List")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`loop:${guildId}`)
                .setLabel(isLooped ? "🔁 Unloop" : "🔂 Loop")
                .setStyle(isLooped ? ButtonStyle.Success : ButtonStyle.Secondary)
        );

        const volumeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`volDown:${guildId}`)
                .setLabel("🔉 -")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`volUp:${guildId}`)
                .setLabel("🔊 +")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel("🔗 Link")
                .setStyle(ButtonStyle.Link)
                .setURL(trackUrl || "https://youtube.com")
        );

        return [mainRow, volumeRow];
    }

    setupCollector(queue, guildId, interaction, message) {
        const handlers = {
            pause: async (i, gid) => await this.handlePause(i, gid),
            stop: async (i, gid) => await this.handleStop(i, gid),
            skip: async (i, gid) => await this.handleSkip(i, gid),
            list: async (i, gid) => await this.handleList(i, gid),
            loop: async (i, gid) => await this.handleLoop(i, gid),
            volDown: async (i, gid) => await this.handleVolumeDown(i, gid),
            volUp: async (i, gid) => await this.handleVolumeUp(i, gid),
            vote_skip: async (i, gid) => await this.handleVoteSkip(i, gid),
            
            onEnd: async (reason, msg) => {
                logger.log(`Collector ended: ${reason}`, interaction);
                const q = queueService.getOrCreateQueue(guildId);
                if (q.current) {
                    await interactionHandler.disableMessageComponents(msg);
                    queueService.clearNowMessage(guildId);
                }
            }
        };

        return interactionHandler.createCollector(message, guildId, handlers);
    }

    async handlePause(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(queueService.getOrCreateQueue(guildId)))) {
            return;
        }

        const queue = queueService.getOrCreateQueue(guildId);

        if (audioPlayerService.isPlaying(queue)) {
            audioPlayerService.pause(queue);
            logger.log(`Paused`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                queueService.getCurrentTrack(guildId),
                audioPlayerService.getVolume(queue) * 100,
                queue.current?.requestedBy ?? interaction.user,
                queue,
                queueService.isLooping(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, true, queueService.isLooping(guildId), queue.current?.url)
            });

            if (result.fallback) {
                queueService.setNowMessage(guildId, result.message);
            }

            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⏸️ Paused." });

        } else if (audioPlayerService.isPaused(queue)) {
            audioPlayerService.unpause(queue);
            logger.log(`Resumed`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                queueService.getCurrentTrack(guildId),
                audioPlayerService.getVolume(queue) * 100,
                queue.current?.requestedBy ?? interaction.user,
                queue,
                queueService.isLooping(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, false, queueService.isLooping(guildId), queue.current?.url)
            });

            if (result.fallback) {
                queueService.setNowMessage(guildId, result.message);
            }

            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "▶️ Resumed." });
        } else {
            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }
    }

    async handleStop(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(queueService.getOrCreateQueue(guildId)))) {
            return;
        }

        logger.log(`Stopped`, interaction);
        await queueService.cleanup(guildId);
        await queueService.disableNowMessageControls(guildId);
        await interactionHandler.safeReply(interaction, { 
            ephemeral: true, 
            content: "🛑 Stopped playback, disabled loop, cleared the queue, and left the VC." 
        });
    }

    async handleSkip(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(queueService.getOrCreateQueue(guildId)))) {
            return;
        }

        const queue = queueService.getOrCreateQueue(guildId);
        const listeners = voiceService.getListeners(queue, interaction.guild);

        if (listeners.length >= 3) {
            if (!votingService.isVoting(queue)) {
                votingService.startSkipVote(queue, interaction.user.id);

                const voteMsg = await interactionHandler.safeReply(interaction, {
                    content: `⏭️ Skip requested! React below to vote. Need at least ${MIN_VOTES_REQUIRED} votes to skip.`,
                    components: [new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId("vote_skip")
                            .setLabel("Skip")
                            .setStyle(ButtonStyle.Primary)
                    )],
                    ephemeral: false,
                    fetchReply: true,
                });

                votingService.setVotingMessage(queue, voteMsg);

                votingService.setVotingTimeout(queue, async () => {
                    const voteCount = votingService.getVoteCount(queue);
                    const votingMsg = votingService.getVotingMessage(queue);

                    if (votingService.hasEnoughVotes(queue)) {
                        audioPlayerService.killYtdlpProcess(queue);
                        audioPlayerService.stop(queue, true);
                        await votingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
                        logger.log(`Track skipped by vote`, interaction);
                    } else {
                        await votingMsg.edit({ content: "⏭️ Not enough votes to skip.", components: [] });
                        logger.log(`Not enough votes to skip`, interaction);
                    }
                    
                    votingService.endVoting(queue);
                });
            } else {
                await interactionHandler.safeReply(interaction, { 
                    ephemeral: true, 
                    content: "Skip vote already in progress." 
                });
            }
        } else {
            if (audioPlayerService.isPlaying(queue) || audioPlayerService.isPaused(queue)) {
                audioPlayerService.stop(queue, true);
                logger.log(`Track skipped`, interaction);
                await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⏭️ Skipped." });
            } else {
                await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Nothing to skip." });
            }
        }
    }

    async handleList(interaction, guildId) {
        const { fmtDur } = require('../Utility/formatters');
        const lines = [];
        const currentTrack = queueService.getCurrentTrack(guildId);
        const queueList = queueService.getQueueList(guildId);

        if (currentTrack) {
            lines.push(`**Now** — [${currentTrack.title}](${currentTrack.url}) \`${fmtDur(currentTrack.lengthSeconds)}\``);
        }

        if (queueList.length === 0) {
            lines.push("_Queue is empty._");
        } else {
            queueList.slice(0, 10).forEach((t, idx) => {
                lines.push(`**#${idx + 1}** — [${t.title}](${t.url}) \`${fmtDur(t.lengthSeconds)}\` • ${t.author}`);
            });
            if (queueList.length > 10) {
                lines.push(`…and **${queueList.length - 10}** more`);
            }
        }

        const embed = embedBuilder.buildInfoEmbed("🧾 Current Queue", lines.join("\n"));
        await interactionHandler.safeReply(interaction, { ephemeral: true, embeds: [embed] });
    }

    async handleLoop(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(queueService.getOrCreateQueue(guildId)))) {
            return;
        }

        const isLooped = queueService.toggleLoop(guildId);
        logger.log(`Loop toggled: ${isLooped}`, interaction);

        const queue = queueService.getOrCreateQueue(guildId);
        const embed = embedBuilder.buildNowPlayingEmbed(
            queueService.getCurrentTrack(guildId) ?? {},
            audioPlayerService.getVolume(queue) * 100,
            queue.current?.requestedBy ?? interaction.user,
            queue,
            isLooped
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, audioPlayerService.isPaused(queue), isLooped, queue.current?.url)
        });

        if (result.fallback) {
            queueService.setNowMessage(guildId, result.message);
        }

        await interactionHandler.safeDeferUpdate(interaction);
    }

    async handleVolumeDown(interaction, guildId) {
        await this.handleVolumeChange(interaction, guildId, -0.1);
    }

    async handleVolumeUp(interaction, guildId) {
        await this.handleVolumeChange(interaction, guildId, 0.1);
    }

    async handleVolumeChange(interaction, guildId, delta) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(queueService.getOrCreateQueue(guildId)))) {
            return;
        }

        const queue = queueService.getOrCreateQueue(guildId);
        const newVolume = audioPlayerService.adjustVolume(queue, delta);
        logger.log(`Volume changed: ${newVolume}`, interaction);

        const embed = embedBuilder.buildNowPlayingEmbed(
            queueService.getCurrentTrack(guildId) ?? {},
            newVolume * 100,
            queue.current?.requestedBy ?? interaction.user,
            queue,
            queueService.isLooping(guildId)
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, audioPlayerService.isPaused(queue), queueService.isLooping(guildId), queue.current?.url)
        });

        if (result.fallback) {
            queueService.setNowMessage(guildId, result.message);
        }

        await interactionHandler.safeDeferUpdate(interaction);
    }

    async handleVoteSkip(interaction, guildId) {
        const queue = queueService.getOrCreateQueue(guildId);

        if (!votingService.isVoting(queue)) {
            await interactionHandler.safeReply(interaction, { 
                ephemeral: true, 
                content: "No skip vote in progress." 
            });
            return;
        }

        const result = votingService.addSkipVote(queue, interaction.user.id);

        if (!result.added) {
            await interactionHandler.safeReply(interaction, { 
                ephemeral: true, 
                content: "You already voted or voting ended." 
            });
            return;
        }

        await interactionHandler.safeReply(interaction, { 
            ephemeral: true, 
            content: "Your vote to skip has been counted." 
        });

        if (votingService.hasEnoughVotes(queue)) {
            const votingMsg = votingService.getVotingMessage(queue);
            audioPlayerService.stop(queue, true);
            await votingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
            votingService.endVoting(queue);
            logger.log(`Track skipped by vote (${MIN_VOTES_REQUIRED}+)`, interaction);
        }
    }
}

module.exports = new ControlsController();