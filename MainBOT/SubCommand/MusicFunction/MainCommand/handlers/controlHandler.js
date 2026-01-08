/**
 * Control Handler
 * Handles playback controls: stop, skip, pause, vote skip
 */

const musicService = require('../../Service/MusicService');
const musicCache = require('../../Repository/MusicCache');
const trackHandler = require('../../Handler/trackHandler');
const { checkSameVoiceChannel } = require('../../Middleware/voiceChannelCheck');
const { SKIP_VOTE_TIMEOUT, MIN_VOTES_REQUIRED } = require('../../Configuration/musicConfig');

module.exports = {
    async handleStop(interaction, guildId) {
        if (!musicService.isConnected(guildId)) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Not connected to any voice channel')],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        await musicService.cleanup(guildId);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('⏹️ Stopped', 'Stopped playback and left the channel.', 'success')]
        });
    },

    async handleSkip(interaction, guildId) {
        const currentTrack = musicService.getCurrentTrack(guildId);
        if (!currentTrack) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Nothing is playing')],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        // Check if vote skip is needed
        const listenerCount = musicService.getListenerCount(guildId, interaction.guild);
        const prefs = musicService.getPreferences(interaction.user.id);

        if (prefs.voteSkipEnabled && listenerCount >= MIN_VOTES_REQUIRED) {
            return await this.handleVoteSkip(interaction, guildId);
        }

        // Disable old now playing buttons first
        await musicService.disableNowPlayingControls(guildId);
        
        // Store the text channel for sending the new embed
        const textChannel = interaction.channel;
        
        // Skip returns the next track that's now playing
        const nextTrack = await musicService.skip(guildId);
        
        // Reply first to acknowledge the skip
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('⏭️ Skipped', `Skipped: **${currentTrack.title}**`, 'success')]
        });
        
        // Send new now playing embed for the next track
        if (nextTrack) {
            // Small delay to ensure track is loaded
            await new Promise(resolve => setTimeout(resolve, 200));
            await musicService.sendNowPlayingEmbed(guildId);
        }
    },

    async handleVoteSkip(interaction, guildId) {
        const queue = musicCache.getQueue(guildId);
        const listenerCount = musicService.getListenerCount(guildId, interaction.guild);
        const requiredVotes = musicCache.getRequiredVotes(listenerCount);

        if (musicService.isSkipVoteActive(guildId)) {
            const result = musicService.addSkipVote(guildId, interaction.user.id);
            if (!result.added) {
                return interaction.reply({ content: '❌ You already voted!', ephemeral: true });
            }

            if (musicService.hasEnoughSkipVotes(guildId)) {
                musicService.endSkipVote(guildId);
                await musicService.skip(guildId);
                return interaction.reply({
                    embeds: [trackHandler.createInfoEmbed('⏭️ Vote Skip Passed', 'Skipping to next track!', 'success')]
                });
            }

            return interaction.reply({
                content: `🗳️ Vote added! **${result.voteCount}/${result.required}** votes`,
                ephemeral: true
            });
        }

        // Start new vote
        const voteResult = musicService.startSkipVote(guildId, interaction.user.id, listenerCount);
        const currentTrack = musicService.getCurrentTrack(guildId);

        const embed = trackHandler.createSkipVoteEmbed(currentTrack, voteResult.voteCount, voteResult.required, SKIP_VOTE_TIMEOUT);
        const row = trackHandler.createSkipVoteButton(guildId, voteResult.voteCount, voteResult.required);

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Set timeout
        const queue2 = musicCache.getQueue(guildId);
        if (queue2) {
            // Clear any existing timeout to prevent memory leaks
            if (queue2.skipVoteTimeout) clearTimeout(queue2.skipVoteTimeout);
            queue2.skipVoteTimeout = setTimeout(async () => {
                try {
                    musicService.endSkipVote(guildId);
                    await message.edit({
                        embeds: [trackHandler.createInfoEmbed('⏱️ Vote Expired', 'Not enough votes to skip.', 'warning')],
                        components: []
                    }).catch(() => {});
                } catch (error) {
                    console.error('Error in skip vote timeout:', error);
                }
            }, SKIP_VOTE_TIMEOUT);
        }
    },

    async handlePause(interaction, guildId) {
        if (!musicService.isConnected(guildId)) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Not connected to any voice channel')],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        const isPaused = await musicService.togglePause(guildId);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed(
                isPaused ? '⏸️ Paused' : '▶️ Resumed',
                isPaused ? 'Playback paused' : 'Playback resumed',
                'success'
            )]
        });
    },

    async handleVolume(interaction, guildId) {
        if (!musicService.isConnected(guildId)) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Not connected to any voice channel')],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        const level = interaction.options.getInteger('level');
        const newVolume = await musicService.setVolume(guildId, level);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🔊 Volume', `Volume set to **${newVolume}%**`, 'success')]
        });
    },

    async handleLoop(interaction, guildId) {
        if (!musicService.isConnected(guildId)) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Not connected to any voice channel')],
                ephemeral: true
            });
        }

        const mode = interaction.options.getString('mode');
        let newMode;

        if (mode) {
            musicService.setLoopMode(guildId, mode);
            newMode = mode;
        } else {
            newMode = musicService.toggleLoop(guildId);
        }

        const modeDisplay = {
            'off': '➡️ Off',
            'track': '🔂 Track Loop',
            'queue': '🔁 Queue Loop'
        };

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('🔁 Loop Mode', `Loop mode: **${modeDisplay[newMode]}**`, 'success')]
        });
    },

    async handleShuffle(interaction, guildId) {
        if (!musicService.isConnected(guildId)) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Not connected to any voice channel')],
                ephemeral: true
            });
        }

        const isShuffled = musicService.toggleShuffle(guildId);

        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed(
                '🔀 Shuffle',
                isShuffled ? 'Queue shuffled!' : 'Queue restored to original order',
                'success'
            )]
        });
    },

    async handleSeek(interaction, guildId) {
        const timeStr = interaction.options.getString('time');
        const currentTrack = musicService.getCurrentTrack(guildId);

        if (!currentTrack) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Nothing is playing')],
                ephemeral: true
            });
        }

        const botChannelId = musicService.getVoiceChannelId(guildId);
        if (!await checkSameVoiceChannel(interaction, botChannelId)) return;

        // Parse time (supports "1:30", "90", "0:30", "1:30:00")
        let seconds;
        if (timeStr.includes(':')) {
            const parts = timeStr.split(':').map(p => parseInt(p) || 0);
            // Validate each part is a valid number
            if (parts.some(p => isNaN(p) || p < 0)) {
                return interaction.reply({
                    embeds: [trackHandler.createErrorEmbed('Invalid time format. Use "1:30" or "90".')],
                    ephemeral: true
                });
            }
            if (parts.length === 2) {
                // Validate minutes:seconds format (seconds should be 0-59 in proper format)
                const [mins, secs] = parts;
                seconds = mins * 60 + secs;
            } else if (parts.length === 3) {
                const [hours, mins, secs] = parts;
                seconds = hours * 3600 + mins * 60 + secs;
            } else {
                seconds = NaN;
            }
        } else {
            seconds = parseInt(timeStr);
        }

        if (isNaN(seconds) || seconds < 0) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Invalid time format. Use "1:30" or "90".')],
                ephemeral: true
            });
        }

        if (seconds > currentTrack.lengthSeconds) {
            return interaction.reply({
                embeds: [trackHandler.createErrorEmbed('Cannot seek past the end of the track')],
                ephemeral: true
            });
        }

        const player = musicService.getPlayer(guildId);
        if (player) {
            await player.seekTo(seconds * 1000);
        }

        const { fmtDur } = require('../../Utility/formatters');
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed('⏩ Seeked', `Seeked to **${fmtDur(seconds)}**`, 'success')]
        });
    }
};
