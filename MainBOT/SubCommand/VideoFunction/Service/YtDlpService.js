const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const { EventEmitter } = require('events');
const videoConfig = require('../Configuration/videoConfig');

/**
 * Enhanced YtDlpService with progress tracking and event emission
 */
class YtDlpService extends EventEmitter {
    constructor() {
        super();
        this.ytDlpDir = path.join(__dirname, '..', 'yt-dlp-bin');
        this.ytDlpBinary = path.join(this.ytDlpDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
    }

    async initialize() {
        await this.ensureYtDlp();
        await this.updateYtDlp();
    }

    async ensureYtDlp() {
        if (fs.existsSync(this.ytDlpBinary)) {
            const stats = fs.statSync(this.ytDlpBinary);
            if (stats.size > 1000000) {
                return true;
            } else {
                fs.unlinkSync(this.ytDlpBinary);
            }
        }

        console.log('📥 Downloading yt-dlp binary from GitHub...');

        if (!fs.existsSync(this.ytDlpDir)) {
            fs.mkdirSync(this.ytDlpDir, { recursive: true });
        }

        const downloadUrl = process.platform === 'win32'
            ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
            : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

        return new Promise((resolve, reject) => {
            let totalBytes = 0;
            let redirectCount = 0;
            const maxRedirects = 5;

            const downloadFile = (url) => {
                if (redirectCount >= maxRedirects) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const file = fs.createWriteStream(this.ytDlpBinary);
                
                https.get(url, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                }, (response) => {
                    if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
                        redirectCount++;
                        file.close();
                        if (fs.existsSync(this.ytDlpBinary)) {
                            fs.unlinkSync(this.ytDlpBinary);
                        }
                        downloadFile(response.headers.location);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        file.close();
                        if (fs.existsSync(this.ytDlpBinary)) {
                            fs.unlinkSync(this.ytDlpBinary);
                        }
                        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                        return;
                    }

                    response.on('data', (chunk) => {
                        totalBytes += chunk.length;
                    });

                    response.pipe(file);
                    
                    file.on('finish', () => {
                        file.close();
                        console.log(`✅ yt-dlp downloaded successfully (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
                        
                        const stats = fs.statSync(this.ytDlpBinary);
                        if (stats.size < 1000000) {
                            fs.unlinkSync(this.ytDlpBinary);
                            reject(new Error(`Downloaded file is too small (${stats.size} bytes)`));
                            return;
                        }
                        
                        if (process.platform !== 'win32') {
                            fs.chmodSync(this.ytDlpBinary, '755');
                        }
                        resolve(true);
                    });
                    
                    file.on('error', (err) => {
                        if (fs.existsSync(this.ytDlpBinary)) {
                            fs.unlinkSync(this.ytDlpBinary);
                        }
                        reject(err);
                    });
                }).on('error', (err) => {
                    file.close();
                    if (fs.existsSync(this.ytDlpBinary)) {
                        fs.unlinkSync(this.ytDlpBinary);
                    }
                    reject(err);
                });
            };

            downloadFile(downloadUrl);
        });
    }

    async updateYtDlp() {
        if (!fs.existsSync(this.ytDlpBinary)) return false;
        
        console.log('🔄 Checking for yt-dlp updates...');
        
        try {
            const updateProcess = spawn(this.ytDlpBinary, ['-U'], { 
                windowsHide: true,
                stdio: 'pipe'
            });
            
            await new Promise((resolve) => {
                updateProcess.on('close', resolve);
            });
            
            console.log('✅ yt-dlp is up to date');
            return true;
        } catch (error) {
            console.error('⚠️ Could not update yt-dlp:', error.message);
            return false;
        }
    }

    async downloadVideo(url, tempDir) {
        await this.ensureYtDlp();

        const timestamp = Date.now();
        const outputTemplate = path.join(tempDir, `video_${timestamp}.%(ext)s`);

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        this.emit('stage', { stage: 'connecting', message: 'Initializing yt-dlp...' });

        await new Promise((resolve, reject) => {
            const args = [
                url,
                // Most flexible format - just get best available, let yt-dlp decide
                '-f', 'best[height<=720]/best',
                '--no-playlist',
                '-o', outputTemplate,
                '--no-warnings',
                '--progress',
                '--newline',
                '--retries', videoConfig.MAX_RETRIES.toString(),
                '--fragment-retries', videoConfig.FRAGMENT_RETRIES.toString(),
                '--user-agent', videoConfig.USER_AGENT,
                '--no-check-certificates',
                '--socket-timeout', '30',
                '--extractor-args', 'youtube:player_client=mweb,android',
                '--cookies-from-browser', 'chrome',  // Try to use browser cookies
                '--ignore-errors'
            ];

            const ytProcess = spawn(this.ytDlpBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });
            
            let stderr = '';
            let stdout = '';
            let lastProgressUpdate = 0;

            ytProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                
                // Parse progress from yt-dlp output
                const progressMatch = output.match(/(\d+\.?\d*)%/);
                const sizeMatch = output.match(/of\s+~?\s*(\d+\.?\d*)(Ki?B|Mi?B|Gi?B)/i);
                const speedMatch = output.match(/at\s+(\d+\.?\d*)(Ki?B|Mi?B)\/s/i);
                const etaMatch = output.match(/ETA\s+(\d+:\d+)/);
                
                const now = Date.now();
                if (progressMatch && now - lastProgressUpdate >= 500) {
                    const percent = parseFloat(progressMatch[1]);
                    let total = 0;
                    let speed = 0;
                    let eta = 0;
                    
                    if (sizeMatch) {
                        const multiplier = sizeMatch[2].toLowerCase().startsWith('g') ? 1024 * 1024 * 1024 :
                                          sizeMatch[2].toLowerCase().startsWith('m') ? 1024 * 1024 : 1024;
                        total = parseFloat(sizeMatch[1]) * multiplier;
                    }
                    
                    if (speedMatch) {
                        const multiplier = speedMatch[2].toLowerCase().startsWith('m') ? 1024 * 1024 : 1024;
                        speed = parseFloat(speedMatch[1]) * multiplier;
                    }
                    
                    if (etaMatch) {
                        const parts = etaMatch[1].split(':');
                        eta = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                    }
                    
                    this.emit('progress', {
                        percent,
                        total,
                        downloaded: total * (percent / 100),
                        speed,
                        eta
                    });
                    
                    lastProgressUpdate = now;
                }

                // Detect stage changes
                if (output.includes('Downloading')) {
                    this.emit('stage', { stage: 'downloading', message: 'Downloading video...' });
                } else if (output.includes('Merging')) {
                    this.emit('stage', { stage: 'processing', message: 'Merging video and audio...' });
                }
            });

            ytProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytProcess.on('close', (code) => {
                if (code === 0) {
                    this.emit('stage', { stage: 'complete', message: 'Download complete!' });
                    resolve();
                } else {
                    // If format selection failed, try again with no format restriction
                    if (stderr.includes('Requested format is not available')) {
                        this._downloadWithoutFormatRestriction(url, outputTemplate)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(new Error(`Download failed: ${stderr.trim() || stdout.trim() || 'Unknown error'}`));
                    }
                }
            });

            ytProcess.on('error', (error) => {
                reject(error);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`video_${timestamp}`));

        if (files.length === 0) {
            throw new Error('No video downloaded. The video might be unavailable, private, or geo-restricted.');
        }

        const actualPath = path.join(tempDir, files[0]);

        if (!fs.existsSync(actualPath)) {
            throw new Error('Video file not found after download.');
        }

        const stats = fs.statSync(actualPath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        if (fileSizeInMB === 0) {
            fs.unlinkSync(actualPath);
            throw new Error('Downloaded file is empty.');
        }

        return actualPath;
    }

    async _downloadWithoutFormatRestriction(url, outputTemplate) {
        return new Promise((resolve, reject) => {
            console.log('🔄 Retrying with no format restriction...');
            
            const args = [
                url,
                '-f', 'best',  // Just get whatever is available
                '--no-playlist',
                '-o', outputTemplate,
                '--no-warnings',
                '--retries', '3',
                '--user-agent', videoConfig.USER_AGENT,
                '--no-check-certificates',
                '--extractor-args', 'youtube:player_client=tv_embedded'
            ];

            const ytProcess = spawn(this.ytDlpBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });

            let stderr = '';

            ytProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ytProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Download failed: ${stderr.trim() || 'Unknown error'}`));
                }
            });

            ytProcess.on('error', reject);
        });
    }

    async getVideoInfo(url) {
        await this.ensureYtDlp();

        return new Promise((resolve, reject) => {
            const args = [
                url,
                '-j',
                '--no-playlist',
                '--skip-download'
            ];

            const process = spawn(this.ytDlpBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });
            
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const info = JSON.parse(stdout);
                        resolve(info);
                    } catch (error) {
                        reject(new Error('Failed to parse video info'));
                    }
                } else {
                    reject(new Error(`Info extraction failed: ${stderr.trim()}`));
                }
            });

            process.on('error', reject);
        });
    }
}

module.exports = new YtDlpService();