module.exports = {
    // Timeouts
    INACTIVITY_TIMEOUT: 3 * 60 * 1000,       // 3 minutes before auto-leave
    VC_CHECK_INTERVAL: 60_000,                // 1 minute VC monitoring interval
    SKIP_VOTE_TIMEOUT: 15000,                 // 15 seconds for vote skip
    COLLECTOR_TIMEOUT: 7 * 24 * 60 * 60 * 1000, // 7 days for button collectors
    CONFIRMATION_TIMEOUT: 20000,              // 20 seconds for confirmations
    TRACK_TRANSITION_DELAY: 2500,             // 2.5 seconds between tracks

    // Voting
    MIN_VOTES_REQUIRED: 5,                    // Minimum listeners for vote skip (below this, anyone can skip)

    // Track limits
    MAX_TRACK_DURATION: 600,                  // 10 minutes default max
    MAX_QUEUE_SIZE: 100,                      // Maximum queue size
    MAX_PLAYLIST_SIZE: 50,                    // Maximum playlist tracks to add

    // Volume
    VOLUME_STEP: 10,
    MIN_VOLUME: 0,
    MAX_VOLUME: 200,
    DEFAULT_VOLUME: 80,  // Reduced from 100 to prevent distortion

    // Logging
    LOG_CHANNEL_ID: "1411386693499486429",

    // Pagination
    TRACKS_PER_PAGE: 10,
    HISTORY_MAX_SIZE: 100,
    FAVORITES_MAX_SIZE: 200,
    RECENTLY_PLAYED_MAX: 50,

    // Cache durations
    SESSION_DURATION: 60 * 60 * 1000,         // 1 hour
    PLAYLIST_CACHE_DURATION: 30 * 60 * 1000,  // 30 minutes

    // Colors for embeds
    COLORS: {
        playing: '#00FF00',
        paused: '#FFD700',
        stopped: '#FF0000',
        queued: '#9400D3',
        info: '#3498DB',
        error: '#E74C3C',
        warning: '#F39C12',
        success: '#2ECC71'
    },

    // Emojis
    LOOP_EMOJIS: {
        off: '➡️',
        track: '🔂',
        queue: '🔁'
    },

    SOURCE_EMOJIS: {
        youtube: '🎵',
        soundcloud: '☁️',
        spotify: '💚',
        unknown: '🎶'
    }
};