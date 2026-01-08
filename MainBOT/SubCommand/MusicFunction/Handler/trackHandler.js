/**
 * Track Handler
 * Creates embeds, buttons, and handles track display
 * Enhanced UI with rich visuals and descriptive controls
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const musicCache = require('../Repository/MusicCache');
const { fmtDur, formatViewCount } = require('../Utility/formatters');

// Enhanced color scheme with gradient-like feel
const COLORS = {
    playing: '#1DB954',      // Spotify green
    paused: '#FFA500',       // Warm orange
    stopped: '#DC143C',      // Crimson
    queued: '#9B59B6',       // Amethyst purple
    info: '#5865F2',         // Discord blurple
    error: '#ED4245',        // Discord red
    warning: '#FEE75C',      // Discord yellow
    success: '#57F287',      // Discord green
    lyrics: '#E91E63',       // Pink for lyrics
    favorites: '#FF6B9D',    // Soft pink for favorites
    history: '#3498DB'       // Sky blue for history
};

// Loop mode display with enhanced labels
const LOOP_DISPLAY = {
    'off': { emoji: '➡️', text: 'Off', label: 'No Repeat' },
    'track': { emoji: '🔂', text: 'Song', label: 'Repeat Song' },
    'queue': { emoji: '🔁', text: 'Queue', label: 'Repeat All' }
};

// Source platform styling
const SOURCE_PLATFORM = {
    youtube: { emoji: '<:youtube:1234567890>', fallback: '🔴', name: 'YouTube', color: '#FF0000' },
    soundcloud: { emoji: '<:soundcloud:1234567890>', fallback: '🟠', name: 'SoundCloud', color: '#FF5500' },
    spotify: { emoji: '<:spotify:1234567890>', fallback: '🟢', name: 'Spotify', color: '#1DB954' },
    unknown: { emoji: '🎵', fallback: '🎵', name: 'Music', color: COLORS.info }
};

// Visual separators and decorations
const DECORATIONS = {
    line: '───────────────────────────',
    dotLine: '• • • • • • • • • • • • • • •',
    sparkle: '✨',
    musicNote: '♪',
    nowPlaying: '🎶 NOW PLAYING 🎶',
    paused: '⏸️ PAUSED ⏸️'
};

class TrackHandler {
    /**
     * Get source info for a track
     */
    _getSourceInfo(track) {
        const source = track?.source?.toLowerCase() || 'unknown';
        return SOURCE_PLATFORM[source] || SOURCE_PLATFORM.unknown;
    }

    /**
     * Create a visual progress bar
     */
    _createMusicBar(current, total, length = 15) {
        const progress = Math.min(current / total, 1);
        const filled = Math.round(progress * length);
        const empty = length - filled;
        const slider = '🔘';
        
        if (filled === 0) return `${slider}${'▬'.repeat(length)}`;
        if (filled === length) return `${'▬'.repeat(length)}${slider}`;
        return `${'▬'.repeat(filled)}${slider}${'▬'.repeat(empty)}`;
    }

    /**
     * Create now playing embed - Enhanced version
     */
    createNowPlayingEmbed(track, options = {}) {
        const {
            volume = 100,
            isPaused = false,
            loopMode = 'off',
            isShuffled = false,
            queueLength = 0,
            position = 0,
            player = null,
            requester = null,
            nextTrack = null
        } = options;

        const sourceInfo = this._getSourceInfo(track);
        const color = isPaused ? COLORS.paused : COLORS.playing;
        const loopInfo = LOOP_DISPLAY[loopMode];

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: isPaused ? DECORATIONS.paused : DECORATIONS.nowPlaying,
                iconURL: 'https://cdn.discordapp.com/emojis/741605543046807626.gif' // Music wave gif
            })
            .setTitle(track.title)
            .setURL(track.url);

        // Build rich description
        const descLines = [];
        descLines.push(`${DECORATIONS.line}`);
        descLines.push('');
        descLines.push(`👤 **Artist:** ${track.author || 'Unknown Artist'}`);
        descLines.push(`⏱️ **Duration:** \`${fmtDur(track.lengthSeconds)}\``);
        
        if (track.viewCount) {
            descLines.push(`👁️ **Views:** ${formatViewCount(track.viewCount)}`);
        }
        
        descLines.push(`📀 **Source:** ${sourceInfo.fallback} ${sourceInfo.name}`);
        descLines.push('');
        descLines.push(`${DECORATIONS.line}`);

        embed.setDescription(descLines.join('\n'));

        // Status field with visual indicators
        const statusItems = [];
        
        // Volume with visual bar
        const volBar = this._createVolumeBar(volume);
        statusItems.push(`🔊 \`${volume}%\` ${volBar}`);
        
        // Loop status
        statusItems.push(`${loopInfo.emoji} **Loop:** ${loopInfo.label}`);
        
        // Shuffle
        statusItems.push(isShuffled ? '🔀 **Shuffle:** On' : '➡️ **Shuffle:** Off');

        embed.addFields({
            name: '⚙️ Playback Settings',
            value: statusItems.join('\n'),
            inline: false
        });

        // Queue info with visual
        if (queueLength > 0 || nextTrack) {
            const queueLines = [];
            queueLines.push(`📋 **${queueLength}** song${queueLength !== 1 ? 's' : ''} in queue`);
            
            if (nextTrack) {
                queueLines.push('');
                queueLines.push(`⏭️ **Up Next:**`);
                queueLines.push(`┗ ${this._truncate(nextTrack.title, 35)}`);
            }
            
            embed.addFields({
                name: '📊 Queue Status',
                value: queueLines.join('\n'),
                inline: false
            });
        }

        // Thumbnail - use setThumbnail for side display, setImage for large
        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        // Footer with requester info only
        if (track.requestedBy) {
            embed.setFooter({
                text: `Requested by ${track.requestedBy.displayName || track.requestedBy.username}`,
                iconURL: track.requestedBy.displayAvatarURL?.() || null
            });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Create volume bar visual
     */
    _createVolumeBar(volume, length = 8) {
        const maxVol = 200;
        const filled = Math.round((volume / maxVol) * length);
        return '▰'.repeat(Math.min(filled, length)) + '▱'.repeat(Math.max(0, length - filled));
    }

    /**
     * Create control buttons - Enhanced with labels
     */
    createControlButtons(guildId, options = {}) {
        const {
            isPaused = false,
            loopMode = 'off',
            isShuffled = false,
            trackUrl = null,
            userId = ''
        } = options;

        const rows = [];
        const loopInfo = LOOP_DISPLAY[loopMode];

        // Row 1: Main playback controls with labels
        const controlRow = new ActionRowBuilder();
        controlRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_pause:${guildId}`)
                .setLabel(isPaused ? 'Resume' : 'Pause')
                .setEmoji(isPaused ? '▶️' : '⏸️')
                .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`music_stop:${guildId}`)
                .setLabel('Stop')
                .setEmoji('⏹️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`music_skip:${guildId}`)
                .setLabel('Skip')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_loop:${guildId}`)
                .setLabel(loopInfo.text)
                .setEmoji(loopInfo.emoji)
                .setStyle(loopMode !== 'off' ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_shuffle:${guildId}`)
                .setLabel('Shuffle')
                .setEmoji('🔀')
                .setStyle(isShuffled ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
        rows.push(controlRow);

        // Row 2: Volume and queue controls
        const volumeRow = new ActionRowBuilder();
        volumeRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_voldown:${guildId}`)
                .setLabel('-10')
                .setEmoji('🔉')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_volup:${guildId}`)
                .setLabel('+10')
                .setEmoji('🔊')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_queue:${guildId}`)
                .setLabel('Queue')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`music_fav:${guildId}:${userId}`)
                .setLabel('Favorite')
                .setEmoji(musicCache.isFavorited(userId, trackUrl) ? '💖' : '🤍')
                .setStyle(musicCache.isFavorited(userId, trackUrl) ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
        rows.push(volumeRow);

        // Row 3: Extra features
        if (trackUrl) {
            const extraRow = new ActionRowBuilder();
            extraRow.addComponents(
                new ButtonBuilder()
                    .setLabel('Open Link')
                    .setStyle(ButtonStyle.Link)
                    .setURL(trackUrl)
                    .setEmoji('🔗'),
                new ButtonBuilder()
                    .setCustomId(`music_lyrics:${guildId}`)
                    .setLabel('Lyrics')
                    .setEmoji('📝')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_voteskip:${guildId}`)
                    .setLabel('Vote Skip')
                    .setEmoji('🗳️')
                    .setStyle(ButtonStyle.Secondary)
            );
            rows.push(extraRow);
        }

        return rows;
    }

    /**
     * Create queued track embed - Enhanced
     */
    createQueuedEmbed(track, position, requester) {
        const sourceInfo = this._getSourceInfo(track);
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.queued)
            .setAuthor({
                name: '📥 Added to Queue',
                iconURL: requester?.displayAvatarURL?.() || null
            })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(
                `${DECORATIONS.dotLine}\n\n` +
                `👤 **Artist:** ${track.author || 'Unknown Artist'}\n` +
                `⏱️ **Duration:** \`${fmtDur(track.lengthSeconds)}\`\n` +
                `📀 **Source:** ${sourceInfo.fallback} ${sourceInfo.name}\n\n` +
                `${DECORATIONS.dotLine}`
            )
            .addFields({
                name: '📍 Position in Queue',
                value: position === 0 ? '🎵 **Playing Next!**' : `\`#${position}\` in line`,
                inline: true
            });

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        if (requester) {
            embed.setFooter({
                text: `Requested by ${requester.displayName || requester.username}`,
                iconURL: requester.displayAvatarURL?.() || null
            });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Create priority queued embed - Enhanced
     */
    createPriorityQueuedEmbed(track, requester) {
        const sourceInfo = this._getSourceInfo(track);
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.success)
            .setAuthor({
                name: '⚡ Priority Added - Playing Next!',
                iconURL: requester?.displayAvatarURL?.() || null
            })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(
                `${DECORATIONS.dotLine}\n\n` +
                `👤 **Artist:** ${track.author || 'Unknown Artist'}\n` +
                `⏱️ **Duration:** \`${fmtDur(track.lengthSeconds)}\`\n` +
                `📀 **Source:** ${sourceInfo.fallback} ${sourceInfo.name}\n\n` +
                `✨ *This track was added to the front of the queue!*\n\n` +
                `${DECORATIONS.dotLine}`
            );

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        if (requester) {
            embed.setFooter({
                text: `Requested by ${requester.displayName || requester.username}`,
                iconURL: requester.displayAvatarURL?.() || null
            });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Create playlist queued embed - Enhanced
     */
    createPlaylistEmbed(playlistName, trackCount, requester, firstTrack) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.queued)
            .setAuthor({
                name: '📑 Playlist Added',
                iconURL: requester?.displayAvatarURL?.() || null
            })
            .setTitle(playlistName || 'Playlist')
            .setDescription(
                `${DECORATIONS.line}\n\n` +
                `📋 **Total Tracks:** \`${trackCount}\`\n` +
                `▶️ **First Track:** ${firstTrack?.title || 'Loading...'}\n\n` +
                `${DECORATIONS.line}`
            );

        if (firstTrack?.thumbnail) {
            embed.setThumbnail(firstTrack.thumbnail);
        }

        if (requester) {
            embed.setFooter({
                text: `Requested by ${requester.displayName || requester.username}`,
                iconURL: requester.displayAvatarURL?.() || null
            });
        }

        embed.setTimestamp();

        return embed;
    }

    /**
     * Create queue list embed - Enhanced
     */
    createQueueListEmbed(tracks, currentTrack, options = {}) {
        const { page = 1, perPage = 10, loopMode = 'off', isShuffled = false, volume = 100 } = options;
        
        const totalPages = Math.ceil(tracks.length / perPage) || 1;
        const start = (page - 1) * perPage;
        const pageItems = tracks.slice(start, start + perPage);
        const loopInfo = LOOP_DISPLAY[loopMode];

        const embed = new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: '📋 Music Queue' });

        // Current track section
        if (currentTrack) {
            embed.setTitle('🎵 Now Playing')
            embed.setDescription(
                `**[${currentTrack.title}](${currentTrack.url})**\n` +
                `👤 ${currentTrack.author || 'Unknown'} • ⏱️ ${fmtDur(currentTrack.lengthSeconds)}\n` +
                `${DECORATIONS.line}`
            );
            
            if (currentTrack.thumbnail) {
                embed.setThumbnail(currentTrack.thumbnail);
            }
        }

        // Queue items
        if (pageItems.length > 0) {
            const queueText = pageItems.map((track, i) => {
                const position = start + i + 1;
                const title = this._truncate(track.title, 40);
                const duration = fmtDur(track.lengthSeconds);
                return `\`${String(position).padStart(2, '0')}.\` [${title}](${track.url})\n　　 ⏱️ ${duration} • 👤 ${this._truncate(track.author || 'Unknown', 20)}`;
            }).join('\n\n');

            embed.addFields({ 
                name: `📑 Up Next (${tracks.length} track${tracks.length !== 1 ? 's' : ''})`, 
                value: queueText, 
                inline: false 
            });
        } else if (!currentTrack) {
            embed.setDescription('🔇 The queue is empty!\nUse `/music play` to add some tunes 🎵');
        }

        // Total duration
        const totalDuration = tracks.reduce((sum, t) => sum + (t.lengthSeconds || 0), 0);
        const currentDuration = currentTrack?.lengthSeconds || 0;
        
        // Status bar
        const statusLine = [
            `🔊 ${volume}%`,
            `${loopInfo.emoji} ${loopInfo.label}`,
            isShuffled ? '🔀 Shuffled' : null,
            `⏱️ ${fmtDur(totalDuration + currentDuration)}`
        ].filter(Boolean).join(' │ ');

        embed.setFooter({ 
            text: `Page ${page}/${totalPages} │ ${statusLine}`
        });

        return embed;
    }

    /**
     * Create queue pagination buttons - Enhanced
     */
    createQueuePaginationButtons(guildId, currentPage, totalPages) {
        const row = new ActionRowBuilder();
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_qpage:${guildId}:first`)
                .setLabel('First')
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`music_qpage:${guildId}:prev`)
                .setLabel('Prev')
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage <= 1),
            new ButtonBuilder()
                .setCustomId(`music_qpage:${guildId}:info`)
                .setLabel(`${currentPage} / ${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`music_qpage:${guildId}:next`)
                .setLabel('Next')
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages),
            new ButtonBuilder()
                .setCustomId(`music_qpage:${guildId}:last`)
                .setLabel('Last')
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= totalPages)
        );

        return row;
    }

    /**
     * Create skip vote embed - Enhanced
     */
    createSkipVoteEmbed(track, currentVotes, requiredVotes, timeRemaining) {
        const progress = this._createProgressBar(currentVotes, requiredVotes, 10);
        
        const embed = new EmbedBuilder()
            .setColor(COLORS.warning)
            .setAuthor({ name: '🗳️ Vote Skip Started' })
            .setTitle('Skip the current track?')
            .setDescription(
                `**Track:** ${track?.title || 'Unknown'}\n\n` +
                `${DECORATIONS.dotLine}\n\n` +
                `**Votes:** \`${currentVotes}\` / \`${requiredVotes}\`\n` +
                `${progress}\n\n` +
                `Click the button below to add your vote!`
            );

        if (track?.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        if (timeRemaining) {
            embed.setFooter({ text: `⏱️ Vote expires in ${Math.ceil(timeRemaining / 1000)} seconds` });
        }

        return embed;
    }

    /**
     * Create skip vote button - Enhanced
     */
    createSkipVoteButton(guildId, currentVotes, requiredVotes) {
        const row = new ActionRowBuilder();
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_voteskip_add:${guildId}`)
                .setLabel(`Vote to Skip (${currentVotes}/${requiredVotes})`)
                .setEmoji('🗳️')
                .setStyle(ButtonStyle.Primary)
        );

        return row;
    }

    /**
     * Create lyrics embed - NEW
     */
    createLyricsEmbed(track, lyrics) {
        // Truncate lyrics if too long
        const maxLength = 4000;
        let displayLyrics = lyrics;
        
        if (lyrics.length > maxLength) {
            displayLyrics = lyrics.substring(0, maxLength - 50) + '\n\n... *[Lyrics truncated]*';
        }

        const embed = new EmbedBuilder()
            .setColor(COLORS.lyrics)
            .setAuthor({ name: '📝 Lyrics' })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(displayLyrics);

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        embed.setFooter({ 
            text: `Artist: ${track.author || 'Unknown'} • Powered by lyrics.ovh`,
            iconURL: track.requestedBy?.displayAvatarURL?.() || null
        });

        return embed;
    }

    /**
     * Create info embed - Enhanced
     */
    createInfoEmbed(title, description, type = 'info') {
        const colors = {
            info: COLORS.info,
            success: COLORS.success,
            warning: COLORS.warning,
            error: COLORS.error
        };

        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        return new EmbedBuilder()
            .setColor(colors[type] || COLORS.info)
            .setTitle(`${icons[type] || ''} ${title}`)
            .setDescription(description)
            .setTimestamp();
    }

    /**
     * Create error embed - Enhanced
     */
    createErrorEmbed(message) {
        return new EmbedBuilder()
            .setColor(COLORS.error)
            .setTitle('❌ Error')
            .setDescription(`${message}\n\n*If this persists, try again later.*`)
            .setTimestamp();
    }

    /**
     * Create song finished embed
     */
    createSongFinishedEmbed(track) {
        return new EmbedBuilder()
            .setColor(COLORS.info)
            .setTitle('✅ Track Finished')
            .setDescription(`Finished: **${track?.title || 'Unknown'}**`)
            .setTimestamp();
    }

    /**
     * Create queue finished embed - Enhanced
     */
    createQueueFinishedEmbed() {
        return new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: '📋 Queue Complete' })
            .setTitle('🎵 All done!')
            .setDescription(
                `${DECORATIONS.line}\n\n` +
                `The queue is now empty.\n` +
                `Use \`/music play\` to add more songs!\n\n` +
                `${DECORATIONS.line}`
            )
            .setTimestamp();
    }

    /**
     * Create disconnected embed - Enhanced
     */
    createDisconnectedEmbed() {
        return new EmbedBuilder()
            .setColor(COLORS.warning)
            .setAuthor({ name: '👋 Disconnected' })
            .setTitle('Left the voice channel')
            .setDescription(
                `The bot has disconnected due to inactivity.\n\n` +
                `Use \`/music play\` to start playing again!`
            )
            .setTimestamp();
    }

    /**
     * Create favorites list embed - Enhanced
     */
    createFavoritesEmbed(favorites, userId, page = 1, perPage = 10) {
        const totalPages = Math.ceil(favorites.length / perPage) || 1;
        const start = (page - 1) * perPage;
        const pageItems = favorites.slice(start, start + perPage);

        const embed = new EmbedBuilder()
            .setColor(COLORS.favorites)
            .setAuthor({ name: '💖 Your Favorites' })
            .setTitle(`${favorites.length} saved song${favorites.length !== 1 ? 's' : ''}`);

        if (pageItems.length > 0) {
            const favText = pageItems.map((fav, i) => {
                const position = start + i + 1;
                const title = this._truncate(fav.title, 40);
                const duration = fmtDur(fav.duration);
                return `\`${String(position).padStart(2, '0')}.\` **[${title}](${fav.url})**\n　　 ⏱️ ${duration}`;
            }).join('\n\n');

            embed.setDescription(`${DECORATIONS.dotLine}\n\n${favText}\n\n${DECORATIONS.dotLine}`);
        } else {
            embed.setDescription(
                `${DECORATIONS.dotLine}\n\n` +
                `You haven't saved any favorites yet!\n\n` +
                `Use the 🤍 button while playing music to save songs.\n\n` +
                `${DECORATIONS.dotLine}`
            );
        }

        embed.setFooter({ 
            text: `Page ${page}/${totalPages} • Use /music favorites play <number> to play`
        });

        return embed;
    }

    /**
     * Create history embed - Enhanced
     */
    createHistoryEmbed(history, userId, page = 1, perPage = 10) {
        const totalPages = Math.ceil(history.length / perPage) || 1;
        const start = (page - 1) * perPage;
        const pageItems = history.slice(start, start + perPage);

        const embed = new EmbedBuilder()
            .setColor(COLORS.history)
            .setAuthor({ name: '📜 Listening History' })
            .setTitle(`${history.length} track${history.length !== 1 ? 's' : ''} played`);

        if (pageItems.length > 0) {
            const histText = pageItems.map((item, i) => {
                const position = start + i + 1;
                const title = this._truncate(item.title, 35);
                const timeAgo = this._timeAgo(item.playedAt);
                return `\`${String(position).padStart(2, '0')}.\` **[${title}](${item.url})**\n　　 🕐 ${timeAgo}`;
            }).join('\n\n');

            embed.setDescription(`${DECORATIONS.dotLine}\n\n${histText}\n\n${DECORATIONS.dotLine}`);
        } else {
            embed.setDescription(
                `${DECORATIONS.dotLine}\n\n` +
                `No listening history yet!\n\n` +
                `Start playing some music to build your history.\n\n` +
                `${DECORATIONS.dotLine}`
            );
        }

        embed.setFooter({ 
            text: `Page ${page}/${totalPages} • Use /music history play <number> to replay`
        });

        return embed;
    }

    /**
     * Create settings embed - Enhanced
     */
    createSettingsEmbed(userId) {
        const prefs = musicCache.getPreferences(userId);

        const embed = new EmbedBuilder()
            .setColor(COLORS.info)
            .setAuthor({ name: '⚙️ Music Settings' })
            .setTitle('Personal Preferences')
            .setDescription(
                `${DECORATIONS.line}\n\n` +
                `Customize your music experience below.\n` +
                `Changes apply to you only.\n\n` +
                `${DECORATIONS.line}`
            )
            .addFields(
                { 
                    name: '🔊 Default Volume', 
                    value: `\`${prefs.defaultVolume}%\``, 
                    inline: true 
                },
                { 
                    name: '⏱️ Max Track Duration', 
                    value: prefs.maxTrackDuration >= 99999 ? '`Unlimited`' : `\`${Math.floor(prefs.maxTrackDuration / 60)} min\``, 
                    inline: true 
                },
                { 
                    name: '📋 Max Queue Size', 
                    value: `\`${prefs.maxQueueSize} tracks\``, 
                    inline: true 
                },
                { 
                    name: '📢 Track Announcements', 
                    value: prefs.announceTrack ? '✅ Enabled' : '❌ Disabled', 
                    inline: true 
                },
                { 
                    name: '🗳️ Vote Skip Required', 
                    value: prefs.voteSkipEnabled ? '✅ Enabled' : '❌ Disabled', 
                    inline: true 
                },
                { 
                    name: '🖼️ Show Thumbnails', 
                    value: prefs.showThumbnails ? '✅ Enabled' : '❌ Disabled', 
                    inline: true 
                }
            )
            .setFooter({ text: 'Use the menus below to change settings' });

        return embed;
    }

    /**
     * Create settings select menus - Enhanced
     */
    createSettingsComponents(userId) {
        const prefs = musicCache.getPreferences(userId);
        const rows = [];

        // Volume select
        const volumeSelect = new StringSelectMenuBuilder()
            .setCustomId(`music_setting_volume:${userId}`)
            .setPlaceholder('🔊 Select Default Volume')
            .addOptions([
                { label: '🔈 25% - Quiet', value: '25', description: 'Low volume', default: prefs.defaultVolume === 25 },
                { label: '🔉 50% - Medium', value: '50', description: 'Medium volume', default: prefs.defaultVolume === 50 },
                { label: '🔉 75% - Moderate', value: '75', description: 'Moderate volume', default: prefs.defaultVolume === 75 },
                { label: '🔊 100% - Normal', value: '100', description: 'Default volume', default: prefs.defaultVolume === 100 },
                { label: '🔊 125% - Loud', value: '125', description: 'Above normal', default: prefs.defaultVolume === 125 },
                { label: '📢 150% - Very Loud', value: '150', description: 'High volume', default: prefs.defaultVolume === 150 }
            ]);
        rows.push(new ActionRowBuilder().addComponents(volumeSelect));

        // Max duration select
        const durationSelect = new StringSelectMenuBuilder()
            .setCustomId(`music_setting_duration:${userId}`)
            .setPlaceholder('⏱️ Max Track Duration')
            .addOptions([
                { label: '5 minutes', value: '300', emoji: '⏱️', description: 'Short tracks only', default: prefs.maxTrackDuration === 300 },
                { label: '10 minutes', value: '600', emoji: '⏱️', description: 'Standard limit', default: prefs.maxTrackDuration === 600 },
                { label: '15 minutes', value: '900', emoji: '⏱️', description: 'Extended tracks', default: prefs.maxTrackDuration === 900 },
                { label: '30 minutes', value: '1800', emoji: '⏱️', description: 'Long tracks', default: prefs.maxTrackDuration === 1800 },
                { label: '1 hour', value: '3600', emoji: '⏱️', description: 'Very long tracks', default: prefs.maxTrackDuration === 3600 },
                { label: '♾️ Unlimited', value: '99999', emoji: '♾️', description: 'No limit', default: prefs.maxTrackDuration >= 99999 }
            ]);
        rows.push(new ActionRowBuilder().addComponents(durationSelect));

        // Toggles with enhanced styling
        const toggleRow = new ActionRowBuilder();
        toggleRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_setting_announce:${userId}`)
                .setLabel(prefs.announceTrack ? 'Announce: ON' : 'Announce: OFF')
                .setEmoji('📢')
                .setStyle(prefs.announceTrack ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_setting_voteskip:${userId}`)
                .setLabel(prefs.voteSkipEnabled ? 'Vote Skip: ON' : 'Vote Skip: OFF')
                .setEmoji('🗳️')
                .setStyle(prefs.voteSkipEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`music_setting_thumbnails:${userId}`)
                .setLabel(prefs.showThumbnails ? 'Thumbnails: ON' : 'Thumbnails: OFF')
                .setEmoji('🖼️')
                .setStyle(prefs.showThumbnails ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
        rows.push(toggleRow);

        return rows;
    }

    /**
     * Create long video confirmation embed - Enhanced
     */
    createLongVideoConfirmEmbed(track, maxDuration) {
        const embed = new EmbedBuilder()
            .setColor(COLORS.warning)
            .setAuthor({ name: '⚠️ Long Track Warning' })
            .setTitle(track.title)
            .setURL(track.url)
            .setDescription(
                `${DECORATIONS.line}\n\n` +
                `This track is **${fmtDur(track.lengthSeconds)}** long!\n\n` +
                `Your current limit is set to **${fmtDur(maxDuration)}**.\n\n` +
                `Do you want to add it anyway?\n\n` +
                `${DECORATIONS.line}`
            );

        if (track.thumbnail) {
            embed.setThumbnail(track.thumbnail);
        }

        embed.setFooter({ text: 'This confirmation expires in 20 seconds' });

        return embed;
    }

    /**
     * Create confirmation buttons - Enhanced
     */
    createConfirmButtons(guildId, action) {
        const row = new ActionRowBuilder();
        
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`music_confirm:${guildId}:${action}:yes`)
                .setLabel('Yes, Add It')
                .setEmoji('✅')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`music_confirm:${guildId}:${action}:no`)
                .setLabel('Cancel')
                .setEmoji('❌')
                .setStyle(ButtonStyle.Danger)
        );

        return row;
    }

    /**
     * Disable all buttons in rows
     */
    disableButtons(rows) {
        return rows.map(row => {
            const newRow = ActionRowBuilder.from(row);
            newRow.components.forEach(component => {
                if (component.data.style !== ButtonStyle.Link) {
                    component.setDisabled(true);
                }
            });
            return newRow;
        });
    }

    // ========== HELPER METHODS ==========

    _truncate(str, length) {
        if (!str) return 'Unknown';
        return str.length > length ? str.substring(0, length - 3) + '...' : str;
    }

    _createProgressBar(current, max, length = 10) {
        const filled = Math.round((current / max) * length);
        const empty = length - filled;
        return '🟩'.repeat(filled) + '⬜'.repeat(empty) + ` ${Math.round((current / max) * 100)}%`;
    }

    _timeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return `${Math.floor(seconds / 604800)}w ago`;
    }
}

module.exports = new TrackHandler();
