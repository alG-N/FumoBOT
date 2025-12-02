/**
 * Music Bot Configuration
 * Centralized configuration for Lavalink and music features
 */

module.exports = {
    // Lavalink connection settings
    lavalink: {
        nodes: [
            {
                id: 'main',
                host: process.env.LAVALINK_HOST || 'localhost',
                port: parseInt(process.env.LAVALINK_PORT) || 2333,
                password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
                secure: process.env.LAVALINK_SECURE === 'true' || false,
                retryAmount: 5,
                retryDelay: 3000,
            }
        ],
        defaultSearchPlatform: 'ytsearch',
        playlistLimit: 100,
    },

    // Player settings
    player: {
        defaultVolume: 100,
        maxVolume: 200,
        minVolume: 0,
        volumeStep: 10,
        inactivityTimeout: 2 * 60 * 1000, // 2 minutes
        maxQueueSize: 1000,
        maxTrackDuration: 2 * 60 * 60, // 2 hours in seconds
    },

    // Search settings
    search: {
        maxResults: 15,
        rankingWeights: {
            wordMatch: 2000,
            exactMatch: 500,
            startsWith: 800,
            views: 0.5,
            highViews: 1000,
            mediumViews: 500,
            official: 600,
            officialContent: 400,
            goodDuration: 200,
            okDuration: 100,
            spamPenalty: 1500,
            compilationPenalty: 2000,
            longVideoPenalty: 1000,
            shortVideoPenalty: 500,
        },
        spamKeywords: [
            'top 10', 'top 15', 'top 20', 'top 30', 'compilation',
            'playlist', 'mix', 'megamix', 'mashup', 'collection',
            'reaction', 'reacts', 'review', 'cover', 'acoustic',
            'nightcore', 'slowed', 'reverb', 'speed up', 'bass boost',
            'lyrics', 'lyric video', 'tutorial', 'lesson', 'how to',
            'live', 'concert', 'performance'
        ],
    },

    // Skip voting settings
    voting: {
        minUsersForVote: 3,
        requiredVotes: 2,
        votingTimeout: 15000, // 15 seconds
    },

    // Embed colors
    colors: {
        primary: 0x00C2FF,
        success: 0x6EE7B7,
        warning: 0xFBBF24,
        error: 0xEF4444,
        loop: 0xF472B6,
    },

    // Logging
    logging: {
        channelId: process.env.LOG_CHANNEL_ID || '1411386693499486429',
        enabled: process.env.ENABLE_LOGGING !== 'false',
    },
};