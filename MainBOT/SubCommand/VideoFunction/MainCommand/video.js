const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const videoDownloadService = require('../Service/VideoDownloadService');
const platformDetector = require('../Utility/platformDetector');
const videoEmbedBuilder = require('../Utility/videoEmbedBuilder');
const progressAnimator = require('../Utility/progressAnimator');
const { validateUrl } = require('../Middleware/urlValidator');
const videoConfig = require('../Configuration/videoConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('video')
        .setDescription('Download videos from social media platforms')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Video URL (TikTok, Reddit, Twitter, Instagram, YouTube, etc.)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Delivery method')
                .addChoices(
                    { name: '📥 Auto (Download and upload)', value: 'auto' },
                    { name: '🔗 Direct Link (may expire quickly)', value: 'link' },
                    { name: '💾 Download File', value: 'download' }
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('quality')
                .setDescription('Video quality preference')
                .addChoices(
                    { name: '📺 SD (480p) - Faster, smaller', value: '480' },
                    { name: '🎥 HD (720p) - Balanced', value: '720' },
                    { name: '🎬 Full HD (1080p) - Best quality', value: '1080' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const url = interaction.options.getString('url');
        const method = interaction.options.getString('method') || 'auto';
        const quality = interaction.options.getString('quality') || videoConfig.COBALT_VIDEO_QUALITY;
        const platform = platformDetector.detect(url);

        // Validate URL
        if (!await validateUrl(interaction, url)) {
            return;
        }

        // Show initial loading embed
        const loadingEmbed = videoEmbedBuilder.buildLoadingEmbed(platform.name, platform.id, 'initializing');
        await interaction.editReply({ embeds: [loadingEmbed] });

        // Handle direct link method
        if (method === 'link') {
            await this.handleDirectLink(interaction, url, platform);
            return;
        }

        // Handle download methods (auto and download)
        await this.handleDownload(interaction, url, platform, quality);
    },

    /**
     * Handle direct link request
     */
    async handleDirectLink(interaction, url, platform) {
        try {
            const analyzeEmbed = videoEmbedBuilder.buildLoadingEmbed(platform.name, platform.id, 'analyzing');
            await interaction.editReply({ embeds: [analyzeEmbed] });

            const directInfo = await videoDownloadService.getDirectUrl(url);
            
            if (directInfo) {
                const embed = videoEmbedBuilder.buildDirectLinkEmbed(
                    directInfo.title,
                    directInfo.directUrl,
                    directInfo.size,
                    directInfo.thumbnail
                );

                await interaction.editReply({ 
                    content: `⚠️ **Direct links expire quickly!**\n${directInfo.directUrl}`,
                    embeds: [embed]
                });
                return;
            }

            const errorEmbed = videoEmbedBuilder.buildDirectLinkNotAvailableEmbed();
            await interaction.editReply({ embeds: [errorEmbed] });
        } catch (error) {
            console.error('❌ Direct link error:', error.message);
            const errorEmbed = videoEmbedBuilder.buildDownloadFailedEmbed(error.message);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    /**
     * Handle download with progress updates
     */
    async handleDownload(interaction, url, platform, quality) {
        console.log('📥 Downloading video...');
        
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 1500; // Update embed every 1.5 seconds to avoid rate limits
        let currentStage = 'initializing';
        let currentMethod = 'Auto';
        let lastProgress = { percent: 0 };

        // Progress update handler
        const updateProgress = async (stage, progressData = {}) => {
            const now = Date.now();
            if (now - lastUpdateTime < UPDATE_INTERVAL) return;
            lastUpdateTime = now;

            try {
                const embed = videoEmbedBuilder.buildProgressEmbed(
                    platform.name,
                    platform.id,
                    {
                        stage,
                        percent: progressData.percent || 0,
                        downloaded: progressData.downloaded || 0,
                        total: progressData.total || 0,
                        speed: progressData.speed || 0,
                        eta: progressData.eta || 0,
                        method: currentMethod,
                    }
                );
                await interaction.editReply({ embeds: [embed] });
            } catch (err) {
                // Ignore update errors (rate limits, etc.)
            }
        };

        // Setup event listeners
        const stageHandler = async (data) => {
            currentStage = data.stage;
            if (data.method) currentMethod = data.method;
            await updateProgress(data.stage, lastProgress);
        };

        const progressHandler = async (data) => {
            lastProgress = data;
            if (data.method) currentMethod = data.method;
            await updateProgress(currentStage, data);
        };

        const compressionHandler = async (data) => {
            currentStage = 'compressing';
            await updateProgress('compressing', { percent: data.percent || 0 });
        };

        // Subscribe to events
        videoDownloadService.on('stage', stageHandler);
        videoDownloadService.on('progress', progressHandler);
        videoDownloadService.on('compressionProgress', compressionHandler);

        try {
            // Show connecting stage
            await updateProgress('connecting');

            const result = await videoDownloadService.downloadVideo(url);

            // Check file size
            if (result.size > videoConfig.MAX_FILE_SIZE_MB) {
                if (fs.existsSync(result.path)) {
                    fs.unlinkSync(result.path);
                }

                const errorEmbed = videoEmbedBuilder.buildFileTooLargeEmbed(
                    result.size, 
                    videoConfig.MAX_FILE_SIZE_MB
                );
                await interaction.editReply({ embeds: [errorEmbed] });
                return;
            }

            // Prepare file info
            const fileName = `${platform.id}_video${path.extname(result.path)}`;

            // Show uploading stage
            try {
                const uploadEmbed = videoEmbedBuilder.buildLoadingEmbed(platform.name, platform.id, 'uploading');
                await interaction.editReply({ embeds: [uploadEmbed] });
            } catch (err) {}

            // Build simple success message (no embed to avoid chat flood)
            const successMessage = `✅ **${platform.name}** • ${result.size.toFixed(2)} MB • ${result.format}`;

            // Upload the video with simple message
            await interaction.editReply({ 
                content: successMessage,
                embeds: [],
                files: [{
                    attachment: result.path,
                    name: fileName
                }]
            });

            // Cleanup file after delay
            videoDownloadService.deleteFile(result.path);

        } catch (error) {
            console.error('❌ Download/Upload error:', error.message);
            const errorEmbed = videoEmbedBuilder.buildDownloadFailedEmbed(error.message);
            await interaction.editReply({ embeds: [errorEmbed] });
        } finally {
            // Cleanup event listeners
            videoDownloadService.off('stage', stageHandler);
            videoDownloadService.off('progress', progressHandler);
            videoDownloadService.off('compressionProgress', compressionHandler);
        }
    }
};