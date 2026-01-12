const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const cobaltService = require('./CobaltService');
const ytDlpService = require('./YtDlpService');
const ffmpegService = require('./FFmpegService');
const videoConfig = require('../Configuration/videoConfig');

/**
 * VideoDownloadService - Cobalt-only implementation
 * Uses self-hosted Cobalt API for video downloads
 */
class VideoDownloadService extends EventEmitter {
    constructor() {
        super();
        this.tempDir = path.join(__dirname, '..', 'temp');
        this.currentDownload = null;
        this._setupEventForwarding();
    }

    /**
     * Setup event forwarding from child services
     */
    _setupEventForwarding() {
        // Forward Cobalt events
        cobaltService.on('stage', (data) => this.emit('stage', { ...data, method: 'Cobalt' }));
        cobaltService.on('progress', (data) => this.emit('progress', { ...data, method: 'Cobalt' }));
        cobaltService.on('complete', (data) => this.emit('downloadComplete', { ...data, method: 'Cobalt' }));
        cobaltService.on('error', (data) => this.emit('downloadError', { ...data, method: 'Cobalt' }));

        // Forward yt-dlp events
        ytDlpService.on('stage', (data) => this.emit('stage', { ...data, method: 'yt-dlp' }));
        ytDlpService.on('progress', (data) => this.emit('progress', { ...data, method: 'yt-dlp' }));
        ytDlpService.on('complete', (data) => this.emit('downloadComplete', { ...data, method: 'yt-dlp' }));
        ytDlpService.on('error', (data) => this.emit('downloadError', { ...data, method: 'yt-dlp' }));

        // Forward FFmpeg events
        ffmpegService.on('stage', (data) => this.emit('stage', { ...data, method: 'FFmpeg' }));
        ffmpegService.on('progress', (data) => this.emit('compressionProgress', data));
        ffmpegService.on('compressionStart', (data) => this.emit('compressionStart', data));
        ffmpegService.on('compressionComplete', (data) => this.emit('compressionComplete', data));
    }

    async initialize() {
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Initialize yt-dlp as fallback
        await ytDlpService.initialize();

        // FFmpeg is needed for compression
        await ffmpegService.initialize();
        
        this.startCleanupInterval();
    }

    /**
     * Download video with progress tracking
     * @param {string} url - Video URL
     * @param {Object} options - Download options
     * @returns {Promise<Object>} Download result
     */
    async downloadVideo(url, options = {}) {
        const timestamp = Date.now();
        const { onProgress, onStage } = options;
        
        // Setup temporary event listeners if callbacks provided
        const progressHandler = onProgress ? (data) => onProgress(data) : null;
        const stageHandler = onStage ? (data) => onStage(data) : null;

        if (progressHandler) this.on('progress', progressHandler);
        if (stageHandler) this.on('stage', stageHandler);

        try {
            this.emit('stage', { stage: 'initializing', message: 'Initializing download...' });
            
            let videoPath;
            let downloadMethod = 'Cobalt';

            // Try Cobalt first
            this.emit('stage', { stage: 'connecting', message: 'Connecting to Cobalt...', method: 'Cobalt' });
            try {
                videoPath = await cobaltService.downloadVideo(url, this.tempDir);
            } catch (cobaltError) {
                console.log(`⚠️ Cobalt failed: ${cobaltError.message}, trying yt-dlp fallback...`);
                this.emit('stage', { stage: 'fallback', message: 'Cobalt failed, trying yt-dlp...', method: 'yt-dlp' });
                
                // Fallback to yt-dlp
                try {
                    videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
                    downloadMethod = 'yt-dlp';
                } catch (ytdlpError) {
                    // Both failed, throw combined error
                    throw new Error(`Cobalt: ${cobaltError.message} | yt-dlp: ${ytdlpError.message}`);
                }
            }
            
            // Check video duration (5 minute limit for short videos only)
            const maxDurationSeconds = videoConfig.MAX_VIDEO_DURATION_SECONDS || 300;
            const duration = await ffmpegService._getVideoDuration(videoPath);
            
            if (duration > maxDurationSeconds) {
                // Delete the downloaded file
                if (fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
                const maxMinutes = Math.floor(maxDurationSeconds / 60);
                throw new Error(`Video too long! Max duration is ${maxMinutes} minutes. This video is ${Math.floor(duration / 60)} minutes.`);
            }
            
            // Get initial file size
            const initialStats = fs.statSync(videoPath);
            const initialSizeMB = initialStats.size / (1024 * 1024);

            // Try to compress if needed (will skip if FFmpeg unavailable)
            let finalPath = videoPath;
            let wasCompressed = false;
            
            if (initialSizeMB > videoConfig.TARGET_COMPRESSION_MB) {
                try {
                    this.emit('stage', { stage: 'compressing', message: 'Compressing video...', method: 'FFmpeg' });
                    finalPath = await ffmpegService.compressVideo(videoPath, videoConfig.TARGET_COMPRESSION_MB);
                    wasCompressed = finalPath !== videoPath;
                } catch (compressError) {
                    console.log('⚠️ Compression skipped:', compressError.message);
                    finalPath = videoPath;
                }
            }
            
            const finalStats = fs.statSync(finalPath);
            const finalSizeMB = finalStats.size / (1024 * 1024);

            const extension = path.extname(finalPath).toLowerCase();
            const format = extension === '.webm' ? 'WebM' : extension === '.mp4' ? 'MP4' : extension.toUpperCase().replace('.', '');

            this.emit('stage', { stage: 'complete', message: 'Download complete!' });

            const result = { 
                path: finalPath, 
                size: finalSizeMB, 
                format,
                method: downloadMethod,
                wasCompressed,
                originalSize: initialSizeMB,
                duration: duration
            };

            this.emit('complete', result);
            return result;

        } catch (error) {
            console.error('❌ Download error:', error.message);
            this.emit('error', { message: error.message });
            
            // Cleanup any partial files - more comprehensive cleanup
            this.cleanupPartialDownloads(timestamp);
            
            // Provide more specific error messages
            const errorMsg = error.message.includes('empty') 
                ? 'Downloaded file is empty. The video may be unavailable or protected.'
                : error.message.includes('timeout')
                ? 'Download timed out. Try again or use a shorter video.'
                : `Download failed: ${error.message}`;
            
            throw new Error(errorMsg);
        } finally {
            // Remove temporary event listeners
            if (progressHandler) this.off('progress', progressHandler);
            if (stageHandler) this.off('stage', stageHandler);
        }
    }

    /**
     * Cleanup partial downloads from a specific timestamp
     */
    cleanupPartialDownloads(timestamp) {
        try {
            if (!fs.existsSync(this.tempDir)) return;
            
            const files = fs.readdirSync(this.tempDir);
            files.forEach(file => {
                // Clean up files starting with video_ or that match the timestamp
                if (file.startsWith('video_') || file.includes(String(timestamp))) {
                    try {
                        const filePath = path.join(this.tempDir, file);
                        const stats = fs.statSync(filePath);
                        // Delete if older than 5 minutes or matches timestamp
                        if (Date.now() - stats.mtimeMs > 5 * 60 * 1000 || file.includes(String(timestamp))) {
                            fs.unlinkSync(filePath);
                            console.log(`🗑️ Cleaned up partial file: ${file}`);
                        }
                    } catch (e) {}
                }
            });
        } catch (e) {
            console.error('Cleanup partial downloads error:', e.message);
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
                    thumbnail: null,
                    method: 'Cobalt'
                };
            }
        } catch (cobaltError) {
            console.log(`⚠️ Cobalt URL extraction failed: ${cobaltError.message}, trying yt-dlp...`);
            
            // Fallback to yt-dlp
            try {
                const info = await ytDlpService.getVideoInfo(url);
                if (info.url) {
                    return {
                        directUrl: info.url,
                        size: 'Unknown',
                        title: info.title || 'Video',
                        thumbnail: info.thumbnail,
                        method: 'yt-dlp'
                    };
                }
            } catch (ytdlpError) {
                console.error('❌ yt-dlp URL extraction failed:', ytdlpError.message);
            }
        }

        return null;
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