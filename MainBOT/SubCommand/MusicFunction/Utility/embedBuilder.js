const { EmbedBuilder } = require("discord.js");
const { fmtDur, formatViewCount } = require('./formatters');

class EmbedBuilderUtility {
    buildNowPlayingEmbed(track, volumePct, requester, player, isLooped, isShuffled) {
        const queueService = require('../Service/QueueService');
        const guildId = player.guildId;
        const queueList = queueService.getQueueList(guildId);
        const nextTrack = queueList.length > 0 ? queueList[0] : null;

        const fields = [
            { name: "📺 Channel", value: track?.author ?? "Unknown", inline: true },
            { name: "🌐 Source", value: track?.source ?? "YouTube", inline: true },
            { name: "⏱️ Duration", value: `\`${fmtDur(track?.lengthSeconds)}\``, inline: true },
            { name: "📜 Queue", value: `\`${queueList.length}\` in line`, inline: true },
            { name: "🔊 Volume", value: `\`${Math.round(volumePct)}%\``, inline: true },
            { name: "👁️ Views", value: track?.viewCount ? `\`${formatViewCount(track.viewCount)}\`` : "`N/A`", inline: true },
            { name: "🔁 Loop", value: isLooped ? "**Enabled**" : "Not Enabled", inline: true },
            { name: "🔀 Shuffle", value: isShuffled ? "**Enabled**" : "Not Enabled", inline: true },
            { name: "⏭️ Next Up", value: nextTrack ? `[${nextTrack.title}](${nextTrack.url})` : "No Next Up", inline: false }
        ];

        return new EmbedBuilder()
            .setColor(isLooped ? 0xF472B6 : (isShuffled ? 0x8B5CF6 : 0x00C2FF))
            .setAuthor({
                name: "🇳 🇴 🇼  🇵 🇱 🇦 🇾 🇮 🇳 🇬",
                iconURL: "https://cdn-icons-png.flaticon.com/512/727/727240.png"
            })
            .setTitle(track?.title ?? "Unknown Track")
            .setURL(track?.url ?? null)
            .setThumbnail(track?.thumbnail ?? null)
            .addFields(fields)
            .setFooter({
                text: `🎧 Requested by ${requester.tag}`,
                iconURL: requester.displayAvatarURL()
            })
            .setTimestamp();
    }

    buildPlaylistQueuedEmbed(playlistName, trackCount, requester, firstTrack) {
        const { EmbedBuilder } = require("discord.js");

        return new EmbedBuilder()
            .setColor(0x9333EA)
            .setTitle("📑 Playlist Added to Queue")
            .setDescription(`**${playlistName}**\n${trackCount} tracks have been added to the queue!`)
            .setThumbnail(firstTrack?.thumbnail || null)
            .addFields(
                { name: "📊 Total Tracks", value: `${trackCount}`, inline: true },
                { name: "🎵 First Track", value: firstTrack?.title || "Unknown", inline: true },
            )
            .setFooter({
                text: `Playlist queued by ${requester.tag}`,
                iconURL: requester.displayAvatarURL()
            })
            .setTimestamp();
    }

    buildQueuedEmbed(track, position, requester) {
        const fields = [
            { name: "Channel", value: track.author, inline: true },
            { name: "Duration", value: fmtDur(track.lengthSeconds), inline: true },
            { name: "Position", value: `#${position}`, inline: true }
        ];

        if (track.viewCount) {
            fields.push({ name: "Views", value: formatViewCount(track.viewCount), inline: true });
        }

        return new EmbedBuilder()
            .setColor(0x6EE7B7)
            .setTitle("✅ Added to queue")
            .setDescription(`[${track.title}](${track.url})`)
            .setThumbnail(track.thumbnail)
            .addFields(fields)
            .setFooter({ text: `Queued by ${requester.tag}`, iconURL: requester.displayAvatarURL() });
    }

    buildInfoEmbed(title, desc) {
        return new EmbedBuilder()
            .setColor(0xFBBF24)
            .setTitle(title)
            .setDescription(desc);
    }

    buildSongFinishedEmbed(track) {
        return this.buildInfoEmbed("✅ Song Finished", `**${track.title}** has finished playing.`);
    }

    buildDisconnectedEmbed() {
        return this.buildInfoEmbed(
            "🛑 Disconnected",
            "The bot has been disconnected and cleared all of the queues after 2 mins of inactivity, thank you for using it."
        );
    }

    buildNoUserVCEmbed() {
        return this.buildInfoEmbed(
            "🛑 Disconnected",
            "No users are currently in the voice channel. The bot has disconnected immediately."
        );
    }

    buildQueueFinishedEmbed() {
        return this.buildInfoEmbed("✅ Queue finished", "All songs have been played.");
    }

    buildErrorEmbed(message) {
        return this.buildInfoEmbed("❌ Error", message);
    }

    buildLongVideoConfirmEmbed(track) {
        return {
            title: "⚠️ Long Video Detected",
            description: `**${track.title}**\n⏱️ ${(track.lengthSeconds / 60).toFixed(1)} mins\n\nIs this the song you wanted?`,
            url: track.url,
            thumbnail: { url: track.thumbnail },
        };
    }
}

module.exports = new EmbedBuilderUtility();