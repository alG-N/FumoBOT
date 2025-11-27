const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');

let ffmpegPath = 'ffmpeg';
let ffprobePath = 'ffprobe';
let ffmpegAvailable = false;

const ffmpegDir = path.join(__dirname, 'ffmpeg-bin');
const localFfmpegPath = path.join(ffmpegDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const localFfprobePath = path.join(ffmpegDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');

try {
    ffmpegPath = require('ffmpeg-static');
    ffmpegAvailable = true;
    console.log('✅ ffmpeg-static found');
} catch (e) {
    if (fs.existsSync(localFfmpegPath)) {
        ffmpegPath = localFfmpegPath;
        ffmpegAvailable = true;
        console.log('✅ Using local ffmpeg binary');
    }
}

try {
    const ffprobeStatic = require('ffprobe-static');
    ffprobePath = ffprobeStatic.path;
    console.log('✅ ffprobe-static found');
} catch (e) {
    if (fs.existsSync(localFfprobePath)) {
        ffprobePath = localFfprobePath;
        console.log('✅ Using local ffprobe binary');
    }
}

async function downloadFfmpeg() {
    if (ffmpegAvailable) return true;
    
    if (process.platform !== 'win32') {
        console.log('⚠️ Auto-download only supports Windows. Install with: npm install ffmpeg-static ffprobe-static');
        return false;
    }

    console.log('📥 Downloading ffmpeg binaries from GitHub...');
    console.log('   This is a one-time download (~100MB), please wait...');
    
    if (!fs.existsSync(ffmpegDir)) {
        fs.mkdirSync(ffmpegDir, { recursive: true });
    }

    try {
        let AdmZip;
        try {
            AdmZip = require('adm-zip');
        } catch (e) {
            console.error('❌ adm-zip not installed. Run: npm install adm-zip');
            return false;
        }

        const ffmpegUrl = 'https://github.com/GyanD/codexffmpeg/releases/download/7.1/ffmpeg-7.1-essentials_build.zip';
        const zipPath = path.join(ffmpegDir, 'ffmpeg.zip');
        
        let downloadedBytes = 0;
        
        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(zipPath);
            
            https.get(ffmpegUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    https.get(response.headers.location, (redirectResponse) => {
                        redirectResponse.on('data', (chunk) => {
                            downloadedBytes += chunk.length;
                            if (downloadedBytes % (10 * 1024 * 1024) < chunk.length) {
                                console.log(`   Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
                            }
                        });
                        redirectResponse.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            console.log(`   Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
                            resolve();
                        });
                    }).on('error', reject);
                } else {
                    response.on('data', (chunk) => {
                        downloadedBytes += chunk.length;
                        if (downloadedBytes % (10 * 1024 * 1024) < chunk.length) {
                            console.log(`   Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
                        }
                    });
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`   Download complete: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB`);
                        resolve();
                    });
                }
            }).on('error', (err) => {
                file.close();
                reject(err);
            });
            
            file.on('error', (err) => {
                fs.unlinkSync(zipPath);
                reject(err);
            });
        });

        console.log('📦 Extracting ffmpeg binaries...');
        
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();
        
        let foundFfmpeg = false;
        let foundFfprobe = false;
        
        zipEntries.forEach(entry => {
            if (entry.entryName.includes('bin/ffmpeg.exe')) {
                zip.extractEntryTo(entry, ffmpegDir, false, true);
                fs.renameSync(path.join(ffmpegDir, 'ffmpeg.exe'), localFfmpegPath);
                foundFfmpeg = true;
                console.log('   ✓ ffmpeg.exe extracted');
            }
            if (entry.entryName.includes('bin/ffprobe.exe')) {
                zip.extractEntryTo(entry, ffmpegDir, false, true);
                fs.renameSync(path.join(ffmpegDir, 'ffprobe.exe'), localFfprobePath);
                foundFfprobe = true;
                console.log('   ✓ ffprobe.exe extracted');
            }
        });

        fs.unlinkSync(zipPath);
        
        if (foundFfmpeg && foundFfprobe) {
            ffmpegPath = localFfmpegPath;
            ffprobePath = localFfprobePath;
            ffmpegAvailable = true;
            
            console.log('✅ ffmpeg setup complete! Video compression enabled.');
            return true;
        } else {
            console.error('❌ Could not find ffmpeg/ffprobe in downloaded zip');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to download ffmpeg:', error.message);
        console.log('   Manual install: npm install ffmpeg-static ffprobe-static');
        return false;
    }
}

if (!ffmpegAvailable) {
    console.log('⚠️ ffmpeg not detected, attempting auto-download...');
    downloadFfmpeg().then(success => {
        if (success) {
            console.log('🎉 Video compression ready!');
        } else {
            console.log('⚠️ Videos will not be compressed (manual install: npm install ffmpeg-static ffprobe-static)');
        }
    }).catch(err => {
        console.error('❌ Auto-download failed:', err.message);
        console.log('   Install manually: npm install ffmpeg-static ffprobe-static');
    });
} else {
    console.log('🎉 Video compression ready!');
}

const ytDlpDir = path.join(__dirname, 'yt-dlp-bin');
const ytDlpBinary = path.join(ytDlpDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

async function ensureYtDlp() {
    if (fs.existsSync(ytDlpBinary)) {
        const stats = fs.statSync(ytDlpBinary);
        if (stats.size > 1000000) {
            return true;
        } else {
            fs.unlinkSync(ytDlpBinary);
        }
    }

    console.log('📥 Downloading yt-dlp binary from GitHub...');

    if (!fs.existsSync(ytDlpDir)) {
        fs.mkdirSync(ytDlpDir, { recursive: true });
    }

    const downloadUrl = process.platform === 'win32'
        ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
        : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        let redirectCount = 0;
        const maxRedirects = 5;

        function downloadFile(url) {
            if (redirectCount >= maxRedirects) {
                reject(new Error('Too many redirects'));
                return;
            }

            const file = fs.createWriteStream(ytDlpBinary);
            
            https.get(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            }, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
                    redirectCount++;
                    file.close();
                    if (fs.existsSync(ytDlpBinary)) {
                        fs.unlinkSync(ytDlpBinary);
                    }
                    downloadFile(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    file.close();
                    if (fs.existsSync(ytDlpBinary)) {
                        fs.unlinkSync(ytDlpBinary);
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
                    
                    const stats = fs.statSync(ytDlpBinary);
                    if (stats.size < 1000000) {
                        fs.unlinkSync(ytDlpBinary);
                        reject(new Error(`Downloaded file is too small (${stats.size} bytes)`));
                        return;
                    }
                    
                    if (process.platform !== 'win32') {
                        fs.chmodSync(ytDlpBinary, '755');
                    }
                    resolve(true);
                });
                
                file.on('error', (err) => {
                    if (fs.existsSync(ytDlpBinary)) {
                        fs.unlinkSync(ytDlpBinary);
                    }
                    reject(err);
                });
            }).on('error', (err) => {
                file.close();
                if (fs.existsSync(ytDlpBinary)) {
                    fs.unlinkSync(ytDlpBinary);
                }
                reject(err);
            });
        }

        downloadFile(downloadUrl);
    });
}

async function updateYtDlp() {
    if (!fs.existsSync(ytDlpBinary)) return false;
    
    console.log('🔄 Checking for yt-dlp updates...');
    
    try {
        const updateProcess = spawn(ytDlpBinary, ['-U'], { 
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

ensureYtDlp()
    .then(() => updateYtDlp())
    .catch(err => console.error('❌ Failed to setup yt-dlp:', err));

async function compressVideo(inputPath, maxSizeMB = 8) {
    if (!ffmpegAvailable) {
        return inputPath;
    }

    const stats = fs.statSync(inputPath);
    const currentSizeMB = stats.size / (1024 * 1024);

    if (currentSizeMB <= maxSizeMB) {
        return inputPath;
    }

    const outputPath = inputPath.replace(/\.[^.]+$/, '_compressed.mp4');
    
    try {
        console.log(`🔄 Compressing video from ${currentSizeMB.toFixed(2)}MB to ~${maxSizeMB}MB...`);

        const durationProcess = spawn(ffprobePath, [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            inputPath
        ], { 
            windowsHide: true,
            stdio: 'pipe'
        });

        let duration = 0;
        durationProcess.stdout.on('data', (data) => {
            duration = parseFloat(data.toString().trim());
        });

        await new Promise((resolve) => {
            durationProcess.on('close', resolve);
        });

        if (!duration || duration <= 0) {
            duration = 30;
        }

        const targetBitrate = Math.floor((maxSizeMB * 8192) / duration * 0.8);

        await new Promise((resolve, reject) => {
            const ffmpegProcess = spawn(ffmpegPath, [
                '-i', inputPath,
                '-c:v', 'libx264',
                '-b:v', `${targetBitrate}k`,
                '-maxrate', `${targetBitrate}k`,
                '-bufsize', `${targetBitrate * 2}k`,
                '-c:a', 'aac',
                '-b:a', '96k',
                '-movflags', '+faststart',
                '-preset', 'ultrafast',
                '-y',
                outputPath
            ], { 
                windowsHide: true,
                stdio: 'pipe'
            });

            ffmpegProcess.on('close', (code) => {
                if (code === 0 && fs.existsSync(outputPath)) {
                    fs.unlinkSync(inputPath);
                    console.log('✅ Video compressed successfully');
                    resolve();
                } else {
                    reject(new Error('Compression failed'));
                }
            });

            ffmpegProcess.on('error', reject);
        });

        return outputPath;
    } catch (error) {
        console.error('⚠️ Compression failed, using original:', error.message);
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
        return inputPath;
    }
}

function detectPlatform(url) {
    if (url.includes('tiktok.com')) return '🎵 TikTok';
    if (url.includes('twitter.com') || url.includes('x.com')) return '𝕏 Twitter/X';
    if (url.includes('instagram.com')) return '📷 Instagram';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return '▶️ YouTube';
    if (url.includes('reddit.com')) return '🤖 Reddit';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return '📘 Facebook';
    if (url.includes('twitch.tv')) return '🎮 Twitch';
    if (url.includes('vimeo.com')) return '🎬 Vimeo';
    return '🌐 Web';
}

async function downloadVideoWithYTDLP(url) {
    const timestamp = Date.now();
    const outputTemplate = path.join(__dirname, 'temp', `video_${timestamp}.%(ext)s`);
    
    try {
        await ensureYtDlp();

        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
        }

        await new Promise((resolve, reject) => {
            const args = [
                url,
                '-f', 'b[filesize<15M]/bv*[height<=720]+ba/bv*+ba/b',
                '--merge-output-format', 'mp4',
                '--max-filesize', '25M',
                '--no-playlist',
                '-o', outputTemplate,
                '--no-warnings',
                '--quiet',
                '--progress',
                '--newline',
                // Speed optimizations
                '--concurrent-fragments', '4', // Download 4 fragments at once
                '--buffer-size', '16K',
                '--http-chunk-size', '10M',
                // Platform-specific fixes
                '--extractor-args', 'youtube:player_client=android,web',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];

            const process = spawn(ytDlpBinary, args, {
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

        const tempDir = path.join(__dirname, 'temp');
        const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`video_${timestamp}`));

        if (files.length === 0) {
            return { error: 'No video downloaded. The video might be unavailable, private, or geo-restricted.' };
        }

        const actualPath = path.join(tempDir, files[0]);

        if (!fs.existsSync(actualPath)) {
            return { error: 'Video file not found after download.' };
        }

        const stats = fs.statSync(actualPath);
        const fileSizeInMB = stats.size / (1024 * 1024);

        if (fileSizeInMB > 25) {
            fs.unlinkSync(actualPath);
            return { error: `Video is too large (${fileSizeInMB.toFixed(2)}MB). Discord has a 25MB limit. Try a shorter video.` };
        }

        if (fileSizeInMB === 0) {
            fs.unlinkSync(actualPath);
            return { error: 'Downloaded file is empty.' };
        }

        const finalPath = await compressVideo(actualPath, 8);
        const finalStats = fs.statSync(finalPath);
        const finalSizeMB = finalStats.size / (1024 * 1024);

        const extension = path.extname(finalPath).toLowerCase();
        const format = extension === '.webm' ? 'WebM' : extension === '.mp4' ? 'MP4' : extension.toUpperCase();

        return { path: finalPath, size: finalSizeMB, format };
    } catch (error) {
        console.error('❌ Download error:', error.message);
        
        const tempDir = path.join(__dirname, 'temp');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir).filter(f => f.startsWith(`video_${timestamp}`));
            files.forEach(file => {
                try {
                    fs.unlinkSync(path.join(tempDir, file));
                } catch (e) {}
            });
        }
        
        return { error: 'Failed to download video. The link might be invalid, private, or the video source is not supported.' };
    }
}

function cleanupTempFiles() {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) return;

    try {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        const maxAge = 15 * 60 * 1000;

        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            
            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

setInterval(cleanupTempFiles, 5 * 60 * 1000);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('video')
        .setDescription('Download videos from social media platforms')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Video URL (TikTok, Reddit, Twitter, Instagram, YouTube, etc.)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const url = interaction.options.getString('url');
        const platform = detectPlatform(url);

        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Invalid URL')
                .setDescription('Please provide a valid URL starting with `http://` or `https://`')
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        const loadingEmbed = new EmbedBuilder()
            .setTitle('🎬 Downloading Video...')
            .setDescription(`**Platform:** ${platform}\n\n⏳ Please wait, this may take a moment...`)
            .setColor('#3498DB')
            .setTimestamp();

        await interaction.editReply({ embeds: [loadingEmbed] });

        const result = await downloadVideoWithYTDLP(url);

        if (result.error) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Download Failed')
                .setDescription(result.error)
                .setColor('#FF0000')
                .setFooter({ text: 'Make sure the video is public and available' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
            return;
        }

        try {
            await interaction.editReply({ 
                content: `✅ Your video is ready! **(${result.size.toFixed(2)} MB)**`,
                embeds: [],
                files: [{
                    attachment: result.path,
                    name: `video${path.extname(result.path)}`
                }]
            });

            setTimeout(() => {
                if (fs.existsSync(result.path)) {
                    fs.unlinkSync(result.path);
                }
            }, 5000);

        } catch (error) {
            console.error('❌ Upload error:', error.message);

            if (fs.existsSync(result.path)) {
                fs.unlinkSync(result.path);
            }

            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Upload Failed')
                .setDescription('Failed to upload to Discord. The file might be corrupted or Discord is having issues.')
                .setColor('#FF0000')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};