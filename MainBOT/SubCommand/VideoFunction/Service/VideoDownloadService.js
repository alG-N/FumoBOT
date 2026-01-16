const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const cobaltService = require('./CobaltService');
const ytDlpService = require('./YtDlpService');
const videoConfig = require('../Configuration/videoConfig');

/**
 * VideoDownloadService - Cobalt with yt-dlp fallback
 * Uses self-hosted Cobalt API for video downloads
 */
class VideoDownloadService extends EventEmitter {
    constructor() {
        super();
        this.tempDir = path.join(__dirname, '..', 'temp');
        this.currentDownload = null;
        this.initialized = false;
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
    }

    async initialize() {
        if (this.initialized) return;
        
        // Ensure temp directory exists
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Initialize yt-dlp as fallback
        await ytDlpService.initialize();
        
        this.startCleanupInterval();
        this.initialized = true;
        console.log('✅ VideoDownloadService initialized');
    }

    /**
     * Download video with progress tracking
     * @param {string} url - Video URL
     * @param {Object} options - Download options
     * @returns {Promise<Object>} Download result
     */
    async downloadVideo(url, options = {}) {
        // Auto-initialize on first use
        if (!this.initialized) {
            await this.initialize();
        }
        
        const timestamp = Date.now();
        const { onProgress, onStage, quality } = options;
        
        // Use provided quality or fall back to config default
        const videoQuality = quality || videoConfig.COBALT_VIDEO_QUALITY || '720';
        
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
                videoPath = await cobaltService.downloadVideo(url, this.tempDir, { quality: videoQuality });
            } catch (cobaltError) {
                console.log(`⚠️ Cobalt failed: ${cobaltError.message}, trying yt-dlp fallback...`);
                this.emit('stage', { stage: 'fallback', message: 'Cobalt failed, trying yt-dlp...', method: 'yt-dlp' });
                
                // Fallback to yt-dlp
                try {
                    videoPath = await ytDlpService.downloadVideo(url, this.tempDir, { quality: videoQuality });
                    downloadMethod = 'yt-dlp';
                } catch (ytdlpError) {
                    // Both failed, throw combined error
                    throw new Error(`Cobalt: ${cobaltError.message} | yt-dlp: ${ytdlpError.message}`);
                }
            }
            
            // Verify file exists and get size
            if (!fs.existsSync(videoPath)) {
                throw new Error('Download completed but file not found');
            }
            
            // Get file size
            const stats = fs.statSync(videoPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            // Check if file is empty
            if (fileSizeMB === 0) {
                fs.unlinkSync(videoPath);
                throw new Error('Downloaded file is empty. The video may be unavailable or protected.');
            }

            const extension = path.extname(videoPath).toLowerCase();
            const format = extension === '.webm' ? 'WebM' : extension === '.mp4' ? 'MP4' : extension.toUpperCase().replace('.', '');

            this.emit('stage', { stage: 'complete', message: 'Download complete!' });

            const result = { 
                path: videoPath, 
                size: fileSizeMB, 
                format,
                method: downloadMethod
            };

            this.emit('complete', result);
            return result;

        } catch (error) {
            console.error('❌ Download error:', error.message);
            this.emit('error', { message: error.message });
            
            // Cleanup any partial files
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
                try {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (now - stats.mtimeMs > videoConfig.TEMP_FILE_MAX_AGE) {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Cleaned up old temp file: ${file}`);
                    }
                } catch (fileErr) {
                    // Ignore individual file errors
                }
            });
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }

    startCleanupInterval() {
        // Only start one cleanup interval
        if (this.cleanupIntervalId) return;
        
        this.cleanupIntervalId = setInterval(() => {
            this.cleanupTempFiles();
        }, videoConfig.TEMP_FILE_CLEANUP_INTERVAL);
    }

    deleteFile(filePath, delay = videoConfig.FILE_DELETE_DELAY || 5000) {
        if (!filePath) return;
        
        setTimeout(() => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error(`Failed to delete file ${filePath}:`, err.message);
            }
        }, delay);
    }
}

module.exports = new VideoDownloadService();