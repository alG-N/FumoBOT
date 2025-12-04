const { createAudioPlayer } = require("@discordjs/voice");
const { DEFAULT_VOLUME } = require('../Configuration/MusicConfig');

class QueueRepository {
    constructor() {
        this.queues = new Map();
    }

    getOrCreate(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                connection: null,
                player: createAudioPlayer(),
                volume: DEFAULT_VOLUME,
                nowMessage: null,
                current: null,
                tracks: [],
                loop: false,
                startTime: null,
                elapsed: 0,
                _eventsBound: false,
                _collectorBound: false,
                skipVotes: new Set(),
                skipVoting: false,
                skipVotingTimeout: null,
                skipVotingMsg: null,
                inactivityTimer: null,
                currentYtdlpProcess: null,
                _vcMonitor: null
            });
        }
        return this.queues.get(guildId);
    }

    get(guildId) {
        return this.queues.get(guildId);
    }

    has(guildId) {
        return this.queues.has(guildId);
    }

    delete(guildId) {
        return this.queues.delete(guildId);
    }

    clear() {
        this.queues.clear();
    }

    getAllQueues() {
        return this.queues;
    }
}

module.exports = new QueueRepository();