/**
 * Embed Utility
 * Creates consistent embeds for the music bot
 */

const { EmbedBuilder } = require('discord.js');
const config = require('../config/music.config');
const { formatDuration } = require('./format.util');

class EmbedUtil {
    /**
     * Create now playing embed
     */
    static createNowPlaying(track, player, requester) {
        const queue = player.queue;
        const nextTrack = queue.size > 0 ? queue[0] : null;

        const fields = [
            { 
                name: '📺 Channel', 
                value: track.author || 'Unknown', 
                inline: true 
            },
            { 
                name: '⏱️ Duration', 
                value: formatDuration(track.duration), 
                inline: true 
            },
            { 
                name: '📜 Queue', 
                value: `${queue.size} track(s)`, 
                inline: true 
            },
            { 
                name: '🔊 Volume', 
                value: `${player.volume}%`, 
                inline: true 
            },
            { 
                name: '🔁 Loop', 
                value: player.trackRepeat ? '**Track**' : player.queueRepeat ? '**Queue**' : 'Off', 
                inline: true 
            },
            { 
                name: '⏭️ Next Up', 
                value: nextTrack ? `[${nextTrack.title}](${nextTrack.uri})` : 'Nothing', 
                inline: true 
            },
        ];

        return new EmbedBuilder()
            .setColor(player.trackRepeat || player.queueRepeat ? config.colors.loop : config.colors.primary)
            .setAuthor({
                name: '🇳 🇴 🇼  🇵 🇱 🇦 🇾 🇮 🇳 🇬',
                iconURL: 'https://cdn-icons-png.flaticon.com/512/727/727240.png'
            })
            .setTitle(track.title)
            .setURL(track.uri)
            .setThumbnail(track.thumbnail)
            .addFields(fields)
            .setFooter({
                text: `🎧 Requested by ${requester.tag}`,
                iconURL: requester.displayAvatarURL()
            })
            .setTimestamp();
    }

    /**
     * Create track added to queue embed
     */
    static createTrackQueued(track, position, requester) {
        return new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Added to queue')
            .setDescription(`[${track.title}](${track.uri})`)
            .setThumbnail(track.thumbnail)
            .addFields(
                { name: 'Channel', value: track.author || 'Unknown', inline: true },
                { name: 'Duration', value: formatDuration(track.duration), inline: true },
                { name: 'Position', value: `#${position}`, inline: true },
            )
            .setFooter({ 
                text: `Queued by ${requester.tag}`, 
                iconURL: requester.displayAvatarURL() 
            });
    }

    /**
     * Create playlist added embed
     */
    static createPlaylistQueued(playlist, tracksAdded, requester) {
        return new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Playlist added to queue')
            .setDescription(`**${playlist.name}**`)
            .addFields(
                { name: 'Tracks', value: `${tracksAdded} added`, inline: true },
                { name: 'Duration', value: formatDuration(playlist.duration), inline: true },
            )
            .setFooter({ 
                text: `Queued by ${requester.tag}`, 
                iconURL: requester.displayAvatarURL() 
            });
    }

    /**
     * Create queue list embed
     */
    static createQueueList(current, queue, page = 1, perPage = 10) {
        const start = (page - 1) * perPage;
        const end = start + perPage;
        const tracks = queue.slice(start, end);

        const lines = [];
        
        if (current) {
            lines.push(`**Now Playing:**`);
            lines.push(`[${current.title}](${current.uri}) \`${formatDuration(current.duration)}\`\n`);
        }

        if (tracks.length > 0) {
            lines.push(`**Up Next:**`);
            tracks.forEach((track, idx) => {
                const position = start + idx + 1;
                lines.push(`**${position}.** [${track.title}](${track.uri}) \`${formatDuration(track.duration)}\``);
            });
        } else if (!current) {
            lines.push('_Queue is empty_');
        }

        const totalPages = Math.ceil(queue.length / perPage) || 1;

        return new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle('🧾 Queue')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page}/${totalPages} • ${queue.length} track(s) in queue` });
    }

    /**
     * Create info embed
     */
    static createInfo(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle(title)
            .setDescription(description);
    }

    /**
     * Create success embed
     */
    static createSuccess(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle(title)
            .setDescription(description);
    }

    /**
     * Create error embed
     */
    static createError(title, description) {
        return new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle(title)
            .setDescription(description);
    }

    /**
     * Create track finished embed
     */
    static createTrackFinished(track) {
        return new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('✅ Song Finished')
            .setDescription(`**${track.title}** has finished playing.`);
    }

    /**
     * Create skip vote embed
     */
    static createSkipVote(votesNeeded, currentVotes) {
        return new EmbedBuilder()
            .setColor(config.colors.warning)
            .setTitle('⏭️ Skip Vote Started')
            .setDescription(`Vote to skip the current track!\nVotes: ${currentVotes}/${votesNeeded}`);
    }
}

module.exports = EmbedUtil;