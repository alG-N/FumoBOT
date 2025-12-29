const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const videoConfig = require('../Configuration/videoConfig');

/**
 * Enhanced FFmpegService with progress tracking and event emission
 */
class FFmpegService extends EventEmitter {
    constructor() {
        super();
        this.ffmpegBinary = 'ffmpeg';
        this.ffprobeBinary = 'ffprobe';
        this.isAvailable = false;
    }

    async initialize() {
        return new Promise((resolve) => {
            const process = spawn(this.ffmpegBinary, ['-version'], {
                windowsHide: true,
                stdio: 'pipe'
            });

            process.on('close', (code) => {
                if (code === 0) {
                    this.isAvailable = true;
                    console.log('✅ FFmpeg is available');
                } else {
                    this.isAvailable = false;
                    console.log('⚠️ FFmpeg not found - compression disabled');
                }
                resolve();
            });

            process.on('error', () => {
                this.isAvailable = false;
                console.log('⚠️ FFmpeg not found - compression disabled');
                console.log('   Install FFmpeg: https://ffmpeg.org/download.html');
                console.log('   Or use: winget install ffmpeg');
                resolve();
            });
        });
    }

    async compressVideo(inputPath, targetSizeMB) {
        const stats = fs.statSync(inputPath);
        const currentSizeMB = stats.size / (1024 * 1024);

        if (currentSizeMB <= targetSizeMB) {
            console.log(`✅ Video is already under ${targetSizeMB}MB (${currentSizeMB.toFixed(2)}MB)`);
            return inputPath;
        }

        // If FFmpeg is not available, return original file
        if (!this.isAvailable) {
            console.log(`⚠️ FFmpeg not available - skipping compression (file is ${currentSizeMB.toFixed(2)}MB)`);
            return inputPath;
        }

        console.log(`🔄 Compressing video from ${currentSizeMB.toFixed(2)}MB to ~${targetSizeMB}MB...`);
        this.emit('stage', { stage: 'compressing', message: 'Starting compression...' });
        this.emit('compressionStart', { originalSize: currentSizeMB, targetSize: targetSizeMB });

        const outputPath = inputPath.replace(/(\.[^.]+)$/, '_compressed$1');
        
        // Get video duration for progress tracking
        const duration = await this._getVideoDuration(inputPath);

        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputPath,
                '-c:v', 'libx264',
                '-preset', videoConfig.FFMPEG_PRESET,
                '-crf', videoConfig.FFMPEG_CRF,
                '-maxrate', videoConfig.VIDEO_BITRATE,
                '-bufsize', '3M',
                '-c:a', 'aac',
                '-b:a', videoConfig.AUDIO_BITRATE,
                '-movflags', '+faststart',
                '-threads', '0',
                '-progress', 'pipe:1',  // Output progress to stdout
                '-y',
                outputPath
            ];

            const process = spawn(this.ffmpegBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });

            let stderr = '';
            let lastProgressUpdate = 0;

            process.stdout.on('data', (data) => {
                const output = data.toString();
                
                // Parse FFmpeg progress output
                const timeMatch = output.match(/out_time_ms=(\d+)/);
                if (timeMatch && duration > 0) {
                    const currentTime = parseInt(timeMatch[1]) / 1000000; // Convert microseconds to seconds
                    const percent = Math.min((currentTime / duration) * 100, 100);
                    
                    const now = Date.now();
                    if (now - lastProgressUpdate >= 500) {
                        this.emit('progress', {
                            percent,
                            currentTime,
                            duration,
                            originalSize: currentSizeMB,
                            targetSize: targetSizeMB
                        });
                        lastProgressUpdate = now;
                    }
                }
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    try {
                        fs.unlinkSync(inputPath);
                    } catch (e) {}

                    const compressedStats = fs.statSync(outputPath);
                    const compressedSizeMB = compressedStats.size / (1024 * 1024);
                    console.log(`✅ Compressed to ${compressedSizeMB.toFixed(2)}MB`);
                    
                    this.emit('compressionComplete', { 
                        originalSize: currentSizeMB, 
                        compressedSize: compressedSizeMB,
                        savings: ((currentSizeMB - compressedSizeMB) / currentSizeMB * 100).toFixed(1)
                    });

                    resolve(outputPath);
                } else {
                    // Compression failed, return original file
                    console.log(`⚠️ Compression failed, using original file`);
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                    resolve(inputPath);
                }
            });

            process.on('error', (error) => {
                console.log(`⚠️ FFmpeg error: ${error.message}, using original file`);
                resolve(inputPath);
            });
        });
    }

    /**
     * Get video duration using ffprobe
     */
    async _getVideoDuration(inputPath) {
        return new Promise((resolve) => {
            const args = [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                inputPath
            ];

            const process = spawn(this.ffprobeBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });

            let stdout = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.on('close', () => {
                const duration = parseFloat(stdout.trim());
                resolve(isNaN(duration) ? 0 : duration);
            });

            process.on('error', () => {
                resolve(0);
            });
        });
    }
}

module.exports = new FFmpegService();