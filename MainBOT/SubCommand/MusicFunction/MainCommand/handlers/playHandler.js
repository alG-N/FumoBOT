/**
 * Play Handler
 * Handles play, playlist, and related functionality
 */

const musicService = require('../../Service/MusicService');
const musicCache = require('../../Repository/MusicCache');
const trackHandler = require('../../Handler/trackHandler');
const { checkVoiceChannel, checkVoicePermissions } = require('../../Middleware/voiceChannelCheck');
const { MAX_TRACK_DURATION, CONFIRMATION_TIMEOUT, MIN_VOTES_REQUIRED } = require('../../Configuration/musicConfig');

// Store pending long track confirmations (cleared after timeout)
const pendingLongTracks = new Map();

module.exports = {
    // Expose pendingLongTracks for buttonHandler
    pendingLongTracks,
    
    async handlePlay(interaction, guildId, userId) {
        // Check Lavalink
        if (!musicService.isLavalinkReady()) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Music service is not available. Please try again later.')],
                ephemeral: true
            });
        }

        // Voice channel checks
        if (!await checkVoiceChannel(interaction)) return;
        if (!await checkVoicePermissions(interaction)) return;

        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const shouldShuffle = interaction.options.getBoolean('shuffle') || false;
        const priority = interaction.options.getBoolean('priority') || false;

        try {
            // Connect to voice
            await musicService.connect(interaction);

            // Check if playlist
            if (this.isPlaylistUrl(query)) {
                return await this.handlePlaylistAdd(interaction, query, guildId, shouldShuffle);
            }

            // Single track
            const trackData = await musicService.search(query, interaction.user);

            if (!trackData || !trackData.track) {
                return interaction.editReply({
                    embeds: [trackHandler.createErrorEmbed(`No results found for: \`${query}\``)]
                });
            }

            // Check duration
            const prefs = musicService.getPreferences(userId);
            if (trackData.lengthSeconds > prefs.maxTrackDuration) {
                return await this.handleLongTrackConfirmation(interaction, trackData, guildId, prefs.maxTrackDuration);
            }

            // Add track
            const currentTrack = musicService.getCurrentTrack(guildId);
            
            if (priority && currentTrack) {
                // Priority requires vote if 5+ listeners
                const listenerCount = musicService.getListenerCount(guildId, interaction.guild);
                if (listenerCount >= MIN_VOTES_REQUIRED) {
                    return await this.handlePriorityVote(interaction, trackData, guildId);
                }
                musicService.addTrackToFront(guildId, trackData);
            } else {
                musicService.addTrack(guildId, trackData);
            }

            // Add to user history
            musicService.addToHistory(userId, trackData);

            // Start playing if nothing is playing
            if (!currentTrack) {
                const nextTrack = musicService.getQueueList(guildId)[0];
                if (nextTrack) {
                    musicService.removeTrack(guildId, 0);
                    await musicService.playTrack(guildId, nextTrack);

                    // Get listener count and vote skip status for embed
                    const listenerCount = musicService.getListenerCount(guildId, interaction.guild);
                    const voteSkipStatus = musicCache.getVoteSkipStatus(guildId, listenerCount);

                    // Send now playing with controls
                    const embed = trackHandler.createNowPlayingEmbed(nextTrack, {
                        volume: musicService.getVolume(guildId),
                        queueLength: musicService.getQueueLength(guildId),
                        voteSkipCount: voteSkipStatus.count,
                        voteSkipRequired: voteSkipStatus.required,
                        listenerCount: listenerCount
                    });
                    const rows = trackHandler.createControlButtons(guildId, {
                        trackUrl: nextTrack.url,
                        userId,
                        listenerCount: listenerCount
                    });

                    const message = await interaction.editReply({ embeds: [embed], components: rows });
                    musicService.setNowPlayingMessage(guildId, message);
                    
                    // Start VC monitor
                    musicService.startVCMonitor(guildId, interaction.guild);
                }
            } else {
                // Send queued message
                const position = musicService.getQueueLength(guildId);
                const embed = priority && position === 1
                    ? trackHandler.createPriorityQueuedEmbed(trackData, interaction.user)
                    : trackHandler.createQueuedEmbed(trackData, position, interaction.user);

                await interaction.editReply({ embeds: [embed] });
                
                // QoL: Update the now playing embed to show updated queue/next up info
                await this.refreshNowPlayingMessage(guildId, interaction.user.id, interaction.guild);
            }
        } catch (error) {
            console.error('[Play Error]', error);
            return interaction.editReply({
                embeds: [trackHandler.createErrorEmbed(error.message || 'Failed to play track')]
            });
        }
    },

    async handlePlaylistAdd(interaction, query, guildId, shouldShuffle) {
        try {
            const playlistData = await musicService.searchPlaylist(query, interaction.user);

            if (!playlistData || playlistData.tracks.length === 0) {
                return interaction.editReply({
                    embeds: [trackHandler.createErrorEmbed('No tracks found in playlist')]
                });
            }

            let tracks = playlistData.tracks;
            
            if (shouldShuffle) {
                // Shuffle tracks
                for (let i = tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
                }
            }

            musicService.addTracks(guildId, tracks);

            // Start playing if nothing is playing
            const currentTrack = musicService.getCurrentTrack(guildId);
            if (!currentTrack) {
                const nextTrack = musicService.getQueueList(guildId)[0];
                if (nextTrack) {
                    musicService.removeTrack(guildId, 0);
                    await musicService.playTrack(guildId, nextTrack);

                    const embed = trackHandler.createPlaylistEmbed(
                        playlistData.name,
                        playlistData.tracks.length,
                        interaction.user,
                        nextTrack
                    );

                    const message = await interaction.editReply({ embeds: [embed] });
                    musicService.setNowPlayingMessage(guildId, message);
                    musicService.startVCMonitor(guildId, interaction.guild);
                }
            } else {
                const embed = trackHandler.createPlaylistEmbed(
                    playlistData.name,
                    playlistData.tracks.length,
                    interaction.user,
                    tracks[0]
                );
                await interaction.editReply({ embeds: [embed] });
                
                // QoL: Update the now playing embed to show updated queue/next up info
                await this.refreshNowPlayingMessage(guildId, interaction.user.id, interaction.guild);
            }
        } catch (error) {
            console.error('[Playlist Error]', error);
            return interaction.editReply({
                embeds: [trackHandler.createErrorEmbed(error.message || 'Failed to load playlist')]
            });
        }
    },

    async handleLongTrackConfirmation(interaction, trackData, guildId, maxDuration) {
        // Generate unique confirmation ID
        const confirmId = `${guildId}_${Date.now()}`;
        
        // Store the pending track data
        pendingLongTracks.set(confirmId, {
            trackData,
            guildId,
            userId: interaction.user.id,
            channelId: interaction.channel.id,
            guild: interaction.guild,
            expiresAt: Date.now() + CONFIRMATION_TIMEOUT
        });
        
        // Auto-cleanup after timeout
        setTimeout(() => {
            pendingLongTracks.delete(confirmId);
        }, CONFIRMATION_TIMEOUT + 1000);
        
        const embed = trackHandler.createLongVideoConfirmEmbed(trackData, maxDuration);
        const row = trackHandler.createConfirmButtons(confirmId, 'longtrack');

        await interaction.editReply({ embeds: [embed], components: [row] });
    },

    /**
     * Handle long track confirmation button press
     * Called from buttonHandler
     */
    async handleLongTrackButton(interaction, confirmId, answer) {
        const pending = pendingLongTracks.get(confirmId);
        
        if (!pending) {
            return interaction.reply({
                content: '⏱️ This confirmation has expired. Please use `/music play` again.',
                ephemeral: true
            });
        }
        
        // Check if same user
        if (pending.userId !== interaction.user.id) {
            return interaction.reply({
                content: '❌ Only the person who requested this track can confirm.',
                ephemeral: true
            });
        }
        
        // Remove from pending
        pendingLongTracks.delete(confirmId);
        
        const { trackData, guildId, guild } = pending;
        
        try {
            if (answer === 'yes') {
                // Defer the update first
                await interaction.deferUpdate();
                
                musicService.addTrack(guildId, trackData);
                
                // Start playing if nothing is currently playing
                const currentTrack = musicService.getCurrentTrack(guildId);
                if (!currentTrack) {
                    const nextTrack = musicService.getQueueList(guildId)[0];
                    if (nextTrack) {
                        musicService.removeTrack(guildId, 0);
                        
                        // Update the confirmation message
                        await interaction.editReply({ 
                            content: '✅ **Track added!** Starting playback...',
                            embeds: [], 
                            components: [] 
                        });

                        // Start playback
                        await musicService.playTrack(guildId, nextTrack);

                        // Send now playing as a new message
                        const queueList = musicService.getQueueList(guildId);
                        const listenerCount = musicService.getListenerCount(guildId, guild);
                        const voteSkipStatus = musicCache.getVoteSkipStatus(guildId, listenerCount);

                        const embed = trackHandler.createNowPlayingEmbed(nextTrack, {
                            volume: musicService.getVolume(guildId),
                            queueLength: queueList.length,
                            nextTrack: queueList[0] || null,
                            voteSkipCount: voteSkipStatus.count,
                            voteSkipRequired: voteSkipStatus.required,
                            listenerCount: listenerCount
                        });
                        const rows = trackHandler.createControlButtons(guildId, {
                            trackUrl: nextTrack.url,
                            userId: interaction.user.id,
                            listenerCount: listenerCount
                        });

                        const nowPlayingMessage = await interaction.channel.send({ embeds: [embed], components: rows });
                        musicService.setNowPlayingMessage(guildId, nowPlayingMessage);
                        
                        // Start VC monitor
                        musicService.startVCMonitor(guildId, guild);
                    }
                } else {
                    // Something is already playing, just show queued message
                    const position = musicService.getQueueLength(guildId);
                    const queuedEmbed = trackHandler.createQueuedEmbed(trackData, position, interaction.user);
                    await interaction.editReply({ embeds: [queuedEmbed], components: [] });
                }
            } else {
                await interaction.update({
                    embeds: [trackHandler.createInfoEmbed('❌ Cancelled', 'Track was not added.')],
                    components: []
                });
            }
        } catch (error) {
            console.error('[Play] Error handling long track button:', error.message);
            await interaction.editReply({
                content: '❌ An error occurred. Please try again.',
                embeds: [],
                components: []
            }).catch(() => {});
        }
    },

    async handlePriorityVote(interaction, trackData, guildId) {
        const embed = trackHandler.createInfoEmbed(
            '🗳️ Vote Required',
            `Priority play requires ${MIN_VOTES_REQUIRED} votes.\nThis feature is coming soon!`
        );
        await interaction.editReply({ embeds: [embed] });
    },

    // Helper to refresh now playing message
    async refreshNowPlayingMessage(guildId, userId, guild = null) {
        try {
            const nowPlayingMsg = musicService.getNowPlayingMessage(guildId);
            if (!nowPlayingMsg) return;

            const currentTrack = musicService.getCurrentTrack(guildId);
            if (!currentTrack) return;

            const queue = musicCache.getQueue(guildId);
            const queueList = musicService.getQueueList(guildId);
            const listenerCount = guild ? musicService.getListenerCount(guildId, guild) : 0;
            const voteSkipStatus = musicCache.getVoteSkipStatus(guildId, listenerCount);

            const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                volume: musicService.getVolume(guildId),
                isPaused: queue?.isPaused || false,
                loopMode: musicService.getLoopMode(guildId),
                isShuffled: musicService.isShuffled(guildId),
                queueLength: queueList.length,
                nextTrack: queueList[0] || null,
                loopCount: musicService.getLoopCount(guildId),
                voteSkipCount: voteSkipStatus.count,
                voteSkipCount: voteSkipStatus.count,
                voteSkipRequired: voteSkipStatus.required,
                listenerCount: listenerCount
            });

            const rows = trackHandler.createControlButtons(guildId, {
                isPaused: queue?.isPaused || false,
                loopMode: musicService.getLoopMode(guildId),
                isShuffled: musicService.isShuffled(guildId),
                trackUrl: currentTrack.url,
                userId: userId,
                listenerCount: listenerCount
            });

            await nowPlayingMsg.edit({ embeds: [embed], components: rows }).catch(() => {});
        } catch (e) {
            // Silently ignore errors
        }
    },

    isPlaylistUrl(query) {
        if (query.includes('youtube.com') && query.includes('list=')) return true;
        if (query.includes('spotify.com/playlist/')) return true;
        if (query.includes('spotify.com/album/')) return true;
        return false;
    }
};
