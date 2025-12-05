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
    },
    shoukakuOptions: {
        resume: false,
        resumeTimeout: 30,
        resumeByLibrary: false,
        reconnectTries: 3,
        reconnectInterval: 5,
        restTimeout: 60,
        moveOnDisconnect: false,
        userAgent: 'MusicBot/1.0',
        structures: {}
    }
};