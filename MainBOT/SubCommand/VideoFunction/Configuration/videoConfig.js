module.exports = {
    // Download Method Settings (Cobalt Only)
    COBALT_INSTANCES: [
        'http://localhost:9000'
    ],
    
    // Quality Settings
    COBALT_VIDEO_QUALITY: '480',
    COBALT_AUDIO_BITRATE: '128',
    
    // File Size Settings
    MAX_FILE_SIZE_MB: 50,
    TARGET_COMPRESSION_MB: 24,
    
    // Duration & Abuse Prevention
    MAX_VIDEO_DURATION_SECONDS: 300,
    MAX_CONCURRENT_DOWNLOADS: 3,
    USER_COOLDOWN_SECONDS: 30,
    
    // Cleanup Settings
    TEMP_FILE_CLEANUP_INTERVAL: 5 * 60 * 1000,
    TEMP_FILE_MAX_AGE: 15 * 60 * 1000,
    FILE_DELETE_DELAY: 5000,
    
    // Network Settings
    DOWNLOAD_TIMEOUT: 60000,
    MAX_RETRIES: 5,
    FRAGMENT_RETRIES: 5,
    BUFFER_SIZE: '4M',
    CONCURRENT_FRAGMENTS: 8,
    
    // FFmpeg Compression Settings
    FFMPEG_PRESET: 'veryfast',
    FFMPEG_CRF: '26',
    AUDIO_BITRATE: '128k',
    VIDEO_BITRATE: '1500k',
    
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
        DOWNLOAD_TIP: '💡 *Tip: Use `/video method:link` for direct links (faster but may expire)*',
        COMPRESSION_TIP: '📦 *Video is being compressed to fit Discord\'s file limit*',
        SUCCESS_TIP: '> *Video will be attached below* ⬇️',
    },
    
    // User Agent
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};