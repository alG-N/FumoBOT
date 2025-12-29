const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const cobaltService = require('./CobaltService');
const ytDlpService = require('./YtdlpService');
const ffmpegService = require('./FFmpegService');
const videoConfig = require('../Configuration/videoConfig');

/**
 * Enhanced VideoDownloadService with progress tracking and event emission
 * Aggregates events from all download services
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
            let downloadMethod = 'Unknown';

            // Try Cobalt first if enabled
            if (videoConfig.USE_COBALT) {
                try {
                    console.log(`📥 Downloading via Cobalt (${videoConfig.COBALT_INSTANCES[0]})...`);
                    this.emit('stage', { stage: 'connecting', message: 'Connecting to Cobalt...', method: 'Cobalt' });
                    videoPath = await cobaltService.downloadVideo(url, this.tempDir);
                    downloadMethod = 'Cobalt';
                    console.log('✅ Cobalt download successful');
                } catch (cobaltError) {
                    console.error('⚠️ Cobalt failed:', cobaltError.message);
                    this.emit('fallback', { from: 'Cobalt', to: 'yt-dlp', reason: cobaltError.message });
                    
                    if (videoConfig.USE_YTDLP_FALLBACK) {
                        console.log('📥 Falling back to yt-dlp...');
                        this.emit('stage', { stage: 'connecting', message: 'Falling back to yt-dlp...', method: 'yt-dlp' });
                        videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
                        downloadMethod = 'yt-dlp';
                    } else {
                        throw cobaltError;
                    }
                }
            } else {
                // Use yt-dlp directly
                console.log('📥 Downloading via yt-dlp...');
                this.emit('stage', { stage: 'connecting', message: 'Connecting to yt-dlp...', method: 'yt-dlp' });
                videoPath = await ytDlpService.downloadVideo(url, this.tempDir);
                downloadMethod = 'yt-dlp';
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
                originalSize: initialSizeMB
            };

            this.emit('complete', result);
            return result;

        } catch (error) {
            console.error('❌ Download error:', error.message);
            this.emit('error', { message: error.message });
            
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
        } finally {
            // Remove temporary event listeners
            if (progressHandler) this.off('progress', progressHandler);
            if (stageHandler) this.off('stage', stageHandler);
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