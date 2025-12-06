const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const queueService = require('../Service/QueueService');
const voiceService = require('../Service/VoiceService');
const trackResolverService = require('../Service/TrackResolverService');
const lavalinkService = require('../Service/LavalinkService');
const votingService = require('../Service/VotingService');

const embedBuilder = require('../Utility/embedBuilder');
const logger = require('../Utility/logger');

const { checkVoiceChannel, checkVoicePermissions } = require('../Middleware/voiceChannelCheck');
const interactionHandler = require('../Middleware/interactionHandler');

const { MAX_TRACK_DURATION, CONFIRMATION_TIMEOUT, MIN_VOTES_REQUIRED, SKIP_VOTE_TIMEOUT } = require('../Configuration/MusicConfig');

const PlaybackController = require('../Controller/PlaybackController');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Play a song or playlist in your voice channel")
        .addStringOption(o =>
            o.setName("query").setDescription("Song name, YouTube URL, or Playlist URL").setRequired(true)
        )
        .addBooleanOption(o =>
            o.setName("shuffle").setDescription("Shuffle the playlist (only for playlists)").setRequired(false)
        )
        .addBooleanOption(o =>
            o.setName("priorityfirst").setDescription("Request this song to play next (requires voting if 3+ listeners)").setRequired(false)
        ),

    async execute(interaction) {
        logger.log(`Command invoked by ${interaction.user.tag} (${interaction.user.id})`, interaction);

        if (!lavalinkService.isReady) {
            return interaction.reply({
                embeds: [embedBuilder.buildErrorEmbed("⏳ Music system is starting up. Please try again in a few seconds.")],
                ephemeral: true
            });
        }

        if (!await checkVoiceChannel(interaction)) return;
        if (!await checkVoicePermissions(interaction)) return;

        const query = interaction.options.getString("query");
        const shouldShuffle = interaction.options.getBoolean("shuffle") || false;
        const priorityFirst = interaction.options.getBoolean("priorityfirst") || false;
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        const isPlaylist = trackResolverService.isPlaylistUrl(query);

        if (isPlaylist) {
            if (priorityFirst) {
                return interaction.editReply({
                    embeds: [embedBuilder.buildErrorEmbed("❌ Priority First is only available for single tracks, not playlists.")],
                });
            }
            return await this.handlePlaylist(interaction, query, guildId, shouldShuffle);
        } else {
            return await this.handleSingleTrack(interaction, query, guildId, priorityFirst);
        }
    },

    async handleSingleTrack(interaction, query, guildId, priorityFirst) {
        let trackData;
        try {
            logger.log(`Resolving track for query: ${query}`, interaction);
            trackData = await trackResolverService.resolve(query, interaction.user);
            logger.log(`Track resolved: ${trackData.title} (${trackData.url})`, interaction);
        } catch (e) {
            let msg = "Could not fetch video info. Make sure it's a valid YouTube URL or search query.";
            if (e.message === "NO_RESULTS") msg = "No results found for your search.";
            if (e.message.includes("not ready")) msg = "⏳ Music system is still starting up. Please try again in a moment.";
            logger.error(`Track resolve error: ${e.message}`, interaction);
            return interaction.editReply({
                embeds: [embedBuilder.buildErrorEmbed(msg)],
            });
        }

        if (trackResolverService.isLongTrack(trackData, MAX_TRACK_DURATION)) {
            const confirmed = await this.handleLongTrackConfirmation(interaction, trackData);
            if (!confirmed) return;
        }

        try {
            logger.log(`Ensuring connection`, interaction);
            console.log(`[Play Command] Connecting to voice channel...`);
            let player = await voiceService.connect(interaction, guildId);
            console.log(`[Play Command] Player obtained:`, !!player);

            voiceService.monitorVoiceChannel(guildId, interaction.channel, async (gid) => {
                await queueService.cleanup(gid);
                await interaction.channel.send({ embeds: [embedBuilder.buildNoUserVCEmbed()] });
            });

            console.log(`[Play Command] Binding player events...`);
            PlaybackController.bindPlayerEvents(guildId, interaction);

            const wasPlaying = player.track !== null;

            if (priorityFirst) {
                const listeners = voiceService.getListeners(guildId, interaction.guild);
                
                if (listeners.length >= 3) {
                    const confirmed = await this.handlePriorityVote(interaction, trackData, guildId);
                    if (!confirmed) {
                        const position = queueService.addTrack(guildId, trackData);
                        const queuedEmbed = embedBuilder.buildQueuedEmbed(trackData, position, interaction.user);
                        await interaction.editReply({ embeds: [queuedEmbed], components: [] });
                        logger.log(`Priority denied, track added to back of queue`, interaction);
                        return;
                    }
                }

                queueService.addTrackToFront(guildId, trackData);
                logger.log(`Track added to front of queue (priority)`, interaction);

                const priorityEmbed = embedBuilder.buildPriorityQueuedEmbed(trackData, interaction.user);
                await interaction.editReply({ embeds: [priorityEmbed], components: [] });
            } else {
                const position = queueService.addTrack(guildId, trackData);
                console.log(`[Play Command] Track added at position ${position}`);

                const queuedEmbed = embedBuilder.buildQueuedEmbed(trackData, position, interaction.user);
                await interaction.editReply({ embeds: [queuedEmbed], components: [] });
            }

            if (!wasPlaying) {
                console.log(`[Play Command] Nothing was playing, starting playback...`);
                const nextTrack = queueService.nextTrack(guildId);
                
                if (nextTrack) {
                    logger.log(`Starting first track: ${nextTrack.title}`, interaction);
                    await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                }
            }
        } catch (err) {
            logger.error(`Connection error: ${err.message}`, interaction);
            await interaction.followUp({
                embeds: [
                    embedBuilder.buildErrorEmbed(
                        err.message === "NO_VC" ? "Join a voice channel." : "Failed to connect to voice channel."
                    ),
                ],
                ephemeral: true,
            });
            return;
        }
    },

    async handlePriorityVote(interaction, trackData, guildId) {
        logger.log(`Priority vote requested for: ${trackData.title}`, interaction);

        const voteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("priority_yes").setLabel("✅ Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("priority_no").setLabel("❌ No").setStyle(ButtonStyle.Danger)
        );

        const voteEmbed = embedBuilder.buildPriorityVoteEmbed(trackData, interaction.user);
        
        const voteMsg = await interaction.editReply({
            embeds: [voteEmbed],
            components: [voteRow]
        });

        const queue = queueService.getOrCreateQueue(guildId);
        votingService.startPriorityVote(queue, interaction.user.id);

        const filter = i => ["priority_yes", "priority_no"].includes(i.customId);

        const collector = voteMsg.createMessageComponentCollector({
            filter,
            time: SKIP_VOTE_TIMEOUT
        });

        return new Promise((resolve) => {
            const timeout = setTimeout(async () => {
                collector.stop();
                const hasEnough = votingService.hasEnoughPriorityVotes(queue);
                votingService.endPriorityVoting(queue);

                if (hasEnough) {
                    await voteMsg.edit({
                        embeds: [embedBuilder.buildInfoEmbed("✅ Priority Approved", `**${trackData.title}** will play next!`)],
                        components: []
                    });
                    logger.log(`Priority vote passed`, interaction);
                    resolve(true);
                } else {
                    await voteMsg.edit({
                        embeds: [embedBuilder.buildInfoEmbed("❌ Priority Denied", "Not enough votes. Track added to queue normally.")],
                        components: []
                    });
                    logger.log(`Priority vote failed`, interaction);
                    resolve(false);
                }
            }, SKIP_VOTE_TIMEOUT);

            collector.on('collect', async (i) => {
                if (i.customId === "priority_yes") {
                    const result = votingService.addPriorityVote(queue, i.user.id);
                    
                    if (result.added) {
                        await interactionHandler.safeReply(i, {
                            ephemeral: true,
                            content: `✅ Your vote has been counted! (${result.count}/${MIN_VOTES_REQUIRED})`
                        });

                        if (votingService.hasEnoughPriorityVotes(queue)) {
                            clearTimeout(timeout);
                            collector.stop();
                            votingService.endPriorityVoting(queue);

                            await voteMsg.edit({
                                embeds: [embedBuilder.buildInfoEmbed("✅ Priority Approved", `**${trackData.title}** will play next!`)],
                                components: []
                            });
                            logger.log(`Priority vote passed`, interaction);
                            resolve(true);
                        }
                    } else {
                        await interactionHandler.safeReply(i, {
                            ephemeral: true,
                            content: "You already voted!"
                        });
                    }
                } else if (i.customId === "priority_no") {
                    await interactionHandler.safeReply(i, {
                        ephemeral: true,
                        content: "❌ You voted against priority."
                    });
                }
            });
        });
    },

    async handlePlaylist(interaction, query, guildId, shouldShuffle) {
        let playlistData;
        try {
            logger.log(`Resolving playlist for query: ${query}`, interaction);
            playlistData = await trackResolverService.resolvePlaylist(query, interaction.user);
            logger.log(`Playlist resolved: ${playlistData.name} with ${playlistData.trackCount} tracks`, interaction);
        } catch (e) {
            let msg = "Could not fetch playlist info. Make sure it's a valid playlist URL.";
            if (e.message === "NO_RESULTS") msg = "No tracks found in the playlist.";
            if (e.message === "NOT_A_PLAYLIST") msg = "The provided URL is not a playlist.";
            if (e.message.includes("not ready")) msg = "⏳ Music system is still starting up. Please try again in a moment.";
            logger.error(`Playlist resolve error: ${e.message}`, interaction);
            return interaction.editReply({
                embeds: [embedBuilder.buildErrorEmbed(msg)],
            });
        }

        const MAX_PLAYLIST_SIZE = 250;
        if (playlistData.trackCount > MAX_PLAYLIST_SIZE) {
            playlistData.tracks = playlistData.tracks.slice(0, MAX_PLAYLIST_SIZE);
            playlistData.trackCount = MAX_PLAYLIST_SIZE;
        }

        try {
            logger.log(`Connecting to voice channel for playlist`, interaction);
            let player = await voiceService.connect(interaction, guildId);

            voiceService.monitorVoiceChannel(guildId, interaction.channel, async (gid) => {
                await queueService.cleanup(gid);
                await interaction.channel.send({ embeds: [embedBuilder.buildNoUserVCEmbed()] });
            });

            PlaybackController.bindPlayerEvents(guildId, interaction);

            const wasPlaying = player.track !== null;

            let addedCount = 0;
            for (const track of playlistData.tracks) {
                queueService.addTrack(guildId, track);
                addedCount++;
            }

            if (shouldShuffle) {
                queueService.setShuffle(guildId, true);
                logger.log(`Playlist shuffled on add`, interaction);
            }

            logger.log(`Added ${addedCount} tracks from playlist`, interaction);

            const playlistEmbed = embedBuilder.buildPlaylistQueuedEmbed(
                playlistData.name, 
                addedCount, 
                interaction.user,
                playlistData.tracks[0]
            );
            await interaction.editReply({ embeds: [playlistEmbed], components: [] });

            if (!wasPlaying) {
                console.log(`[Play Command] Nothing was playing, starting playlist...`);
                const nextTrack = queueService.nextTrack(guildId);
                
                if (nextTrack) {
                    logger.log(`Starting first track from playlist: ${nextTrack.title}`, interaction);
                    await player.playTrack({ track: { encoded: nextTrack.track.encoded } });
                }
            }
        } catch (err) {
            logger.error(`Playlist connection error: ${err.message}`, interaction);
            await interaction.followUp({
                embeds: [
                    embedBuilder.buildErrorEmbed(
                        err.message === "NO_VC" ? "Join a voice channel." : "Failed to connect to voice channel."
                    ),
                ],
                ephemeral: true,
            });
            return;
        }
    },

    async handleLongTrackConfirmation(interaction, track) {
        logger.log(`Long video detected: ${track.title} (${track.lengthSeconds}s)`, interaction);

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("confirm_yes").setLabel("Yes").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("confirm_no").setLabel("No").setStyle(ButtonStyle.Danger)
        );

        await interaction.editReply({
            embeds: [embedBuilder.buildLongVideoConfirmEmbed(track)],
            components: [confirmRow],
        });

        const filter = i =>
            i.user.id === interaction.user.id &&
            ["confirm_yes", "confirm_no"].includes(i.customId);

        try {
            const btnInt = await interaction.channel.awaitMessageComponent({
                filter,
                time: CONFIRMATION_TIMEOUT
            });

            logger.log(`Confirmation button pressed: ${btnInt.customId}`, interaction);

            if (btnInt.customId === "confirm_no") {
                await btnInt.update({
                    embeds: [embedBuilder.buildInfoEmbed("❌ Cancelled", "Playback cancelled.")],
                    components: [],
                });
                logger.log(`Playback cancelled by user`, interaction);
                return false;
            }

            await btnInt.update({
                embeds: [embedBuilder.buildInfoEmbed("✅ Confirmed", "Added to the queue and will play soon!")],
                components: [],
            });
            logger.log(`Track confirmed and added to queue`, interaction);
            return true;

        } catch (err) {
            logger.error(`Confirmation timeout or error: ${err}`, interaction);
            await interaction.editReply({
                embeds: [embedBuilder.buildInfoEmbed("❌ Timeout", "No response. Playback cancelled.")],
                components: [],
            });
            return false;
        }
    }
};