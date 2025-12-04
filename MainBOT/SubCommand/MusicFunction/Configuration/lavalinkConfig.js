module.exports = {
    nodes: [
        {
            id: 'main-node',
            host: 'localhost',
            port: 2333,
            password: 'youshallnotpass',
            secure: false
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