const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { checkAccess, AccessType } = require('../../Middleware');
const path = require('path');
const fs = require('fs');

const videoDownloadService = require('../Service/VideoDownloadService');
const platformDetector = require('../Utility/platformDetector');
const videoEmbedBuilder = require('../Utility/videoEmbedBuilder');
const progressAnimator = require('../Utility/progressAnimator');
const { validateUrl } = require('../Middleware/urlValidator');
const videoConfig = require('../Configuration/videoConfig');

// Rate Limiting
const userCooldowns = new Map();
const activeDownloads = new Set();

function checkCooldown(userId) {
    const cooldown = userCooldowns.get(userId);
    if (cooldown && Date.now() < cooldown) {
        return Math.ceil((cooldown - Date.now()) / 1000);
    }
    return 0;
}

function setCooldown(userId) {
    userCooldowns.set(userId, Date.now() + (videoConfig.USER_COOLDOWN_SECONDS * 1000));
}

function checkConcurrentLimit() {
    return activeDownloads.size >= videoConfig.MAX_CONCURRENT_DOWNLOADS;
}

// Cleanup old cooldowns periodically
setInterval(() => {
    const now = Date.now();
    for (const [userId, expiry] of userCooldowns.entries()) {
        if (now > expiry) userCooldowns.delete(userId);
    }
}, 60000);

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
        // Access control check (before defer so we can use ephemeral)
        const access = await checkAccess(interaction, AccessType.SUB);
        if (access.blocked) {
            return interaction.reply({ embeds: [access.embed], ephemeral: true });
        }

        const userId = interaction.user.id;

        // Check user cooldown
        const remainingCooldown = checkCooldown(userId);
        if (remainingCooldown > 0) {
            const cooldownEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('⏳ Cooldown Active')
                .setDescription(`Please wait **${remainingCooldown} seconds** before downloading another video.`)
                .setFooter({ text: 'This helps prevent server overload' });
            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }

        // Check concurrent download limit
        if (checkConcurrentLimit()) {
            const busyEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🚦 Server Busy')
                .setDescription(`Too many downloads in progress. Please wait a moment and try again.\n\n*Max concurrent downloads: ${videoConfig.MAX_CONCURRENT_DOWNLOADS}*`)
                .setFooter({ text: 'This helps keep the bot responsive' });
            return interaction.reply({ embeds: [busyEmbed], ephemeral: true });
        }

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

        // Handle direct link method (no cooldown for links)
        if (method === 'link') {
            await this.handleDirectLink(interaction, url, platform);
            return;
        }

        // Set cooldown and track active download
        setCooldown(userId);
        activeDownloads.add(userId);

        try {
            // Handle download methods (auto and download)
            await this.handleDownload(interaction, url, platform, quality);
        } finally {
            // Always remove from active downloads
            activeDownloads.delete(userId);
        }
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

        // Subscribe to events
        videoDownloadService.on('stage', stageHandler);
        videoDownloadService.on('progress', progressHandler);

        try {
            // Show connecting stage
            await updateProgress('connecting');

            const result = await videoDownloadService.downloadVideo(url, { quality });

            // Prepare file info
            const fileName = `${platform.id}_video${path.extname(result.path)}`;

            // Show uploading stage
            try {
                const uploadEmbed = videoEmbedBuilder.buildLoadingEmbed(platform.name, platform.id, 'uploading');
                await interaction.editReply({ embeds: [uploadEmbed] });
            } catch (err) {}

            // Build simple success message with Original button
            const successMessage = `✅ **${platform.name}** • ${result.size.toFixed(2)} MB • ${result.format}`;
            
            const originalButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Original')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
                    .setEmoji('🔗')
            );

            // Upload the video with Original button
            try {
                await interaction.editReply({ 
                    content: successMessage,
                    embeds: [],
                    files: [{
                        attachment: result.path,
                        name: fileName
                    }],
                    components: [originalButton]
                });
            } catch (uploadError) {
                console.error('❌ Upload error:', uploadError.message);
                // Clean up file immediately on upload failure
                if (fs.existsSync(result.path)) {
                    try { fs.unlinkSync(result.path); } catch {}
                }
                
                // Check if it's a file size issue (Request entity too large)
                const isFileTooLarge = uploadError.message.toLowerCase().includes('too large') || 
                                       uploadError.message.toLowerCase().includes('entity') ||
                                       uploadError.code === 40005;
                
                let errorEmbed;
                if (isFileTooLarge) {
                    errorEmbed = new EmbedBuilder()
                        .setColor('#FF6B6B')
                        .setTitle('📦 File Too Large')
                        .setDescription(
                            `The video is **${result.size.toFixed(2)} MB** which exceeds your upload limit.\n\n` +
                            `⭐ **Discord Nitro** users can upload files up to **500 MB**!\n\n` +
                            `💡 **Tip:** Use \`/video method:link\` to get a direct download link instead!`
                        )
                        .setFooter({ text: 'Upload limits are based on your Nitro status' });
                } else {
                    errorEmbed = videoEmbedBuilder.buildDownloadFailedEmbed(
                        `Upload failed: ${uploadError.message}`
                    );
                }
                
                await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
                return;
            }

            // Cleanup file after delay (only if upload succeeded)
            if (result.path) {
                videoDownloadService.deleteFile(result.path);
            }

        } catch (error) {
            console.error('❌ Download/Upload error:', error.message);
            const errorEmbed = videoEmbedBuilder.buildDownloadFailedEmbed(error.message);
            await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
        } finally {
            // Cleanup event listeners
            videoDownloadService.off('stage', stageHandler);
            videoDownloadService.off('progress', progressHandler);
        }
    }
};