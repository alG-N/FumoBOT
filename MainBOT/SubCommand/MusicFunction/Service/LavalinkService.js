const { Shoukaku, Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.shoukaku = null;
        this.client = null;
        this.isReady = false;
    }

    initialize(client) {
        this.client = client;
        
        if (!lavalinkConfig || !Array.isArray(lavalinkConfig.nodes) || lavalinkConfig.nodes.length === 0) {
            throw new Error('Invalid lavalinkConfig: nodes must be an array with at least one node');
        }

        // Prepare nodes in Shoukaku v4 format
        const nodes = lavalinkConfig.nodes.map(node => ({
            name: node.id,
            url: `${node.host}:${node.port}`,
            auth: node.password,
            secure: node.secure || false
        }));

        console.log('[Lavalink] Initializing Shoukaku v4 with nodes:', JSON.stringify(nodes, null, 2));

        // Create Shoukaku instance with nodes directly in constructor
        this.shoukaku = new Shoukaku(
            new Connectors.DiscordJS(client),
            nodes,
            {
                reconnectTries: 5,
                reconnectInterval: 3000,
                restTimeout: 60000,
                moveOnDisconnect: false,
                resume: false,
                resumeTimeout: 30,
                resumeByLibrary: false,
                userAgent: 'MusicBot/1.0.0'
            }
        );

        console.log('[Lavalink] Shoukaku instance created');
        console.log('[Lavalink] Nodes registered:', this.shoukaku.nodes.size);

        // Event handlers
        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node ${name} is ready and connected`);
            this.isReady = true;
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node ${name} error:`, error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 Node ${name} closed: ${code} - ${reason}`);
            this.isReady = false;
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ Node ${name} disconnected (${count} players affected)`);
            this.isReady = false;
        });

        this.shoukaku.on('reconnecting', (name, tries) => {
            console.log(`[Lavalink] 🔄 Node ${name} reconnecting (attempt ${tries})`);
        });

        this.shoukaku.on('debug', (name, info) => {
            console.log(`[Lavalink] 🐛 Node ${name}:`, info);
        });

        return this.shoukaku;
    }

    getManager() {
        return this.shoukaku;
    }

    async connect() {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }
        console.log('[Lavalink] ✅ Shoukaku initialized, waiting for node connection...');
    }

    getPlayer(guildId) {
        if (!this.isReady) {
            return null;
        }
        return this.shoukaku.players.get(guildId);
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.isReady) {
            throw new Error('Lavalink is not ready yet. Please wait a moment and try again.');
        }

        // Get node using Shoukaku's node resolver
        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        
        if (!node) {
            throw new Error('No available Lavalink nodes');
        }

        const player = await node.joinChannel({
            guildId: guildId,
            channelId: voiceChannelId,
            shardId: 0,
            deaf: lavalinkConfig.playerOptions.selfDeafen,
            mute: lavalinkConfig.playerOptions.selfMute
        });

        await player.setGlobalVolume(lavalinkConfig.playerOptions.volume);

        return player;
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.connection.disconnect();
        }
    }

    async search(query, requester) {
        if (!this.isReady) {
            throw new Error('Lavalink is not ready yet. Please wait a moment and try again.');
        }

        let searchQuery = query;
        
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        if (!node) {
            throw new Error('No available Lavalink nodes');
        }

        const result = await node.rest.resolve(searchQuery);
        
        if (!result || result.loadType === 'empty') {
            throw new Error('NO_RESULTS');
        }

        if (result.loadType === 'error') {
            throw new Error('LOAD_FAILED');
        }

        let tracks = [];
        if (result.loadType === 'track') {
            tracks = [result.data];
        } else if (result.loadType === 'search' || result.loadType === 'playlist') {
            tracks = result.data.tracks || result.data;
        }

        if (!tracks || tracks.length === 0) {
            throw new Error('NO_RESULTS');
        }

        const track = tracks[0];
        
        return {
            track: track,
            encoded: track.encoded,
            url: track.info.uri,
            title: track.info.title,
            lengthSeconds: Math.floor(track.info.length / 1000),
            thumbnail: track.info.artworkUrl || null,
            author: track.info.author,
            requestedBy: requester,
            source: track.info.sourceName || 'YouTube'
        };
    }
}

module.exports = new LavalinkService();