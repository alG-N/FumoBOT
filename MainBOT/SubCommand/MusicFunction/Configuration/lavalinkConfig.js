module.exports = {
    nodes: [
        {
            host: 'localhost',
            port: 2333,
            password: 'youshallnotpass',
            secure: false,
            retryAmount: 5,
            retryDelay: 3000
        }
    ],
    clientName: 'MusicBot',
    defaultSearchPlatform: 'ytsearch',
    playerOptions: {
        volume: 100,
        selfDeafen: true,
        selfMute: false
    }
};