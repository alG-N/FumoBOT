module.exports = {
    // Download Method Settings (Cobalt Only)
    COBALT_INSTANCES: [
        'http://localhost:9000'
    ],

    // Quality Settings
    COBALT_VIDEO_QUALITY: '720',     // 720p for good balance of quality/size

    // yt-dlp Quality Settings (fallback downloader)
    YTDLP_VIDEO_QUALITY: '720',      // Max video height for yt-dlp
    YTDLP_AUDIO_QUALITY: '192',      // Audio bitrate for yt-dlp

    // Mobile Compatibility Settings
    // Converts videos to H.264+AAC for proper playback on phones
    // Without this, some videos show only thumbnail on mobile devices
    ENABLE_MOBILE_PROCESSING: true,  // Enable FFmpeg re-encoding for mobile
    MOBILE_VIDEO_CODEC: 'libx264',   // H.264 codec (universal support)
    MOBILE_AUDIO_CODEC: 'aac',       // AAC audio codec
    MOBILE_CRF: '23',                // Quality (18-28, lower = better)
    MOBILE_PRESET: 'fast',           // Encoding speed (ultrafast, fast, medium, slow)

    // File Size Settings
    MAX_FILE_SIZE_MB: 500,            // Max file size (for boosted servers)

    // Duration & Abuse Prevention
    MAX_VIDEO_DURATION_SECONDS: 600, // 10 minutes max
    MAX_CONCURRENT_DOWNLOADS: 3,
    USER_COOLDOWN_SECONDS: 30,

    // Cleanup Settings
    TEMP_FILE_CLEANUP_INTERVAL: 5 * 60 * 1000,
    TEMP_FILE_MAX_AGE: 15 * 60 * 1000,
    FILE_DELETE_DELAY: 5000,

    // Network Settings
    DOWNLOAD_TIMEOUT: 120000,         // Increased from 60s to 120s for larger files
    MAX_RETRIES: 5,
    FRAGMENT_RETRIES: 5,
    BUFFER_SIZE: '8M',               // Increased from 4M to 8M
    CONCURRENT_FRAGMENTS: 8,

    // UI Settings
    UI: {
        PROGRESS_UPDATE_INTERVAL: 1500,
        PROGRESS_BAR_STYLE: 'default',
        SHOW_DOWNLOAD_SPEED: true,
        SHOW_ETA: true,
        SHOW_FILE_SIZE: true,
        ANIMATION_ENABLED: true,
    },

    // Messages
    MESSAGES: {
        DOWNLOAD_TIP: ' *Tip: Lower quality = faster download & smaller file size*',
        SUCCESS_TIP: '> *Video will be attached below* ',
    },

    // User Agent
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
