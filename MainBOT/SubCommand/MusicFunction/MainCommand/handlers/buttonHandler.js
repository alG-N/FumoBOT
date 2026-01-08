/**
 * Button Handler
 * Handles all button interactions for music controls
 */

const musicService = require('../../Service/MusicService');
const musicCache = require('../../Repository/MusicCache');
const trackHandler = require('../../Handler/trackHandler');
const { checkSameVoiceChannel } = require('../../Middleware/voiceChannelCheck');
const { SKIP_VOTE_TIMEOUT, MIN_VOTES_REQUIRED } = require('../../Configuration/musicConfig');

module.exports = {
    async handleButton(interaction) {
        const parts = interaction.customId.split(':');
        const action = parts[0];
        const guildId = parts[1];

        // Voice channel check for most actions
        const voiceRequiredActions = [
            'music_pause', 'music_stop', 'music_skip', 'music_loop',
            'music_shuffle', 'music_voldown', 'music_volup', 'music_voteskip',
            'music_voteskip_add'
        ];

        if (voiceRequiredActions.includes(action)) {
            const botChannelId = musicService.getVoiceChannelId(guildId);
            if (!await checkSameVoiceChannel(interaction, botChannelId)) return;
        }

        switch (action) {
            case 'music_pause':
                return await this.handleButtonPause(interaction, guildId);
            case 'music_stop':
                return await this.handleButtonStop(interaction, guildId);
            case 'music_skip':
                return await this.handleButtonSkip(interaction, guildId);
            case 'music_loop':
                return await this.handleButtonLoop(interaction, guildId);
            case 'music_shuffle':
                return await this.handleButtonShuffle(interaction, guildId);
            case 'music_voldown':
                return await this.handleButtonVolume(interaction, guildId, -10);
            case 'music_volup':
                return await this.handleButtonVolume(interaction, guildId, 10);
            case 'music_queue':
                return await this.handleButtonQueue(interaction, guildId);
            case 'music_fav':
                return await this.handleButtonFavorite(interaction, guildId, parts[2]);
            case 'music_voteskip':
            case 'music_voteskip_add':
                return await this.handleButtonVoteSkip(interaction, guildId);
            case 'music_lyrics':
                return await this.handleButtonLyrics(interaction, guildId);
            case 'music_qpage':
                return await this.handleButtonQueuePage(interaction, guildId, parts[2]);
            default:
                console.log(`Unknown music button: ${action}`);
        }
    },

    async handleButtonPause(interaction, guildId) {
        try {
            await interaction.deferUpdate();
            
            const isPaused = await musicService.togglePause(guildId);
            
            const currentTrack = musicService.getCurrentTrack(guildId);
            if (currentTrack) {
                const queue = musicCache.getQueue(guildId);
                const queueList = musicService.getQueueList(guildId);

                const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                    volume: musicService.getVolume(guildId),
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    queueLength: queueList.length,
                    nextTrack: queueList[0] || null
                });

                const rows = trackHandler.createControlButtons(guildId, {
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    trackUrl: currentTrack.url,
                    userId: interaction.user.id
                });

                await interaction.editReply({ embeds: [embed], components: rows });
            }
        } catch (error) {
            console.error('Pause button error:', error);
        }
    },

    async handleButtonStop(interaction, guildId) {
        try {
            await interaction.deferUpdate();
            
            await musicService.cleanup(guildId);
            
            try {
                await interaction.editReply({
                    embeds: [trackHandler.createStoppedByUserEmbed(interaction.user)],
                    components: []
                });
            } catch (editError) {
                // Message might be deleted or interaction expired
                if (editError.code === 10008 || editError.code === 10062) {
                    // Try to send a new message instead
                    try {
                        await interaction.channel?.send({
                            embeds: [trackHandler.createStoppedByUserEmbed(interaction.user)]
                        });
                    } catch {
                        // Channel might not be accessible, ignore
                    }
                }
            }
        } catch (error) {
            console.error('Stop button error:', error);
            // Try ephemeral reply as fallback
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Playback stopped.', ephemeral: true });
                }
            } catch {
                // Ignore if we can't respond
            }
        }
    },

    async handleButtonSkip(interaction, guildId) {
        try {
            const listenerCount = musicService.getListenerCount(guildId, interaction.guild);
            
            if (listenerCount >= MIN_VOTES_REQUIRED) {
                return await this.handleButtonVoteSkip(interaction, guildId);
            }

            await interaction.deferUpdate();
            
            // Disable buttons on the old message
            await musicService.disableNowPlayingControls(guildId);
            
            // Skip returns the next track
            const nextTrack = await musicService.skip(guildId);
            
            // Send new now playing embed for the next track
            if (nextTrack) {
                // Small delay to ensure track is loaded
                await new Promise(resolve => setTimeout(resolve, 200));
                await musicService.sendNowPlayingEmbed(guildId);
            } else {
                // Queue is empty - send finished message
                const queue = musicCache.getQueue(guildId);
                if (queue?.textChannel) {
                    await queue.textChannel.send({
                        embeds: [trackHandler.createQueueFinishedEmbed()]
                    }).catch(() => {});
                }
            }
        } catch (error) {
            console.error('Skip button error:', error);
        }
    },

    async handleButtonLoop(interaction, guildId) {
        try {
            await interaction.deferUpdate();
            
            musicService.toggleLoop(guildId);
            
            const currentTrack = musicService.getCurrentTrack(guildId);
            if (currentTrack) {
                const queue = musicCache.getQueue(guildId);
                const queueList = musicService.getQueueList(guildId);

                const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                    volume: musicService.getVolume(guildId),
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    queueLength: queueList.length,
                    nextTrack: queueList[0] || null
                });

                const rows = trackHandler.createControlButtons(guildId, {
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    trackUrl: currentTrack.url,
                    userId: interaction.user.id
                });

                await interaction.editReply({ embeds: [embed], components: rows });
            }
        } catch (error) {
            console.error('Loop button error:', error);
        }
    },

    async handleButtonShuffle(interaction, guildId) {
        try {
            await interaction.deferUpdate();
            
            musicService.toggleShuffle(guildId);
            
            const currentTrack = musicService.getCurrentTrack(guildId);
            if (currentTrack) {
                const queue = musicCache.getQueue(guildId);
                const queueList = musicService.getQueueList(guildId);

                const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                    volume: musicService.getVolume(guildId),
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    queueLength: queueList.length,
                    nextTrack: queueList[0] || null
                });

                const rows = trackHandler.createControlButtons(guildId, {
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    trackUrl: currentTrack.url,
                    userId: interaction.user.id
                });

                await interaction.editReply({ embeds: [embed], components: rows });
            }
        } catch (error) {
            console.error('Shuffle button error:', error);
        }
    },

    async handleButtonVolume(interaction, guildId, delta) {
        try {
            await interaction.deferUpdate();
            
            await musicService.adjustVolume(guildId, delta);
            
            const currentTrack = musicService.getCurrentTrack(guildId);
            if (currentTrack) {
                const queue = musicCache.getQueue(guildId);
                const queueList = musicService.getQueueList(guildId);

                const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                    volume: musicService.getVolume(guildId),
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    queueLength: queueList.length,
                    nextTrack: queueList[0] || null
                });

                const rows = trackHandler.createControlButtons(guildId, {
                    isPaused: queue?.isPaused || false,
                    loopMode: musicService.getLoopMode(guildId),
                    isShuffled: musicService.isShuffled(guildId),
                    trackUrl: currentTrack.url,
                    userId: interaction.user.id
                });

                await interaction.editReply({ embeds: [embed], components: rows });
            }
        } catch (error) {
            console.error('Volume button error:', error);
        }
    },

    async handleButtonQueue(interaction, guildId) {
        const tracks = musicService.getQueueList(guildId);
        const currentTrack = musicService.getCurrentTrack(guildId);

        const embed = trackHandler.createQueueListEmbed(tracks, currentTrack, {
            loopMode: musicService.getLoopMode(guildId),
            isShuffled: musicService.isShuffled(guildId),
            volume: musicService.getVolume(guildId)
        });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },

    async handleButtonFavorite(interaction, guildId, targetUserId) {
        try {
            const currentTrack = musicService.getCurrentTrack(guildId);
            
            if (!currentTrack) {
                return interaction.reply({ content: '❌ Nothing is playing', ephemeral: true });
            }

            await interaction.deferUpdate();

            const userId = interaction.user.id;
            const isFavorited = musicService.isFavorited(userId, currentTrack.url);

            if (isFavorited) {
                musicService.removeFavorite(userId, currentTrack.url);
            } else {
                musicService.addFavorite(userId, currentTrack);
            }

            const queue = musicCache.getQueue(guildId);
            const queueList = musicService.getQueueList(guildId);

            const embed = trackHandler.createNowPlayingEmbed(currentTrack, {
                volume: musicService.getVolume(guildId),
                isPaused: queue?.isPaused || false,
                loopMode: musicService.getLoopMode(guildId),
                isShuffled: musicService.isShuffled(guildId),
                queueLength: queueList.length,
                nextTrack: queueList[0] || null
            });

            const rows = trackHandler.createControlButtons(guildId, {
                isPaused: queue?.isPaused || false,
                loopMode: musicService.getLoopMode(guildId),
                isShuffled: musicService.isShuffled(guildId),
                trackUrl: currentTrack.url,
                userId: interaction.user.id
            });

            await interaction.editReply({ embeds: [embed], components: rows });
        } catch (error) {
            console.error('Favorite button error:', error);
        }
    },

    async handleButtonLyrics(interaction, guildId) {
        const currentTrack = musicService.getCurrentTrack(guildId);
        
        if (!currentTrack) {
            return interaction.reply({ content: '❌ Nothing is playing', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const lyrics = await this.fetchLyrics(currentTrack.title, currentTrack.author);
            
            if (!lyrics) {
                return interaction.editReply({
                    embeds: [trackHandler.createErrorEmbed(`No lyrics found for **${currentTrack.title}**`)]
                });
            }

            const embed = trackHandler.createLyricsEmbed(currentTrack, lyrics);
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Lyrics fetch error:', error);
            await interaction.editReply({
                embeds: [trackHandler.createErrorEmbed('Failed to fetch lyrics. Please try again.')]
            });
        }
    },

    async fetchLyrics(title, artist) {
        try {
            let cleanTitle = title;
            let cleanArtist = artist || '';
            
            if (title.includes(' - ')) {
                const parts = title.split(' - ');
                if (parts.length >= 2) {
                    cleanArtist = parts[0].trim();
                    cleanTitle = parts.slice(1).join(' - ').trim();
                }
            }
            
            cleanTitle = cleanTitle
                .replace(/\(.*?(official|video|lyrics|audio|music|hd|4k|visualizer|live|remix|cover|version|edit).*?\)/gi, '')
                .replace(/\[.*?(official|video|lyrics|audio|music|hd|4k|visualizer|live|remix|cover|version|edit).*?\]/gi, '')
                .replace(/\(feat\.?.*?\)/gi, '')
                .replace(/\[feat\.?.*?\]/gi, '')
                .replace(/ft\.?\s+.+$/gi, '')
                .replace(/feat\.?\s+.+$/gi, '')
                .replace(/official|video|lyrics|audio|hd|4k|visualizer/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            
            cleanArtist = cleanArtist
                ?.replace(/\s*-\s*Topic$/i, '')
                ?.replace(/VEVO$/i, '')
                ?.replace(/Official$/i, '')
                ?.trim() || '';

            console.log(`[Lyrics] Searching for: "${cleanArtist}" - "${cleanTitle}"`);
            
            if (cleanArtist) {
                const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`);
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.lyrics) {
                        return data.lyrics;
                    }
                }
            }

            const simplifiedTitle = cleanTitle
                .replace(/\(.*?\)/g, '')
                .replace(/\[.*?\]/g, '')
                .trim();
            
            if (cleanArtist && simplifiedTitle !== cleanTitle) {
                const fallback1 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(simplifiedTitle)}`);
                if (fallback1.ok) {
                    const data = await fallback1.json();
                    if (data.lyrics) {
                        return data.lyrics;
                    }
                }
            }

            if (artist && artist !== cleanArtist) {
                const origArtist = artist.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
                const fallback2 = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(origArtist)}/${encodeURIComponent(simplifiedTitle)}`);
                if (fallback2.ok) {
                    const data = await fallback2.json();
                    if (data.lyrics) {
                        return data.lyrics;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Lyrics API error:', error);
            return null;
        }
    },

    async handleButtonVoteSkip(interaction, guildId) {
        const queue = musicCache.getQueue(guildId);
        const listenerCount = musicService.getListenerCount(guildId, interaction.guild);

        // If less than MIN_VOTES_REQUIRED listeners, skip directly
        if (listenerCount < MIN_VOTES_REQUIRED) {
            await interaction.deferUpdate();
            
            const skippedTrack = musicService.getCurrentTrack(guildId);
            await musicService.skip(guildId);
            
            await interaction.channel.send({
                embeds: [trackHandler.createInfoEmbed(
                    '⏭️ Track Skipped',
                    skippedTrack ? `**${skippedTrack.title}** was skipped by ${interaction.user.tag}` : `Track skipped by ${interaction.user.tag}`,
                    'success'
                )]
            }).catch(() => {});
            
            return;
        }

        if (musicService.isSkipVoteActive(guildId)) {
            const result = musicService.addSkipVote(guildId, interaction.user.id);
            
            if (!result.added) {
                return interaction.reply({ content: '❌ You already voted!', ephemeral: true });
            }

            if (musicService.hasEnoughSkipVotes(guildId)) {
                musicService.endSkipVote(guildId);
                const skippedTrack = musicService.getCurrentTrack(guildId);
                await musicService.skip(guildId);
                
                return interaction.update({
                    embeds: [trackHandler.createInfoEmbed('⏭️ Skipped!', `**${skippedTrack?.title || 'Track'}** was skipped by vote!`, 'success')],
                    components: []
                });
            }

            const required = musicCache.getRequiredVotes(queue.skipVoteListenerCount);
            return interaction.reply({
                content: `🗳️ Vote added! **${result.voteCount}/${required}**`,
                ephemeral: true
            });
        }

        // Start new vote
        const voteResult = musicService.startSkipVote(guildId, interaction.user.id, listenerCount);
        const currentTrack = musicService.getCurrentTrack(guildId);

        const embed = trackHandler.createSkipVoteEmbed(currentTrack, voteResult.voteCount, voteResult.required, SKIP_VOTE_TIMEOUT);
        const row = trackHandler.createSkipVoteButton(guildId, voteResult.voteCount, voteResult.required);

        await interaction.reply({ embeds: [embed], components: [row] });

        const q = musicCache.getQueue(guildId);
        if (q) {
            // Clear any existing timeout to prevent memory leaks
            if (q.skipVoteTimeout) clearTimeout(q.skipVoteTimeout);
            q.skipVoteTimeout = setTimeout(async () => {
                try {
                    musicService.endSkipVote(guildId);
                } catch (error) {
                    console.error('Error in skip vote timeout:', error);
                }
            }, SKIP_VOTE_TIMEOUT);
        }
    },

    async handleButtonQueuePage(interaction, guildId, pageAction) {
        await interaction.deferUpdate();
    }
};
