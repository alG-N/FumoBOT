const { EmbedBuilder } = require('discord.js');

class VideoEmbedBuilder {
    buildLoadingEmbed(platform) {
        return new EmbedBuilder()
            .setTitle('🎬 Downloading Video...')
            .setDescription(`**Platform:** ${platform}\n\n⏳ Please wait, this may take a moment...`)
            .setColor('#3498DB')
            .setTimestamp();
    }

    buildErrorEmbed(title, description, footer = null) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor('#FF0000')
            .setTimestamp();

        if (footer) {
            embed.setFooter({ text: footer });
        }

        return embed;
    }

    buildInvalidUrlEmbed() {
        return this.buildErrorEmbed(
            '❌ Invalid URL',
            'Please provide a valid URL starting with `http://` or `https://`'
        );
    }

    buildDownloadFailedEmbed(error) {
        return this.buildErrorEmbed(
            '❌ Download Failed',
            error,
            'Make sure the video is public and available'
        );
    }

    buildUploadFailedEmbed() {
        return this.buildErrorEmbed(
            '❌ Upload Failed',
            'Failed to upload to Discord. The file might be corrupted or Discord is having issues.'
        );
    }

    buildFileTooLargeEmbed(sizeMB, maxMB = 25) {
        return this.buildErrorEmbed(
            '❌ File Too Large',
            `Video is ${sizeMB.toFixed(2)}MB (Discord limit: ${maxMB}MB)\n\n**Suggestions:**\n• Try a shorter clip\n• Use a boosted server (50-100 MB limit)\n• Upload to a file host and share the link`
        );
    }

    buildDirectLinkEmbed(title, url, size, thumbnail) {
        return new EmbedBuilder()
            .setTitle('✅ Video Ready!')
            .setDescription(`**${title}**\n\n[Click here to watch](${url})\n\n*Size: ${size} MB*`)
            .setColor('#00FF00')
            .setThumbnail(thumbnail)
            .setTimestamp();
    }

    buildDirectLinkNotAvailableEmbed() {
        return this.buildErrorEmbed(
            '❌ Direct Link Not Available',
            'Could not get a direct link. Try using **Download File** method instead.'
        );
    }
}

module.exports = new VideoEmbedBuilder();