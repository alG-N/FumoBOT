const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const videoConfig = require('../Configuration/videoConfig');

/**
 * YtDlpService - Fallback video downloader using yt-dlp via Docker
 * Used when Cobalt fails or returns empty videos
 */
class YtDlpService extends EventEmitter {
    constructor() {
        super();
        this.containerName = 'yt-dlp';
        this.dockerDownloadPath = '/downloads';
        // Use VideoFunction temp folder directly
        this.tempDir = path.join(__dirname, '..', 'temp');
        this.initialized = false;
    }

    /**
     * Initialize and verify Docker container is running
     */
    async initialize() {
        if (this.initialized) return true;

        try {
            // Ensure temp directory exists
            if (!fs.existsSync(this.tempDir)) {
                fs.mkdirSync(this.tempDir, { recursive: true });
            }

            // Check if Docker is available
            try {
                execSync('docker --version', { 
                    stdio: 'pipe',
                    encoding: 'utf-8',
                    windowsHide: true
                });
            } catch (e) {
                console.warn('⚠️ Docker is not available');
                return false;
            }

            // Check if container is running
            try {
                const result = execSync(`docker inspect -f "{{.State.Running}}" ${this.containerName}`, { 
                    stdio: 'pipe',
                    encoding: 'utf-8',
                    windowsHide: true
                }).trim();

                if (result === 'true') {
                    this.initialized = true;
                    console.log(`✅ yt-dlp Docker container is running`);
                    return true;
                }
            } catch (e) {
                // Container doesn't exist or not running
            }

            // Try to start existing container
            try {
                execSync(`docker start ${this.containerName}`, { 
                    stdio: 'pipe',
                    windowsHide: true
                });
                this.initialized = true;
                console.log(`✅ yt-dlp Docker container started`);
                return true;
            } catch (e) {
                console.warn(`⚠️ yt-dlp container not found. Run: cd YtDlpLocalServer && docker-compose up -d`);
                return false;
            }
        } catch (error) {
            console.warn('⚠️ yt-dlp Docker setup failed:', error.message);
            return false;
        }
    }

    /**
     * Download video using yt-dlp via Docker
     * @param {string} url - Video URL
     * @param {string} tempDir - Temp directory path (used for final file location)
     * @returns {Promise<string>} - Path to downloaded file
     */
    async downloadVideo(url, tempDir, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.initialized) {
            throw new Error('yt-dlp Docker container is not available');
        }

        // Use the provided tempDir or fallback to default
        const downloadDir = tempDir || this.tempDir;
        
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const timestamp = Date.now();
        const outputFilename = `video_${timestamp}`;
        
        this.emit('stage', { stage: 'analyzing', message: 'Analyzing video with yt-dlp...' });

        return new Promise((resolve, reject) => {
            // Build quality format string - use provided quality or fall back to config
            const quality = options.quality || videoConfig.YTDLP_VIDEO_QUALITY || videoConfig.COBALT_VIDEO_QUALITY || '720';
            const formatString = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`;
            
            // Use docker exec on persistent container
            const dockerArgs = [
                'exec', this.containerName,
                'yt-dlp',
                url,
                '-f', formatString,
                '-o', `${this.dockerDownloadPath}/${outputFilename}.%(ext)s`,
                '--no-playlist',
                '--no-warnings',
                '--no-check-certificate',
                '--max-filesize', `${videoConfig.MAX_FILE_SIZE_MB || 50}M`,
                '--socket-timeout', '30',
                '--retries', String(videoConfig.MAX_RETRIES || 5),
                '--fragment-retries', String(videoConfig.FRAGMENT_RETRIES || 5),
                '--merge-output-format', 'mp4',
                '--newline',
            ];

            console.log(`📥 yt-dlp downloading (${quality}p): ${url.substring(0, 50)}...`);
            this.emit('stage', { stage: 'downloading', message: 'Downloading with yt-dlp...' });

            const dockerProcess = spawn('docker', dockerArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let lastProgressUpdate = 0;
            let outputData = '';
            let errorData = '';

            dockerProcess.stdout.on('data', (data) => {
                const line = data.toString();
                outputData += line;
                
                // Parse progress from yt-dlp output
                const progressMatch = line.match(/(\d+\.?\d*)%/);
                if (progressMatch) {
                    const now = Date.now();
                    if (now - lastProgressUpdate >= 500) {
                        const percent = parseFloat(progressMatch[1]);
                        
                        // Try to extract more info
                        const sizeMatch = line.match(/of\s+~?(\d+\.?\d*)(Mi?B|Ki?B|Gi?B)/i);
                        const speedMatch = line.match(/at\s+(\d+\.?\d*)(Mi?B|Ki?B|Gi?B)\/s/i);
                        const etaMatch = line.match(/ETA\s+(\d+:\d+|\d+:\d+:\d+)/);

                        let total = 0;
                        if (sizeMatch) {
                            const size = parseFloat(sizeMatch[1]);
                            const unit = sizeMatch[2].toLowerCase();
                            if (unit.includes('g')) total = size * 1024 * 1024 * 1024;
                            else if (unit.includes('m')) total = size * 1024 * 1024;
                            else if (unit.includes('k')) total = size * 1024;
                        }

                        this.emit('progress', {
                            percent,
                            total,
                            downloaded: total * (percent / 100),
                            speed: speedMatch ? speedMatch[0] : null,
                            eta: etaMatch ? etaMatch[1] : null
                        });
                        lastProgressUpdate = now;
                    }
                }
            });

            dockerProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            dockerProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('❌ yt-dlp stderr:', errorData);
                    reject(new Error(this._parseYtDlpError(errorData) || `yt-dlp exited with code ${code}`));
                    return;
                }

                // Find the output file directly in the temp directory
                const files = fs.readdirSync(downloadDir);
                const outputFile = files.find(f => f.startsWith(outputFilename));

                if (!outputFile) {
                    reject(new Error('yt-dlp did not produce an output file'));
                    return;
                }

                const finalPath = path.join(downloadDir, outputFile);
                const stats = fs.statSync(finalPath);
                const fileSizeInMB = stats.size / (1024 * 1024);

                if (stats.size === 0) {
                    fs.unlinkSync(finalPath);
                    reject(new Error('Downloaded file is empty'));
                    return;
                }

                console.log(`✅ yt-dlp downloaded ${fileSizeInMB.toFixed(2)} MB to ${finalPath}`);
                this.emit('complete', { 
                    path: finalPath, 
                    size: fileSizeInMB 
                });

                resolve(finalPath);
            });

            dockerProcess.on('error', (err) => {
                reject(new Error(`Docker spawn error: ${err.message}`));
            });
        });
    }

    /**
     * Parse yt-dlp error messages into user-friendly messages
     */
    _parseYtDlpError(errorText) {
        if (!errorText) return null;
        
        const errorLower = errorText.toLowerCase();
        
        if (errorLower.includes('private video') || errorLower.includes('sign in')) {
            return 'This video is private or requires login';
        }
        if (errorLower.includes('copyright') || errorLower.includes('blocked')) {
            return 'This video is blocked due to copyright';
        }
        if (errorLower.includes('age') || errorLower.includes('confirm your age')) {
            return 'This video is age-restricted';
        }
        if (errorLower.includes('unavailable') || errorLower.includes('not available')) {
            return 'This video is unavailable';
        }
        if (errorLower.includes('live')) {
            return 'Cannot download live streams';
        }
        if (errorLower.includes('premieres') || errorLower.includes('scheduled')) {
            return 'This video has not premiered yet';
        }
        if (errorLower.includes('members only')) {
            return 'This video is for channel members only';
        }
        if (errorLower.includes('file size')) {
            return 'Video exceeds maximum file size limit';
        }
        if (errorLower.includes('unsupported url') || errorLower.includes('no video')) {
            return 'Unsupported URL or no video found';
        }
        
        // Extract the actual error message if possible
        const errorMatch = errorText.match(/ERROR:\s*(.+)/i);
        if (errorMatch) {
            return errorMatch[1].trim();
        }
        
        return null;
    }

    /**
     * Get video info without downloading (via Docker)
     */
    async getVideoInfo(url) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.initialized) {
            throw new Error('yt-dlp Docker container is not available');
        }

        return new Promise((resolve, reject) => {
            try {
                const result = execSync(
                    `docker run --rm jauderho/yt-dlp:latest --dump-single-json --no-warnings --no-check-certificate --no-playlist "${url}"`,
                    { 
                        stdio: 'pipe',
                        encoding: 'utf-8',
                        timeout: 30000,
                        windowsHide: true
                    }
                );
                
                const info = JSON.parse(result);
                resolve({
                    title: info.title,
                    duration: info.duration,
                    thumbnail: info.thumbnail,
                    uploader: info.uploader,
                    url: info.url || info.webpage_url
                });
            } catch (error) {
                reject(new Error(this._parseYtDlpError(error.message) || 'Failed to get video info'));
            }
        });
    }
}

module.exports = new YtDlpService();
