const path = require('path');
const fs = require('fs');
const ytDlpService = require('./YtdlpService');
const ffmpegService = require('./FFmpegService');
const videoConfig = require('../Configuration/videoConfig');

class VideoDownloadService {
    constructor() {
        this.tempDir = path.join(__dirname, '..', 'temp');
    }

    async initialize() {
        await ytDlpService.initialize();
        await ffmpegService.initialize();
        this.startCleanupInterval();
    }

    async downloadVideo(url) {
        const timestamp = Date.now();
        
        try {
            const videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
            
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
            const info = await ytDlpService.getVideoInfo(url);
            const formats = info.formats || [];
            
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
                    title: info.title,
                    thumbnail: info.thumbnail
                };
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