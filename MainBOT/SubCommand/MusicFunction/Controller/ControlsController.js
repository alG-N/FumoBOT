const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const queueService = require('../Service/QueueService');
const voiceService = require('../Service/VoiceService');
const votingService = require('../Service/VotingService');
const lavalinkService = require('../Service/LavalinkService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const interactionHandler = require('../Middleware/interactionHandler');
const { checkSameVoiceChannel } = require('../Middleware/voiceChannelCheck');

const { MIN_VOTES_REQUIRED, VOLUME_STEP, TRACK_TRANSITION_DELAY } = require('../Configuration/MusicConfig');

class ControlsController {
    buildControlRows(guildId, isPaused, isLooped, isShuffled, trackUrl) {
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
                .setCustomId(`shuffle:${guildId}`)
                .setLabel(isShuffled ? "🔀 Unshuffle" : "🔀 Shuffle")
                .setStyle(isShuffled ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setLabel("🔗 Link")
                .setStyle(ButtonStyle.Link)
                .setURL(trackUrl || "https://youtube.com")
        );

        return [mainRow, volumeRow];
    }

    setupCollector(guildId, interaction, message) {
        const handlers = {
            pause: async (i, gid) => await this.handlePause(i, gid),
            stop: async (i, gid) => await this.handleStop(i, gid),
            skip: async (i, gid) => await this.handleSkip(i, gid),
            list: async (i, gid) => await this.handleList(i, gid),
            loop: async (i, gid) => await this.handleLoop(i, gid),
            shuffle: async (i, gid) => await this.handleShuffle(i, gid),
            volDown: async (i, gid) => await this.handleVolumeDown(i, gid),
            volUp: async (i, gid) => await this.handleVolumeUp(i, gid),
            vote_skip: async (i, gid) => await this.handleVoteSkip(i, gid),

            onEnd: async (reason, msg) => {
                logger.log(`Collector ended: ${reason}`, interaction);
                const player = lavalinkService.getPlayer(guildId);
                if (player) {
                    await interactionHandler.disableMessageComponents(msg);
                    queueService.clearNowMessage(guildId);
                }
            }
        };

        return interactionHandler.createCollector(message, guildId, handlers);
    }

    async handlePause(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        if (!player) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }

        const currentTrack = queueService.getCurrentTrack(guildId);
        if (!currentTrack) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }

        if (!player.paused) {
            await player.setPaused(true);
            logger.log(`Paused`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: currentTrack.title,
                    url: currentTrack.url,
                    lengthSeconds: currentTrack.lengthSeconds,
                    thumbnail: currentTrack.thumbnail,
                    author: currentTrack.author,
                    requestedBy: currentTrack.requestedBy,
                    source: currentTrack.source,
                    viewCount: currentTrack.viewCount
                },
                player.volume,
                currentTrack.requestedBy,
                player,
                queueService.isLooping(guildId),
                queueService.isShuffling(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, true, queueService.isLooping(guildId), queueService.isShuffling(guildId), currentTrack.url)
            });

            if (result.fallback) {
                queueService.setNowMessage(guildId, result.message);
            }

            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⏸️ Paused." });

        } else {
            await player.setPaused(false);
            logger.log(`Resumed`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: currentTrack.title,
                    url: currentTrack.url,
                    lengthSeconds: currentTrack.lengthSeconds,
                    thumbnail: currentTrack.thumbnail,
                    author: currentTrack.author,
                    requestedBy: currentTrack.requestedBy,
                    source: currentTrack.source,
                    viewCount: currentTrack.viewCount
                },
                player.volume,
                currentTrack.requestedBy,
                player,
                queueService.isLooping(guildId),
                queueService.isShuffling(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, false, queueService.isLooping(guildId), queueService.isShuffling(guildId), currentTrack.url)
            });

            if (result.fallback) {
                queueService.setNowMessage(guildId, result.message);
            }

            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "▶️ Resumed." });
        }
    }

    async handleStop(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
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
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        if (!player) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Nothing to skip." });
        }

        const listeners = voiceService.getListeners(guildId, interaction.guild);

        if (listeners.length >= 3) {
            const queue = queueService.getOrCreateQueue(guildId);

            if (!votingService.isVoting(queue)) {
                votingService.startSkipVote(queue, interaction.user.id, listeners.length);

                const minVotes = votingService.getMinVotesRequired(listeners.length);

                const voteMsg = await interactionHandler.safeReply(interaction, {
                    content: `⏭️ Skip requested by ${interaction.user.tag}! React below to vote. Need at least ${minVotes} votes to skip (${listeners.length} listeners).`,
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
                    const votingMsg = votingService.getVotingMessage(queue);

                    if (votingService.hasEnoughVotes(queue)) {
                        const nextTrack = queueService.nextTrack(guildId);

                        await player.stopTrack();
                        await votingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
                        logger.log(`Track skipped by vote`, interaction);

                        if (nextTrack) {
                            await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                            const playerCheck = lavalinkService.getPlayer(guildId);
                            if (playerCheck) {
                                await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                            }
                        }
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
            if (player.track) {
                const nextTrack = queueService.nextTrack(guildId);

                await player.stopTrack();
                logger.log(`Track skipped`, interaction);
                await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⏭️ Skipped." });

                if (nextTrack) {
                    await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                    const playerCheck = lavalinkService.getPlayer(guildId);
                    if (playerCheck) {
                        await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                    }
                }
            } else {
                await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Nothing to skip." });
            }
        }
    }

    async handleList(interaction, guildId) {
        const { fmtDur } = require('../Utility/formatters');
        const lines = [];
        const player = lavalinkService.getPlayer(guildId);

        if (!player) {
            return await interactionHandler.safeReply(interaction, {
                ephemeral: true,
                embeds: [embedBuilder.buildInfoEmbed("🧾 Current Queue", "_Queue is empty._")]
            });
        }

        const currentTrack = queueService.getCurrentTrack(guildId);
        const queueList = queueService.getQueueList(guildId);

        if (currentTrack) {
            lines.push(`**Now** — [${currentTrack.title}](${currentTrack.url}) \`${fmtDur(currentTrack.lengthSeconds)}\``);
        }

        if (queueList.length === 0) {
            lines.push("_Queue is empty._");
        } else {
            const tracks = queueList.slice(0, 10);
            tracks.forEach((t, idx) => {
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
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        if (!player) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }

        const isLooped = queueService.toggleLoop(guildId);
        logger.log(`Loop toggled: ${isLooped}`, interaction);

        const currentTrack = queueService.getCurrentTrack(guildId);
        if (!currentTrack) return;

        const embed = embedBuilder.buildNowPlayingEmbed(
            {
                title: currentTrack.title,
                url: currentTrack.url,
                lengthSeconds: currentTrack.lengthSeconds,
                thumbnail: currentTrack.thumbnail,
                author: currentTrack.author,
                requestedBy: currentTrack.requestedBy,
                source: currentTrack.source,
                viewCount: currentTrack.viewCount
            },
            player.volume,
            currentTrack.requestedBy,
            player,
            isLooped,
            queueService.isShuffling(guildId)
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, player.paused, isLooped, queueService.isShuffling(guildId), currentTrack.url)
        });

        if (result.fallback) {
            queueService.setNowMessage(guildId, result.message);
        }

        await interactionHandler.safeDeferUpdate(interaction);
    }

    async handleShuffle(interaction, guildId) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        if (!player) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }

        const isShuffled = queueService.toggleShuffle(guildId);
        logger.log(`Shuffle toggled: ${isShuffled}`, interaction);

        const currentTrack = queueService.getCurrentTrack(guildId);
        if (!currentTrack) return;

        const embed = embedBuilder.buildNowPlayingEmbed(
            {
                title: currentTrack.title,
                url: currentTrack.url,
                lengthSeconds: currentTrack.lengthSeconds,
                thumbnail: currentTrack.thumbnail,
                author: currentTrack.author,
                requestedBy: currentTrack.requestedBy,
                source: currentTrack.source,
                viewCount: currentTrack.viewCount
            },
            player.volume,
            currentTrack.requestedBy,
            player,
            queueService.isLooping(guildId),
            isShuffled
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), isShuffled, currentTrack.url)
        });

        if (result.fallback) {
            queueService.setNowMessage(guildId, result.message);
        }

        await interactionHandler.safeDeferUpdate(interaction);
    }

    async handleVolumeDown(interaction, guildId) {
        await this.handleVolumeChange(interaction, guildId, -VOLUME_STEP);
    }

    async handleVolumeUp(interaction, guildId) {
        await this.handleVolumeChange(interaction, guildId, VOLUME_STEP);
    }

    async handleVolumeChange(interaction, guildId, delta) {
        if (!await checkSameVoiceChannel(interaction, voiceService.getChannelId(guildId))) {
            return;
        }

        const player = lavalinkService.getPlayer(guildId);
        if (!player) {
            return await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⚠️ Not playing." });
        }

        const newVolume = Math.max(0, Math.min(200, player.volume + delta));
        await player.setGlobalVolume(newVolume);

        logger.log(`Volume changed: ${newVolume}`, interaction);

        const currentTrack = queueService.getCurrentTrack(guildId);
        if (!currentTrack) return;

        const embed = embedBuilder.buildNowPlayingEmbed(
            {
                title: currentTrack.title,
                url: currentTrack.url,
                lengthSeconds: currentTrack.lengthSeconds,
                thumbnail: currentTrack.thumbnail,
                author: currentTrack.author,
                requestedBy: currentTrack.requestedBy,
                source: currentTrack.source,
                viewCount: currentTrack.viewCount
            },
            newVolume,
            currentTrack.requestedBy,
            player,
            queueService.isLooping(guildId),
            queueService.isShuffling(guildId)
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), queueService.isShuffling(guildId), currentTrack.url)
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

        const minVotes = votingService.getMinVotesRequired(queue.skipVoteListenerCount || 3);

        await interactionHandler.safeReply(interaction, {
            ephemeral: true,
            content: `Your vote to skip has been counted. (${result.count}/${minVotes})`
        });

        if (votingService.hasEnoughVotes(queue)) {
            const votingMsg = votingService.getVotingMessage(queue);
            const player = lavalinkService.getPlayer(guildId);

            if (player) {
                const nextTrack = queueService.nextTrack(guildId);

                await player.stopTrack();
                await votingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });

                if (nextTrack) {
                    await new Promise(resolve => setTimeout(resolve, TRACK_TRANSITION_DELAY));
                    const playerCheck = lavalinkService.getPlayer(guildId);
                    if (playerCheck) {
                        await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                    }
                }
            }

            votingService.endVoting(queue);
            logger.log(`Track skipped by vote (${minVotes}+ votes)`, interaction);
        }
    }
}

module.exports = new ControlsController()