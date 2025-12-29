const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const progressAnimator = require('./progressAnimator');

/**
 * Enhanced VideoEmbedBuilder with animated progress and modern UI
 */
class VideoEmbedBuilder {
    constructor() {
        // Color palette
        this.colors = {
            primary: '#5865F2',      // Discord Blurple
            success: '#57F287',      // Green
            warning: '#FEE75C',      // Yellow
            error: '#ED4245',        // Red
            info: '#5865F2',         // Blue
            loading: '#3498DB',      // Light blue
            tiktok: '#000000',
            twitter: '#1DA1F2',
            instagram: '#E4405F',
            youtube: '#FF0000',
            reddit: '#FF4500',
            facebook: '#1877F2',
            twitch: '#9146FF',
            vimeo: '#1AB7EA',
            web: '#7289DA',
        };

        // Animated frames for loading states
        this.loadingFrames = [
            '🎬 Initializing download...',
            '📡 Connecting to server...',
            '🔍 Analyzing video...',
            '📥 Fetching content...',
        ];
    }

    /**
     * Get platform-specific color
     */
    getPlatformColor(platformId) {
        return this.colors[platformId] || this.colors.primary;
    }

    /**
     * Build an enhanced loading embed with animated progress
     */
    buildLoadingEmbed(platformName, platformId = 'web', stage = 'initializing') {
        const platformStyle = progressAnimator.getPlatformStyle(platformId);
        const color = this.getPlatformColor(platformId);
        
        const stages = {
            initializing: { icon: '🎬', text: 'Initializing download...', progress: 0 },
            connecting: { icon: '📡', text: 'Connecting to server...', progress: 15 },
            analyzing: { icon: '🔍', text: 'Analyzing video...', progress: 30 },
            downloading: { icon: '📥', text: 'Downloading video...', progress: 50 },
            processing: { icon: '⚙️', text: 'Processing video...', progress: 75 },
            compressing: { icon: '📦', text: 'Compressing video...', progress: 85 },
            uploading: { icon: '☁️', text: 'Uploading to Discord...', progress: 95 },
        };

        const currentStage = stages[stage] || stages.initializing;
        const progressBar = progressAnimator.createProgressBar(currentStage.progress, 'default');

        return new EmbedBuilder()
            .setTitle(`${currentStage.icon} Processing Video`)
            .setDescription([
                `**Platform:** ${platformName}`,
                '',
                `\`${progressBar}\``,
                '',
                `${currentStage.text}`,
                '',
                '> 💡 *Tip: Use `/video method:link` for direct links (faster but may expire)*'
            ].join('\n'))
            .setColor(color)
            .setFooter({ text: '🎬 Video Downloader • Processing your request' })
            .setTimestamp();
    }

    /**
     * Build progress update embed with detailed information
     */
    buildProgressEmbed(platformName, platformId, options = {}) {
        const {
            stage = 'downloading',
            percent = 0,
            downloaded = 0,
            total = 0,
            speed = 0,
            eta = 0,
            method = 'Cobalt',
        } = options;

        const color = this.getPlatformColor(platformId);
        const progressBar = progressAnimator.createProgressBar(percent, 'default');

        const stageEmojis = {
            connecting: '📡',
            downloading: '📥',
            processing: '⚙️',
            compressing: '📦',
            uploading: '☁️',
        };

        const stageTexts = {
            connecting: 'Connecting...',
            downloading: 'Downloading...',
            processing: 'Processing...',
            compressing: 'Compressing...',
            uploading: 'Uploading...',
        };

        const description = [
            `**Platform:** ${platformName}`,
            `**Method:** ${method}`,
            '',
            `\`${progressBar}\``,
            '',
            `${stageEmojis[stage] || '📥'} **${stageTexts[stage] || 'Processing...'}**`,
        ];

        // Add stats if available
        const stats = [];
        if (total > 0) {
            stats.push(`📊 ${progressAnimator.formatBytes(downloaded)} / ${progressAnimator.formatBytes(total)}`);
        } else if (downloaded > 0) {
            stats.push(`📊 ${progressAnimator.formatBytes(downloaded)}`);
        }
        if (speed > 0) {
            stats.push(`⚡ ${progressAnimator.formatBytes(speed)}/s`);
        }
        if (eta > 0) {
            stats.push(`⏱️ ~${progressAnimator.formatTime(eta)}`);
        }

        if (stats.length > 0) {
            description.push('', stats.join(' • '));
        }

        return new EmbedBuilder()
            .setTitle('📥 Downloading Video')
            .setDescription(description.join('\n'))
            .setColor(color)
            .setFooter({ text: '🎬 Video Downloader' })
            .setTimestamp();
    }

    /**
     * Build enhanced error embed with helpful suggestions
     */
    buildErrorEmbed(title, description, footer = null, suggestions = []) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(this.colors.error)
            .setTimestamp();

        let fullDescription = description;

        if (suggestions.length > 0) {
            fullDescription += '\n\n**💡 Suggestions:**\n' + suggestions.map(s => `• ${s}`).join('\n');
        }

        embed.setDescription(fullDescription);

        if (footer) {
            embed.setFooter({ text: footer });
        }

        return embed;
    }

    /**
     * Build invalid URL embed
     */
    buildInvalidUrlEmbed() {
        return this.buildErrorEmbed(
            '❌ Invalid URL',
            'Please provide a valid URL starting with `http://` or `https://`',
            null,
            [
                'Make sure to copy the full URL',
                'The URL should start with http:// or https://',
                'Check for any extra spaces or characters'
            ]
        );
    }

    /**
     * Build download failed embed with detailed error info
     */
    buildDownloadFailedEmbed(error) {
        const errorMessages = {
            'private': 'The video appears to be private or restricted',
            'unavailable': 'The video is no longer available',
            'geo': 'This video may be geo-restricted',
            'age': 'This video requires age verification',
            'timeout': 'The download timed out - server may be slow',
            'format': 'No compatible video format found',
        };

        let friendlyError = error;
        let suggestions = [
            'Make sure the video is public',
            'Try a different video URL',
            'Use `/video method:link` for direct link'
        ];

        // Check for common error patterns
        for (const [key, message] of Object.entries(errorMessages)) {
            if (error.toLowerCase().includes(key)) {
                friendlyError = message;
                break;
            }
        }

        return this.buildErrorEmbed(
            '❌ Download Failed',
            friendlyError,
            'Check that the video is public and accessible',
            suggestions
        );
    }

    /**
     * Build upload failed embed
     */
    buildUploadFailedEmbed() {
        return this.buildErrorEmbed(
            '❌ Upload Failed',
            'Failed to upload the video to Discord.',
            null,
            [
                'The file might be corrupted',
                'Discord may be experiencing issues',
                'Try again in a moment'
            ]
        );
    }

    /**
     * Build file too large embed with size information
     */
    buildFileTooLargeEmbed(sizeMB, maxMB = 25) {
        const overBy = (sizeMB - maxMB).toFixed(2);
        
        return new EmbedBuilder()
            .setTitle('📦 File Too Large')
            .setDescription([
                `The video is **${sizeMB.toFixed(2)} MB** which exceeds the limit.`,
                '',
                '```',
                `📊 Video Size:  ${sizeMB.toFixed(2)} MB`,
                `📏 Max Limit:   ${maxMB} MB`,
                `📈 Over by:     ${overBy} MB`,
                '```',
                '',
                '**💡 Suggestions:**',
                '• Try downloading a shorter clip',
                '• Use `/video method:link` for direct link',
                '• Use a server with Nitro boost (50-100 MB limit)',
            ].join('\n'))
            .setColor(this.colors.warning)
            .setFooter({ text: '🎬 Video Downloader • File size limit exceeded' })
            .setTimestamp();
    }

    /**
     * Build success embed with video information
     */
    buildSuccessEmbed(options = {}) {
        const {
            platformName = 'Unknown',
            platformId = 'web',
            sizeMB = 0,
            format = 'MP4',
            duration = null,
            quality = null,
            method = 'Auto',
        } = options;

        const color = this.getPlatformColor(platformId);
        
        const stats = [
            `📦 **Size:** ${sizeMB.toFixed(2)} MB`,
            `🎬 **Format:** ${format}`,
        ];

        if (quality) {
            stats.push(`📺 **Quality:** ${progressAnimator.createQualityBadge(quality)}`);
        }
        if (duration) {
            stats.push(`⏱️ **Duration:** ${duration}`);
        }
        stats.push(`🔧 **Method:** ${method}`);

        return new EmbedBuilder()
            .setTitle('✅ Video Ready!')
            .setDescription([
                `**Platform:** ${platformName}`,
                '',
                stats.join('\n'),
                '',
                '> *Video will be attached below* ⬇️'
            ].join('\n'))
            .setColor(color)
            .setFooter({ text: '🎬 Video Downloader • Download complete!' })
            .setTimestamp();
    }

    /**
     * Build direct link embed
     */
    buildDirectLinkEmbed(title, url, size, thumbnail) {
        const embed = new EmbedBuilder()
            .setTitle('🔗 Direct Link Ready!')
            .setDescription([
                `**${title || 'Video'}**`,
                '',
                `📦 **Size:** ${size || 'Unknown'} MB`,
                '',
                `[📥 Click here to download](${url})`,
                '',
                '> ⚠️ *Direct links may expire quickly. Download soon!*'
            ].join('\n'))
            .setColor(this.colors.success)
            .setFooter({ text: '🎬 Video Downloader • Link generated' })
            .setTimestamp();

        if (thumbnail) {
            embed.setThumbnail(thumbnail);
        }

        return embed;
    }

    /**
     * Build direct link not available embed
     */
    buildDirectLinkNotAvailableEmbed() {
        return this.buildErrorEmbed(
            '❌ Direct Link Not Available',
            'Could not generate a direct link for this video.',
            null,
            [
                'Try using the **Download File** method instead',
                'Some platforms don\'t support direct links',
                'The video might be protected or private'
            ]
        );
    }

    /**
     * Build compression progress embed
     */
    buildCompressionEmbed(originalSize, targetSize, progress = 0) {
        const progressBar = progressAnimator.createProgressBar(progress, 'default');
        
        return new EmbedBuilder()
            .setTitle('📦 Compressing Video')
            .setDescription([
                `\`${progressBar}\``,
                '',
                '```',
                `📊 Original: ${originalSize.toFixed(2)} MB`,
                `🎯 Target:   ${targetSize.toFixed(2)} MB`,
                '```',
                '',
                '> *Compressing to fit Discord\'s file limit...*'
            ].join('\n'))
            .setColor(this.colors.warning)
            .setFooter({ text: '🎬 Video Downloader • Compression in progress' })
            .setTimestamp();
    }

    /**
     * Build method selection buttons
     */
    buildMethodButtons(disabled = false) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('video_auto')
                    .setLabel('Auto Download')
                    .setEmoji('📥')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('video_link')
                    .setLabel('Direct Link')
                    .setEmoji('🔗')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
            );
    }

    /**
     * Build help/info embed for the video command
     */
    buildHelpEmbed() {
        return new EmbedBuilder()
            .setTitle('🎬 Video Downloader Help')
            .setDescription([
                '**Supported Platforms:**',
                '```',
                '🎵 TikTok      📷 Instagram',
                '𝕏  Twitter/X   ▶️ YouTube',
                '🤖 Reddit      📘 Facebook',
                '🎮 Twitch      🎬 Vimeo',
                '🌐 Other sites (via yt-dlp)',
                '```',
                '',
                '**Download Methods:**',
                '• **Auto** - Downloads and uploads to Discord',
                '• **Direct Link** - Gets a direct URL (may expire)',
                '• **Download File** - Forces file download',
                '',
                '**Usage:**',
                '`/video url:<video_url> [method:auto|link|download]`',
            ].join('\n'))
            .setColor(this.colors.info)
            .setFooter({ text: '🎬 Video Downloader • Help' })
            .setTimestamp();
    }
}

module.exports = new VideoEmbedBuilder();