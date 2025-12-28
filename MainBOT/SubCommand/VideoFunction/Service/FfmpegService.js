const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const videoConfig = require('../Configuration/videoConfig');

class FFmpegService {
    constructor() {
        this.ffmpegBinary = 'ffmpeg';
    }

    async initialize() {
        return new Promise((resolve) => {
            const process = spawn(this.ffmpegBinary, ['-version'], {
                windowsHide: true,
                stdio: 'pipe'
            });

            process.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ FFmpeg is available');
                } else {
                    console.log('⚠️ FFmpeg not found');
                }
                resolve();
            });

            process.on('error', () => {
                console.log('⚠️ FFmpeg not found');
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

        console.log(`🔄 Compressing video from ${currentSizeMB.toFixed(2)}MB to ~${targetSizeMB}MB...`);

        const outputPath = inputPath.replace(/(\.[^.]+)$/, '_compressed$1');

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
                '-y',
                outputPath
            ];

            const process = spawn(this.ffmpegBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });

            let stderr = '';

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

                    resolve(outputPath);
                } else {
                    reject(new Error(`FFmpeg compression failed: ${stderr.trim()}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = new FFmpegService();