module.exports = {
    nodes: [
        {
            name: 'main-node',
            url: 'localhost:2333',  // ← Remove 'http://' prefix
            auth: 'youshallnotpass',
            secure: false  // false = http, true = https
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