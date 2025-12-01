const { Client, GatewayIntentBits, Partials } = require('discord.js');

const DEFAULT_INTENTS = [
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages
];

const DEFAULT_PARTIALS = [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember
];

const CLIENT_OPTIONS = {
    intents: DEFAULT_INTENTS,
    partials: DEFAULT_PARTIALS,
    rest: {
        timeout: 60000
    },
    retryLimit: 3,
    failIfNotExists: false,
    presence: {
        status: 'online',
        activities: [{
            name: 'with Fumos | .help',
            type: 0
        }]
    }
};

function createClient(customOptions = {}) {
    const options = {
        ...CLIENT_OPTIONS,
        ...customOptions,
        intents: customOptions.intents || DEFAULT_INTENTS,
        partials: customOptions.partials || DEFAULT_PARTIALS
    };

    const client = new Client(options);
    client.setMaxListeners(150);
    
    return client;
}

function createMinimalClient() {
    return createClient({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages
        ],
        partials: [Partials.Message]
    });
}

function createAdminClient() {
    return createClient({
        intents: [
            ...DEFAULT_INTENTS,
            GatewayIntentBits.GuildBans,
            GatewayIntentBits.GuildModeration,
            GatewayIntentBits.GuildPresences
        ]
    });
}

function setPresence(client, status = 'online', activityName = 'with Fumos', activityType = 0) {
    if (!client.user) return;
    
    client.user.setPresence({
        status,
        activities: [{
            name: activityName,
            type: activityType
        }]
    });
}

const ActivityType = {
    PLAYING: 0,
    STREAMING: 1,
    LISTENING: 2,
    WATCHING: 3,
    COMPETING: 5
};

const StatusType = {
    ONLINE: 'online',
    IDLE: 'idle',
    DND: 'dnd',
    INVISIBLE: 'invisible'
};

module.exports = {
    createClient,
    createMinimalClient,
    createAdminClient,
    
    DEFAULT_INTENTS,
    DEFAULT_PARTIALS,
    CLIENT_OPTIONS,
    
    setPresence,
    
    ActivityType,
    StatusType,
    
    Client,
    GatewayIntentBits,
    Partials
};