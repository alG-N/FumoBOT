const path = require('path');
const fs = require('fs');
const cobaltService = require('./CobaltService');
const ytDlpService = require('./YtdlpService');
const ffmpegService = require('./FFmpegService');
const videoConfig = require('../Configuration/videoConfig');

class VideoDownloadService {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp');
    }

    async initialize() {
        // FFmpeg is still needed for compression
        await ffmpegService.initialize();
        
        // Initialize yt-dlp (fallback method)
        await ytDlpService.initialize();
        
        this.startCleanupInterval();
        
        if (videoConfig.USE_COBALT) {
            console.log(`✅ Video download service initialized (Cobalt: ${videoConfig.COBALT_INSTANCES[0]})`);
        } else {
            console.log('✅ Video download service initialized (using yt-dlp)');
        }
    }

    async downloadVideo(url) {
        const timestamp = Date.now();
        
        try {
            let videoPath;

            // Try Cobalt first if enabled
            if (videoConfig.USE_COBALT) {
                try {
                    console.log(`📥 Downloading via Cobalt (${videoConfig.COBALT_INSTANCES[0]})...`);
                    videoPath = await cobaltService.downloadVideo(url, this.tempDir);
                    console.log('✅ Cobalt download successful');
                } catch (cobaltError) {
                    console.error('⚠️ Cobalt failed:', cobaltError.message);
                    
                    if (videoConfig.USE_YTDLP_FALLBACK) {
                        console.log('📥 Falling back to yt-dlp...');
                        videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
                    } else {
                        throw cobaltError;
                    }
                }
            } else {
                // Use yt-dlp directly
                console.log('📥 Downloading via yt-dlp...');
                videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
            }
            
            // Compress if needed
            const finalPath = await ffmpegService.compressVideo(videoPath, videoConfig.TARGET_COMPRESSION_MB);
            const finalStats = fs.statSync(finalPath);
            const finalSizeMB = finalStats.size / (1024 * 1024);

            const extension = path.extname(finalPath).toLowerCase();
            const format = extension === '.webm' ? 'WebM' : extension === '.mp4' ? 'MP4' : extension.toUpperCase();

            return { 
                path: finalPath, 
                size: finalSizeMB, 
                format 
            };
        } catch (error) {
            console.error('❌ Download error:', error.message);
            
            // Cleanup any partial files
            if (fs.existsSync(this.tempDir)) {
                const files = fs.readdirSync(this.tempDir).filter(f => f.startsWith(`video_${timestamp}`));
                files.forEach(file => {
                    try {
                        fs.unlinkSync(path.join(this.tempDir, file));
                    } catch (e) {}
                });
            }
            
            throw new Error('Failed to download video. The link might be invalid, private, or the video source is not supported.');
        }
    }

    async getDirectUrl(url) {
        try {
            // Try Cobalt first for direct URL
            const info = await cobaltService.getVideoInfo(url);
            
            if (info.url) {
                return {
                    directUrl: info.url,
                    size: 'Unknown',
                    title: 'Video',
                    thumbnail: null
                };
            }

            // Fallback to yt-dlp if available
            if (videoConfig.USE_YTDLP_FALLBACK) {
                const ytInfo = await ytDlpService.getVideoInfo(url);
                const formats = ytInfo.formats || [];
                
                const suitableFormat = formats.find(f => 
                    f.ext === 'mp4' && 
                    f.filesize && 
                    f.filesize < videoConfig.MAX_FILE_SIZE_MB * 1024 * 1024 &&
                    f.url
                );

                if (suitableFormat) {
                    return {
                        directUrl: suitableFormat.url,
                        size: (suitableFormat.filesize / (1024 * 1024)).toFixed(2),
                        title: ytInfo.title,
                        thumbnail: ytInfo.thumbnail
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('❌ URL extraction error:', error.message);
            return null;
        }
    }

    cleanupTempFiles() {
        if (!fs.existsSync(this.tempDir)) return;

        try {
            const files = fs.readdirSync(this.tempDir);
            const now = Date.now();

            files.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtimeMs > videoConfig.TEMP_FILE_MAX_AGE) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    startCleanupInterval() {
        setInterval(() => {
            this.cleanupTempFiles();
        }, videoConfig.TEMP_FILE_CLEANUP_INTERVAL);
    }

    deleteFile(filePath, delay = 5000) {
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }, delay);
    }
}

module.exports = new VideoDownloadService();