module.exports = {
    nodes: [
        {
            name: 'main-node',
            url: 'localhost:2333',
            auth: 'youshallnotpass',
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