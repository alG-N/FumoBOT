const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const queueService = require('../Service/QueueService');
const voiceService = require('../Service/VoiceService');
const votingService = require('../Service/VotingService');
const lavalinkService = require('../Service/LavalinkService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');
const interactionHandler = require('../Middleware/interactionHandler');
const { checkSameVoiceChannel } = require('../Middleware/voiceChannelCheck');

const { MIN_VOTES_REQUIRED, VOLUME_STEP } = require('../Configuration/MusicConfig');

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

    setupCollector(guildId, interaction, message) {
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
                const current = queueService.getCurrentTrack(guildId);
                if (current) {
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

        if (player.playing && !player.paused) {
            player.pause(true);
            logger.log(`Paused`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: currentTrack.title,
                    url: currentTrack.uri,
                    lengthSeconds: Math.floor(currentTrack.duration / 1000),
                    thumbnail: currentTrack.thumbnail || currentTrack.displayThumbnail?.(),
                    author: currentTrack.author,
                    requestedBy: currentTrack.requester,
                    source: currentTrack.sourceName || 'YouTube'
                },
                player.volume,
                currentTrack.requester,
                player,
                queueService.isLooping(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, true, queueService.isLooping(guildId), currentTrack.uri)
            });

            if (result.fallback) {
                queueService.setNowMessage(guildId, result.message);
            }

            await interactionHandler.safeReply(interaction, { ephemeral: true, content: "⏸️ Paused." });

        } else if (player.paused) {
            player.pause(false);
            logger.log(`Resumed`, interaction);

            const embed = embedBuilder.buildNowPlayingEmbed(
                {
                    title: currentTrack.title,
                    url: currentTrack.uri,
                    lengthSeconds: Math.floor(currentTrack.duration / 1000),
                    thumbnail: currentTrack.thumbnail || currentTrack.displayThumbnail?.(),
                    author: currentTrack.author,
                    requestedBy: currentTrack.requester,
                    source: currentTrack.sourceName || 'YouTube'
                },
                player.volume,
                currentTrack.requester,
                player,
                queueService.isLooping(guildId)
            );

            const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
                embeds: [embed],
                components: this.buildControlRows(guildId, false, queueService.isLooping(guildId), currentTrack.uri)
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
                    const votingMsg = votingService.getVotingMessage(queue);

                    if (votingService.hasEnoughVotes(queue)) {
                        player.stop();
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
            if (player.playing || player.paused) {
                player.stop();
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
        const player = lavalinkService.getPlayer(guildId);
        
        if (!player) {
            return await interactionHandler.safeReply(interaction, { 
                ephemeral: true, 
                embeds: [embedBuilder.buildInfoEmbed("🧾 Current Queue", "_Queue is empty._")] 
            });
        }

        const currentTrack = player.queue.current;
        const queueList = player.queue;

        if (currentTrack) {
            lines.push(`**Now** — [${currentTrack.title}](${currentTrack.uri}) \`${fmtDur(Math.floor(currentTrack.duration / 1000))}\``);
        }

        if (queueList.length === 0) {
            lines.push("_Queue is empty._");
        } else {
            queueList.slice(0, 10).forEach((t, idx) => {
                lines.push(`**#${idx + 1}** — [${t.title}](${t.uri}) \`${fmtDur(Math.floor(t.duration / 1000))}\` • ${t.author}`);
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

        const currentTrack = player.queue.current;

        const embed = embedBuilder.buildNowPlayingEmbed(
            {
                title: currentTrack.title,
                url: currentTrack.uri,
                lengthSeconds: Math.floor(currentTrack.duration / 1000),
                thumbnail: currentTrack.thumbnail || currentTrack.displayThumbnail?.(),
                author: currentTrack.author,
                requestedBy: currentTrack.requester,
                source: currentTrack.sourceName || 'YouTube'
            },
            player.volume,
            currentTrack.requester,
            player,
            isLooped
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, player.paused, isLooped, currentTrack.uri)
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
        player.setVolume(newVolume);
        
        logger.log(`Volume changed: ${newVolume}`, interaction);

        const currentTrack = player.queue.current;

        const embed = embedBuilder.buildNowPlayingEmbed(
            {
                title: currentTrack.title,
                url: currentTrack.uri,
                lengthSeconds: Math.floor(currentTrack.duration / 1000),
                thumbnail: currentTrack.thumbnail || currentTrack.displayThumbnail?.(),
                author: currentTrack.author,
                requestedBy: currentTrack.requester,
                source: currentTrack.sourceName || 'YouTube'
            },
            newVolume,
            currentTrack.requester,
            player,
            queueService.isLooping(guildId)
        );

        const result = await interactionHandler.safeEdit(queueService.getNowMessage(guildId), {
            embeds: [embed],
            components: this.buildControlRows(guildId, player.paused, queueService.isLooping(guildId), currentTrack.uri)
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
            const player = lavalinkService.getPlayer(guildId);
            
            if (player) {
                player.stop();
            }
            
            await votingMsg.edit({ content: "⏭️ Track skipped by vote.", components: [] });
            votingService.endVoting(queue);
            logger.log(`Track skipped by vote (${MIN_VOTES_REQUIRED}+)`, interaction);
        }
    }
}

module.exports = new ControlsController();