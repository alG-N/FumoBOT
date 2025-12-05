module.exports = {
    MAX_FILE_SIZE_MB: 25,
    TARGET_COMPRESSION_MB: 8,
    TEMP_FILE_CLEANUP_INTERVAL: 5 * 60 * 1000,
    TEMP_FILE_MAX_AGE: 15 * 60 * 1000,
    DOWNLOAD_TIMEOUT: 60000,
    MAX_RETRIES: 10,
    FRAGMENT_RETRIES: 10,
    BUFFER_SIZE: '16K',
    FFMPEG_PRESET: 'ultrafast',
    AUDIO_BITRATE: '96k',
    USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};