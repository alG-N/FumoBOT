module.exports = {
    nodes: [
        {
            id: 'main-node',
            host: 'localhost',
            port: 2333,
            password: 'youshallnotpass',
            secure: false  // Important: false for http://
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