module.exports = {
    // ═══════════════════════════════════════════════════
    // Download Method Settings (Cobalt Only)
    // ═══════════════════════════════════════════════════
    
    // Self-hosted Cobalt instance (Docker)
    COBALT_INSTANCES: [
        'http://localhost:9000'  // Your local Docker Cobalt instance
    ],
    
    // ═══════════════════════════════════════════════════
    // Quality Settings
    // ═══════════════════════════════════════════════════
    COBALT_VIDEO_QUALITY: '480',  // 144, 240, 360, 480, 720, 1080, 1440, 2160, max
    COBALT_AUDIO_BITRATE: '128',  // 64, 96, 128, 192, 256, 320
    
    // ═══════════════════════════════════════════════════
    // File Size Settings
    // ═══════════════════════════════════════════════════
    MAX_FILE_SIZE_MB: 50,       // Increased - Discord Nitro limit (or 25 for free)
    TARGET_COMPRESSION_MB: 24,  // Target size after compression
    
    // ═══════════════════════════════════════════════════
    // Duration & Abuse Prevention Settings
    // ═══════════════════════════════════════════════════
    MAX_VIDEO_DURATION_SECONDS: 300,  // 5 minutes max - prevents hour-long video abuse
    MAX_CONCURRENT_DOWNLOADS: 3,      // Max simultaneous downloads across all users
    USER_COOLDOWN_SECONDS: 30,        // Per-user cooldown between downloads
    
    // ═══════════════════════════════════════════════════
    // Cleanup Settings
    // ═══════════════════════════════════════════════════
    TEMP_FILE_CLEANUP_INTERVAL: 5 * 60 * 1000,  // 5 minutes
    TEMP_FILE_MAX_AGE: 15 * 60 * 1000,          // 15 minutes
    FILE_DELETE_DELAY: 5000,                     // Delay before deleting uploaded files
    
    // ═══════════════════════════════════════════════════
    // Network Settings
    // ═══════════════════════════════════════════════════
    DOWNLOAD_TIMEOUT: 60000,    // 60 seconds
    MAX_RETRIES: 5,
    FRAGMENT_RETRIES: 5,
    BUFFER_SIZE: '4M',
    CONCURRENT_FRAGMENTS: 8,
    
    // ═══════════════════════════════════════════════════
    // FFmpeg Compression Settings
    // ═══════════════════════════════════════════════════
    FFMPEG_PRESET: 'veryfast',  // ultrafast, superfast, veryfast, faster, fast, medium
    FFMPEG_CRF: '26',           // 18-28 (lower = better quality, larger file)
    AUDIO_BITRATE: '128k',
    VIDEO_BITRATE: '1500k',
    
    // ═══════════════════════════════════════════════════
    // UI Settings
    // ═══════════════════════════════════════════════════
    UI: {
        PROGRESS_UPDATE_INTERVAL: 1500,  // Update progress embed every 1.5 seconds
        PROGRESS_BAR_STYLE: 'default',   // default, modern, blocks, circles, squares
        SHOW_DOWNLOAD_SPEED: true,       // Show download speed in progress
        SHOW_ETA: true,                  // Show estimated time remaining
        SHOW_FILE_SIZE: true,            // Show downloaded/total size
        ANIMATION_ENABLED: true,         // Enable animated status indicators
    },
    
    // ═══════════════════════════════════════════════════
    // Messages
    // ═══════════════════════════════════════════════════
    MESSAGES: {
        DOWNLOAD_TIP: '💡 *Tip: Use `/video method:link` for direct links (faster but may expire)*',
        COMPRESSION_TIP: '📦 *Video is being compressed to fit Discord\'s file limit*',
        SUCCESS_TIP: '> *Video will be attached below* ⬇️',
    },
    
    // ═══════════════════════════════════════════════════
    // User Agent
    // ═══════════════════════════════════════════════════
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};