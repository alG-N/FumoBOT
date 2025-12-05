const { SlashCommandBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const videoDownloadService = require('../Service/VideoDownloadService');
const platformDetector = require('../Utility/platformDetector');
const videoEmbedBuilder = require('../Utility/videoEmbedBuilder');
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
                    { name: 'Auto (Download and upload)', value: 'auto' },
                    { name: 'Direct Link (may expire quickly)', value: 'link' },
                    { name: 'Download File', value: 'download' }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const url = interaction.options.getString('url');
        const method = interaction.options.getString('method') || 'auto';
        const platform = platformDetector.detect(url);

        if (!await validateUrl(interaction, url)) {
            return;
        }

        const loadingEmbed = videoEmbedBuilder.buildLoadingEmbed(platform.name);
        await interaction.editReply({ embeds: [loadingEmbed] });

        if (method === 'link') {
            const directInfo = await videoDownloadService.getDirectUrl(url);
            
            if (directInfo) {
                const embed = videoEmbedBuilder.buildDirectLinkEmbed(
                    directInfo.title,
                    directInfo.directUrl,
                    directInfo.size,
                    directInfo.thumbnail
                );

                await interaction.editReply({ 
                    content: `⚠️ Direct links expire quickly!\n${directInfo.directUrl}`,
                    embeds: [embed]
                });
                return;
            }

            const errorEmbed = videoEmbedBuilder.buildDirectLinkNotAvailableEmbed();
            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        console.log('📥 Downloading video...');
        
        try {
            const result = await videoDownloadService.downloadVideo(url);

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

            await interaction.editReply({ 
                content: `✅ Your video is ready! **(${result.size.toFixed(2)} MB)**`,
                embeds: [],
                files: [{
                    attachment: result.path,
                    name: `video${path.extname(result.path)}`
                }]
            });

            videoDownloadService.deleteFile(result.path);

        } catch (error) {
            console.error('❌ Download/Upload error:', error.message);

            const errorEmbed = videoEmbedBuilder.buildDownloadFailedEmbed(error.message);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};