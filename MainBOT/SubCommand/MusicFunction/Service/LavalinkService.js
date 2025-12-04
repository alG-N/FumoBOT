const { Manager } = require('erela.js');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.manager = null;
        this.client = null;
    }

    initialize(client) {
        this.client = client;
        
        this.manager = new Manager({
            nodes: lavalinkConfig.nodes,
            send: (id, payload) => {
                const guild = client.guilds.cache.get(id);
                if (guild) guild.shard.send(payload);
            },
            autoPlay: true,
            clientName: lavalinkConfig.clientName
        });

        this.manager.on('nodeConnect', node => {
            console.log(`[Lavalink] Node ${node.options.identifier} connected`);
        });

        this.manager.on('nodeError', (node, error) => {
            console.error(`[Lavalink] Node ${node.options.identifier} error:`, error.message);
        });

        this.manager.on('nodeDisconnect', (node, reason) => {
            console.log(`[Lavalink] Node ${node.options.identifier} disconnected:`, reason);
        });

        this.manager.on('trackStart', (player, track) => {
            console.log(`[Lavalink] Track started: ${track.title}`);
        });

        this.manager.on('trackEnd', (player, track) => {
            console.log(`[Lavalink] Track ended: ${track.title}`);
        });

        this.manager.on('queueEnd', (player) => {
            console.log(`[Lavalink] Queue ended for guild ${player.guild}`);
        });

        this.manager.on('playerMove', (player, oldChannel, newChannel) => {
            player.voiceChannel = newChannel;
        });

        this.manager.on('trackError', (player, track, error) => {
            console.error(`[Lavalink] Track error:`, error);
        });

        client.on('raw', d => this.manager.updateVoiceState(d));

        return this.manager;
    }

    getManager() {
        return this.manager;
    }

    async connect() {
        if (!this.manager) {
            throw new Error('Manager not initialized');
        }
        return this.manager.init(this.client.user.id);
    }

    getPlayer(guildId) {
        return this.manager.players.get(guildId);
    }

    createPlayer(guildId, voiceChannelId, textChannelId) {
        return this.manager.create({
            guild: guildId,
            voiceChannel: voiceChannelId,
            textChannel: textChannelId,
            volume: lavalinkConfig.playerOptions.volume,
            selfDeafen: lavalinkConfig.playerOptions.selfDeafen,
            selfMute: lavalinkConfig.playerOptions.selfMute
        });
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.destroy();
        }
    }

    async search(query, requester) {
        let searchQuery = query;
        
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `ytsearch:${query}`;
        }

        const result = await this.manager.search(searchQuery, requester);
        return result;
    }
}

module.exports = new LavalinkService();