const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const videoConfig = require('../Configuration/videoConfig');

/**
 * Enhanced CobaltService with progress tracking and event emission
 */
class CobaltService extends EventEmitter {
    constructor() {
        super();
        // Use configured Cobalt instances
        this.apiUrls = videoConfig.COBALT_INSTANCES || [
            'http://localhost:9000'
        ];
        this.currentApiIndex = 0;
    }

    get apiUrl() {
        return this.apiUrls[this.currentApiIndex];
    }

    switchApi() {
        this.currentApiIndex = (this.currentApiIndex + 1) % this.apiUrls.length;
        console.log(`🔄 Switching to Cobalt API: ${this.apiUrl}`);
        this.emit('apiSwitch', { api: this.apiUrl });
    }

    async downloadVideo(url, tempDir) {
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const timestamp = Date.now();
        let lastError = null;

        this.emit('stage', { stage: 'connecting', message: 'Connecting to Cobalt API...' });

        // Try each API instance
        for (let attempt = 0; attempt < this.apiUrls.length; attempt++) {
            try {
                this.emit('attempt', { attempt: attempt + 1, total: this.apiUrls.length, api: this.apiUrl });
                const result = await this._tryDownload(url, tempDir, timestamp);
                return result;
            } catch (error) {
                lastError = error;
                console.error(`❌ Cobalt API ${this.apiUrl} failed:`, error.message);
                this.emit('error', { api: this.apiUrl, error: error.message });
                this.switchApi();
            }
        }

        throw lastError || new Error('All Cobalt API instances failed');
    }

    async _tryDownload(url, tempDir, timestamp) {
        this.emit('stage', { stage: 'analyzing', message: 'Analyzing video...' });
        const downloadInfo = await this._requestDownload(url);

        if (!downloadInfo.url) {
            throw new Error(downloadInfo.error || 'Failed to get download URL');
        }

        this.emit('stage', { stage: 'downloading', message: 'Downloading video file...' });

        const extension = downloadInfo.filename?.split('.').pop() || 'mp4';
        const outputPath = path.join(tempDir, `video_${timestamp}.${extension}`);
        await this._downloadFile(downloadInfo.url, outputPath);

        if (!fs.existsSync(outputPath)) {
            throw new Error('Video file not found after download');
        }

        const stats = fs.statSync(outputPath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        if (fileSizeInMB === 0) {
            fs.unlinkSync(outputPath);
            throw new Error('Downloaded file is empty');
        }

        this.emit('complete', { 
            path: outputPath, 
            size: fileSizeInMB,
            filename: downloadInfo.filename 
        });

        if (fileSizeInMB > videoConfig.MAX_FILE_SIZE_MB) {
            console.log(`⚠️ Video is ${fileSizeInMB.toFixed(2)}MB, will attempt compression`);
        }

        return outputPath;
    }

    _requestDownload(url) {
        return new Promise((resolve, reject) => {
            // Cobalt API format - use configured quality
            const requestBody = JSON.stringify({
                url: url,
                videoQuality: videoConfig.COBALT_VIDEO_QUALITY || '480',
                audioBitrate: videoConfig.COBALT_AUDIO_BITRATE || '128',
                filenameStyle: 'basic'
            });

            const apiUrlParsed = new URL(this.apiUrl);
            const isHttps = apiUrlParsed.protocol === 'https:';
            const protocol = isHttps ? https : http;
            
            const options = {
                hostname: apiUrlParsed.hostname,
                port: apiUrlParsed.port || (isHttps ? 443 : 80),
                path: '/',  // Cobalt API endpoint
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Content-Length': Buffer.byteLength(requestBody),
                    'User-Agent': videoConfig.USER_AGENT
                },
                timeout: videoConfig.DOWNLOAD_TIMEOUT
            };

            console.log(`🔗 Requesting from Cobalt: ${this.apiUrl}`);

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        // Check if response is HTML (error page)
                        if (data.trim().startsWith('<!') || data.trim().startsWith('<html')) {
                            reject(new Error('API returned HTML instead of JSON (might be blocked or down)'));
                            return;
                        }

                        const parsed = JSON.parse(data);
                        console.log(`📦 Cobalt response status: ${parsed.status}`);
                        
                        // Handle error responses
                        if (parsed.status === 'error' || parsed.error) {
                            const errorMsg = parsed.error?.code || parsed.error || parsed.text || 'Cobalt API error';
                            reject(new Error(errorMsg));
                            return;
                        }

                        // Handle different response formats
                        if (parsed.status === 'tunnel' || parsed.status === 'redirect' || parsed.status === 'stream') {
                            resolve({ url: parsed.url, filename: parsed.filename });
                        } else if (parsed.status === 'picker' && parsed.picker?.length > 0) {
                            // Multiple options available, pick video
                            const videoOption = parsed.picker.find(p => p.type === 'video') || parsed.picker[0];
                            if (videoOption?.url) {
                                resolve({ url: videoOption.url, filename: videoOption.filename });
                            } else {
                                reject(new Error('No video found in picker response'));
                            }
                        } else if (parsed.url) {
                            // Direct URL response
                            resolve({ url: parsed.url, filename: parsed.filename });
                        } else {
                            reject(new Error(`Unexpected response: ${parsed.status || 'unknown'}`));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Connection error: ${err.message}`));
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.write(requestBody);
            req.end();
        });
    }

    _downloadFile(url, outputPath) {
        return new Promise((resolve, reject) => {
            let redirectCount = 0;
            const maxRedirects = 10;
            let totalBytes = 0;
            let downloadedBytes = 0;
            let lastProgressUpdate = 0;
            const progressUpdateInterval = 500; // Update every 500ms
            const startTime = Date.now();

            const download = (downloadUrl) => {
                if (redirectCount >= maxRedirects) {
                    reject(new Error('Too many redirects'));
                    return;
                }

                const urlObj = new URL(downloadUrl);
                const isHttps = urlObj.protocol === 'https:';
                const protocol = isHttps ? https : http;
                
                const options = {
                    hostname: urlObj.hostname,
                    port: urlObj.port || (isHttps ? 443 : 80),
                    path: urlObj.pathname + urlObj.search,
                    method: 'GET',
                    headers: {
                        'User-Agent': videoConfig.USER_AGENT
                    },
                    timeout: videoConfig.DOWNLOAD_TIMEOUT
                };

                const req = protocol.request(options, (response) => {
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        redirectCount++;
                        let newUrl = response.headers.location;
                        if (!newUrl.startsWith('http')) {
                            newUrl = `${urlObj.protocol}//${urlObj.host}${newUrl}`;
                        }
                        download(newUrl);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }

                    // Get content length for progress tracking
                    totalBytes = parseInt(response.headers['content-length'], 10) || 0;

                    const file = fs.createWriteStream(outputPath);
                    
                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        
                        // Emit progress updates at intervals
                        const now = Date.now();
                        if (now - lastProgressUpdate >= progressUpdateInterval) {
                            const elapsed = (now - startTime) / 1000;
                            const speed = downloadedBytes / elapsed;
                            const percent = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
                            const eta = totalBytes > 0 && speed > 0 ? (totalBytes - downloadedBytes) / speed : 0;
                            
                            this.emit('progress', {
                                downloaded: downloadedBytes,
                                total: totalBytes,
                                percent: Math.min(percent, 100),
                                speed,
                                eta
                            });
                            lastProgressUpdate = now;
                        }
                    });
                    
                    response.pipe(file);

                    file.on('finish', () => {
                        file.close();
                        
                        // Emit final progress
                        this.emit('progress', {
                            downloaded: downloadedBytes,
                            total: downloadedBytes,
                            percent: 100,
                            speed: 0,
                            eta: 0
                        });
                        
                        console.log(`✅ Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
                        resolve();
                    });

                    file.on('error', (err) => {
                        fs.unlink(outputPath, () => {});
                        reject(err);
                    });
                });

                req.on('error', (err) => {
                    fs.unlink(outputPath, () => {});
                    reject(err);
                });

                req.on('timeout', () => {
                    req.destroy();
                    fs.unlink(outputPath, () => {});
                    reject(new Error('Download timeout'));
                });

                req.end();
            };

            download(url);
        });
    }

    async getVideoInfo(url) {
        return this._requestDownload(url);
    }
}

module.exports = new CobaltService();
