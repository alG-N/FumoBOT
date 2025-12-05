class QueueRepository {
    constructor() {
        this.queues = new Map();
    }

    getOrCreate(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                tracks: [],
                currentTrack: null,
                nowMessage: null,
                loop: false,
                skipVotes: new Set(),
                skipVoting: false,
                skipVotingTimeout: null,
                skipVotingMsg: null,
                inactivityTimer: null,
                _vcMonitor: null,
                _eventsBound: false
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