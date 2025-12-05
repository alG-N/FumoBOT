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
    defaultSearchPlatform: 'scsearch',
    playerOptions: {
        volume: 100,
        selfDeafen: true,
        selfMute: false
    },
    shoukakuOptions: {
        resume: false,
        resumeTimeout: 30,
        resumeByLibrary: false,
        reconnectTries: 5,
        reconnectInterval: 5000,
        restTimeout: 60000,
        moveOnDisconnect: false,
        userAgent: 'MusicBot/1.0'
    }
};