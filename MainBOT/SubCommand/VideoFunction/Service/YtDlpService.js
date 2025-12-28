const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const videoConfig = require('../Configuration/videoConfig');

class YtDlpService {
    constructor() {
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

        await new Promise((resolve, reject) => {
            const args = [
                url,
                '-f', 'b[filesize<20M][height<=720]/bv*[height<=720][filesize<15M]+ba/bv*[height<=480]+ba/b',
                '--merge-output-format', 'mp4',
                '--max-filesize', '25M',
                '--no-playlist',
                '-o', outputTemplate,
                '--no-warnings',
                '--quiet',
                '--progress',
                '--newline',
                '--retries', videoConfig.MAX_RETRIES.toString(),
                '--fragment-retries', videoConfig.FRAGMENT_RETRIES.toString(),
                '--concurrent-fragments', videoConfig.CONCURRENT_FRAGMENTS.toString(),
                '--buffer-size', videoConfig.BUFFER_SIZE,
                '--http-chunk-size', '10M',
                '--extractor-args', 'youtube:player_client=ios,web',
                '--user-agent', videoConfig.USER_AGENT,
                '--no-check-certificates',
                '--prefer-free-formats'
            ];

            const process = spawn(this.ytDlpBinary, args, {
                windowsHide: true,
                stdio: 'pipe'
            });
            
            let stderr = '';

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Download failed: ${stderr.trim() || 'Unknown error'}`));
                }
            });

            process.on('error', (error) => {
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

        if (fileSizeInMB > videoConfig.MAX_FILE_SIZE_MB) {
            fs.unlinkSync(actualPath);
            throw new Error(`Video is too large (${fileSizeInMB.toFixed(2)}MB). Discord has a ${videoConfig.MAX_FILE_SIZE_MB}MB limit. Try a shorter video.`);
        }

        if (fileSizeInMB === 0) {
            fs.unlinkSync(actualPath);
            throw new Error('Downloaded file is empty.');
        }

        return actualPath;
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