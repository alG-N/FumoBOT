const { Shoukaku, Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.shoukaku = null;
        this.client = null;
        this.isReady = false;
    }

    initialize(client) {
        if (this.shoukaku) {
            console.log('[Lavalink] ⚠️ Already initialized');
            return this.shoukaku;
        }

        this.client = client;
        
        const nodes = lavalinkConfig.nodes;
        console.log('[Lavalink] Initializing Shoukaku with nodes:', JSON.stringify(nodes, null, 2));

        // Create Shoukaku - nodes will be added asynchronously when Discord connects
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
        console.log('[Lavalink] ⏳ Nodes will be added when Discord connector is ready...');

        // Setup event handlers
        this.setupEventHandlers();

        return this.shoukaku;
    }

    setupEventHandlers() {
        // This fires when a node successfully connects to Lavalink
        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node "${name}" is ready and connected to Lavalink`);
            this.isReady = true;
            
            // Log all connected nodes
            console.log(`[Lavalink] 📊 Total nodes: ${this.shoukaku.nodes.size}`);
            console.log(`[Lavalink] 📋 Node names:`, Array.from(this.shoukaku.nodes.keys()));
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node "${name}" error:`, error.message);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 Node "${name}" closed: ${code} - ${reason}`);
            
            const hasActiveNodes = Array.from(this.shoukaku.nodes.values())
                .some(node => node.state === 2);
            if (!hasActiveNodes) {
                this.isReady = false;
            }
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ Node "${name}" disconnected (${count} players affected)`);
        });

        this.shoukaku.on('reconnecting', (name, tries) => {
            console.log(`[Lavalink] 🔄 Node "${name}" reconnecting (attempt ${tries})`);
        });

        this.shoukaku.on('debug', (name, info) => {
            // Uncomment for verbose debugging
            // console.log(`[Lavalink] 🐛 Node "${name}":`, info);
        });
    }

    getManager() {
        return this.shoukaku;
    }

    getPlayer(guildId) {
        return this.shoukaku?.players.get(guildId) || null;
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }

        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        
        if (!node) {
            throw new Error('No available Lavalink nodes');
        }

        console.log(`[Lavalink] Creating player for guild ${guildId}`);

        const player = await node.joinChannel({
            guildId: guildId,
            channelId: voiceChannelId,
            shardId: 0,
            deaf: lavalinkConfig.playerOptions?.selfDeafen ?? true,
            mute: lavalinkConfig.playerOptions?.selfMute ?? false
        });

        await player.setGlobalVolume(lavalinkConfig.playerOptions?.volume ?? 100);

        console.log(`[Lavalink] ✅ Player created`);
        return player;
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.connection.disconnect();
        }
    }

    async search(query, requester) {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }

        let searchQuery = query;
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform || 'ytsearch'}:${query}`;
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
        } else if (result.loadType === 'search') {
            tracks = result.data;
        } else if (result.loadType === 'playlist') {
            tracks = result.data.tracks;
        }

        if (!tracks || tracks.length === 0) {
            throw new Error('NO_RESULTS');
        }

        const track = tracks[0];
        track.requester = requester;
        
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