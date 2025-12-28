module.exports = {
    // Download method settings
    USE_COBALT: true,           // Use self-hosted Cobalt API (primary)
    USE_YTDLP_FALLBACK: true,   // Fall back to yt-dlp if Cobalt fails
    
    // Self-hosted Cobalt instance (Docker)
    COBALT_INSTANCES: [
        'http://localhost:9000'  // Your local Docker Cobalt instance
    ],
    
    // Cobalt quality settings (helps avoid needing compression)
    COBALT_VIDEO_QUALITY: '480',  // 144, 240, 360, 480, 720, 1080, 1440, 2160, max
    COBALT_AUDIO_BITRATE: '128',  // 64, 96, 128, 192, 256, 320
    
    MAX_FILE_SIZE_MB: 50,       // Increased - Discord Nitro limit (or 25 for free)
    TARGET_COMPRESSION_MB: 24,  // Target size after compression
    TEMP_FILE_CLEANUP_INTERVAL: 5 * 60 * 1000,
    TEMP_FILE_MAX_AGE: 15 * 60 * 1000,
    DOWNLOAD_TIMEOUT: 60000,
    MAX_RETRIES: 5,
    FRAGMENT_RETRIES: 5,
    BUFFER_SIZE: '4M',
    CONCURRENT_FRAGMENTS: 8,
    FFMPEG_PRESET: 'veryfast',
    FFMPEG_CRF: '26',
    AUDIO_BITRATE: '128k',
    VIDEO_BITRATE: '1500k',
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};