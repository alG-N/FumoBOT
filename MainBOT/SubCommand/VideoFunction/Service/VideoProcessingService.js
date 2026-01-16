const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const videoConfig = require('../Configuration/videoConfig');

/**
 * VideoProcessingService - Ensures videos are mobile-compatible
 * Converts videos to H.264 + AAC format for universal playback
 */
class VideoProcessingService extends EventEmitter {
    constructor() {
        super();
        this.ffmpegPath = 'ffmpeg';
        this.ffprobePath = 'ffprobe';
        this.initialized = false;
    }

    /**
     * Initialize and check if FFmpeg is available
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            execSync('ffmpeg -version', { stdio: 'pipe', windowsHide: true });
            execSync('ffprobe -version', { stdio: 'pipe', windowsHide: true });
            this.initialized = true;
            console.log('✅ VideoProcessingService initialized (FFmpeg available)');
            return true;
        } catch (error) {
            console.warn('⚠️ FFmpeg not found - video processing disabled');
            console.warn('   Install FFmpeg for mobile-compatible video encoding');
            return false;
        }
    }

    /**
     * Check if video needs re-encoding for mobile compatibility
     * @param {string} videoPath - Path to video file
     * @returns {Promise<Object>} Video info and whether it needs re-encoding
     */
    async analyzeVideo(videoPath) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.initialized) {
            return { needsReencoding: false, reason: 'FFmpeg not available' };
        }

        return new Promise((resolve, reject) => {
            const args = [
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                videoPath
            ];

            const ffprobe = spawn(this.ffprobePath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let output = '';
            let errorOutput = '';

            ffprobe.stdout.on('data', (data) => {
                output += data.toString();
            });

            ffprobe.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ffprobe.on('close', (code) => {
                if (code !== 0) {
                    console.error('FFprobe error:', errorOutput);
                    resolve({ needsReencoding: false, reason: 'Analysis failed' });
                    return;
                }

                try {
                    const info = JSON.parse(output);
                    const videoStream = info.streams?.find(s => s.codec_type === 'video');
                    const audioStream = info.streams?.find(s => s.codec_type === 'audio');

                    if (!videoStream) {
                        resolve({ needsReencoding: false, reason: 'No video stream' });
                        return;
                    }

                    const videoCodec = videoStream.codec_name?.toLowerCase() || '';
                    const audioCodec = audioStream?.codec_name?.toLowerCase() || '';
                    const container = path.extname(videoPath).toLowerCase();

                    // Mobile-compatible codecs
                    const mobileVideoCodecs = ['h264', 'avc', 'avc1'];
                    const mobileAudioCodecs = ['aac', 'mp3', 'mp4a'];

                    const isVideoCompatible = mobileVideoCodecs.some(c => videoCodec.includes(c));
                    const isAudioCompatible = !audioStream || mobileAudioCodecs.some(c => audioCodec.includes(c));
                    const isContainerCompatible = container === '.mp4';

                    const needsReencoding = !isVideoCompatible || !isAudioCompatible || !isContainerCompatible;

                    const result = {
                        needsReencoding,
                        videoCodec,
                        audioCodec,
                        container,
                        width: videoStream.width,
                        height: videoStream.height,
                        duration: parseFloat(info.format?.duration || 0),
                        reason: needsReencoding
                            ? `Video: ${videoCodec}${!isVideoCompatible ? ' (incompatible)' : ''}, ` +
                              `Audio: ${audioCodec || 'none'}${!isAudioCompatible ? ' (incompatible)' : ''}, ` +
                              `Container: ${container}${!isContainerCompatible ? ' (incompatible)' : ''}`
                            : 'Already mobile-compatible'
                    };

                    console.log(`📊 Video analysis: ${result.reason}`);
                    resolve(result);
                } catch (parseError) {
                    console.error('FFprobe parse error:', parseError.message);
                    resolve({ needsReencoding: false, reason: 'Parse failed' });
                }
            });

            ffprobe.on('error', (err) => {
                console.error('FFprobe spawn error:', err.message);
                resolve({ needsReencoding: false, reason: 'Spawn failed' });
            });
        });
    }

    /**
     * Convert video to mobile-compatible format (H.264 + AAC in MP4)
     * @param {string} inputPath - Input video path
     * @param {Object} options - Processing options
     * @returns {Promise<string>} Path to processed video
     */
    async processForMobile(inputPath, options = {}) {
        // Check if mobile processing is enabled
        if (videoConfig.ENABLE_MOBILE_PROCESSING === false) {
            console.log('⏭️ Mobile processing disabled in config');
            return inputPath;
        }

        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.initialized) {
            console.log('⚠️ FFmpeg not available, skipping processing');
            return inputPath;
        }

        // Analyze the video first
        const analysis = await this.analyzeVideo(inputPath);

        if (!analysis.needsReencoding) {
            console.log('✅ Video is already mobile-compatible');
            return inputPath;
        }

        this.emit('stage', { stage: 'processing', message: 'Converting for mobile compatibility...' });
        console.log(`🔄 Re-encoding video for mobile: ${analysis.reason}`);

        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            const outputPath = inputPath.replace(/\.[^.]+$/, `_mobile_${timestamp}.mp4`);
            
            // Get settings from config or use defaults
            const videoCodec = videoConfig.MOBILE_VIDEO_CODEC || 'libx264';
            const audioCodec = videoConfig.MOBILE_AUDIO_CODEC || 'aac';
            const crf = videoConfig.MOBILE_CRF || '23';
            const preset = videoConfig.MOBILE_PRESET || 'fast';
            
            // FFmpeg arguments for mobile-compatible encoding
            // Using H.264 (libx264) + AAC, with faststart for streaming
            const args = [
                '-i', inputPath,
                '-y',                           // Overwrite output
                '-c:v', videoCodec,             // H.264 video codec (universal mobile support)
                '-preset', preset,              // Balance between speed and compression
                '-crf', crf,                    // Quality (lower = better, 23 is good balance)
                '-profile:v', 'high',           // High profile for better compression
                '-level', '4.1',                // Compatible with most devices
                '-pix_fmt', 'yuv420p',          // Required for some players
                '-c:a', audioCodec,             // AAC audio codec
                '-b:a', '192k',                 // Audio bitrate
                '-ar', '44100',                 // Audio sample rate
                '-movflags', '+faststart',      // Enable fast start for streaming/mobile
                '-max_muxing_queue_size', '1024',
                outputPath
            ];

            // Add duration limit if needed
            if (analysis.duration > videoConfig.MAX_VIDEO_DURATION_SECONDS) {
                args.splice(2, 0, '-t', String(videoConfig.MAX_VIDEO_DURATION_SECONDS));
            }

            console.log(`🎬 FFmpeg processing: ${inputPath} -> ${outputPath}`);

            const ffmpeg = spawn(this.ffmpegPath, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let lastProgressUpdate = 0;
            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                const line = data.toString();
                errorOutput += line;

                // Parse progress from FFmpeg output
                const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.?\d*)/);
                if (timeMatch && analysis.duration > 0) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    const currentTime = hours * 3600 + minutes * 60 + seconds;
                    const percent = Math.min((currentTime / analysis.duration) * 100, 99);

                    const now = Date.now();
                    if (now - lastProgressUpdate >= 500) {
                        this.emit('progress', {
                            percent,
                            stage: 'processing',
                            message: `Converting: ${percent.toFixed(0)}%`
                        });
                        lastProgressUpdate = now;
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    console.error('❌ FFmpeg error:', errorOutput.slice(-500));
                    // Return original file if processing fails
                    resolve(inputPath);
                    return;
                }

                // Verify output file exists and has content
                if (fs.existsSync(outputPath)) {
                    const stats = fs.statSync(outputPath);
                    if (stats.size > 0) {
                        console.log(`✅ Video processed: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                        
                        // Delete original file
                        try {
                            fs.unlinkSync(inputPath);
                        } catch (e) {
                            console.warn('Could not delete original file:', e.message);
                        }

                        this.emit('progress', { percent: 100, stage: 'processing', message: 'Processing complete!' });
                        resolve(outputPath);
                        return;
                    }
                }

                // Output file invalid, return original
                console.warn('⚠️ Processed file invalid, using original');
                try {
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                } catch (e) {}
                resolve(inputPath);
            });

            ffmpeg.on('error', (err) => {
                console.error('FFmpeg spawn error:', err.message);
                resolve(inputPath);
            });

            // Timeout for processing (5 minutes max)
            const timeout = setTimeout(() => {
                console.warn('⚠️ FFmpeg processing timeout');
                ffmpeg.kill('SIGKILL');
            }, 5 * 60 * 1000);

            ffmpeg.on('close', () => clearTimeout(timeout));
        });
    }

    /**
     * Quick check if file is mobile-compatible without full analysis
     * @param {string} videoPath - Video file path
     * @returns {boolean} True if likely compatible
     */
    isLikelyMobileCompatible(videoPath) {
        const ext = path.extname(videoPath).toLowerCase();
        // WebM files are almost never mobile-compatible
        // MKV files need conversion
        return ext === '.mp4';
    }
}

module.exports = new VideoProcessingService();
