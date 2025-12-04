const { Shoukaku, Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.shoukaku = null;
        this.client = null;
        this.isReady = false;
        this.connectionAttempted = false;
    }

    initialize(client) {
        if (this.shoukaku) {
            console.log('[Lavalink] ⚠️ Already initialized');
            return this.shoukaku;
        }

        this.client = client;
        
        if (!lavalinkConfig || !Array.isArray(lavalinkConfig.nodes) || lavalinkConfig.nodes.length === 0) {
            throw new Error('Invalid lavalinkConfig: nodes must be an array with at least one node');
        }

        // Prepare nodes in Shoukaku v4 format
        const nodes = lavalinkConfig.nodes.map(node => ({
            name: node.id || 'main-node',
            url: `${node.secure ? 'https' : 'http'}://${node.host}:${node.port}`,
            auth: node.password,
            secure: node.secure || false
        }));

        console.log('[Lavalink] Initializing Shoukaku v4 with nodes:', JSON.stringify(nodes, null, 2));

        // Create Shoukaku instance
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
        this.connectionAttempted = true;

        // Setup event handlers
        this.setupEventHandlers();

        return this.shoukaku;
    }

    setupEventHandlers() {
        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node "${name}" is ready and connected`);
            this.isReady = true;
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node "${name}" error:`, error.message);
            console.error('[Lavalink] Full error:', error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 Node "${name}" closed: ${code} - ${reason}`);
            
            // Only set isReady to false if ALL nodes are disconnected
            const hasActiveNodes = Array.from(this.shoukaku.nodes.values()).some(node => node.state === 2);
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
            console.log(`[Lavalink] 🐛 Node "${name}":`, info);
        });

        // Add raw event handler to catch any issues
        this.shoukaku.on('raw', (name, data) => {
            console.log(`[Lavalink] 📡 Raw event from "${name}":`, JSON.stringify(data).substring(0, 200));
        });
    }

    getManager() {
        return this.shoukaku;
    }

    getConnectionStatus() {
        if (!this.shoukaku) {
            return 'NOT_INITIALIZED';
        }

        const nodes = Array.from(this.shoukaku.nodes.values());
        if (nodes.length === 0) {
            return 'NO_NODES';
        }

        const states = nodes.map(node => ({
            name: node.name,
            state: node.state, // 0=DISCONNECTED, 1=CONNECTING, 2=CONNECTED, 3=RECONNECTING
            stats: node.stats
        }));

        console.log('[Lavalink] Node states:', states);
        
        return states;
    }

    getPlayer(guildId) {
        if (!this.shoukaku) {
            return null;
        }
        return this.shoukaku.players.get(guildId);
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }

        // Get node using Shoukaku's node resolver
        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        
        if (!node) {
            console.error('[Lavalink] No available nodes. Current nodes:', Array.from(this.shoukaku.nodes.keys()));
            throw new Error('No available Lavalink nodes. Make sure Lavalink server is running.');
        }

        console.log(`[Lavalink] Creating player for guild ${guildId} using node "${node.name}" (state: ${node.state})`);

        try {
            const player = await node.joinChannel({
                guildId: guildId,
                channelId: voiceChannelId,
                shardId: 0,
                deaf: lavalinkConfig.playerOptions?.selfDeafen ?? true,
                mute: lavalinkConfig.playerOptions?.selfMute ?? false
            });

            await player.setGlobalVolume(lavalinkConfig.playerOptions?.volume ?? 100);

            console.log(`[Lavalink] ✅ Player created for guild ${guildId}`);
            return player;
        } catch (error) {
            console.error(`[Lavalink] ❌ Failed to create player:`, error);
            throw error;
        }
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            console.log(`[Lavalink] Destroying player for guild ${guildId}`);
            player.connection.disconnect();
        }
    }

    async search(query, requester) {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }

        let searchQuery = query;
        
        // Auto-detect if it's a URL or search query
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform || 'ytsearch'}:${query}`;
        }

        const node = this.shoukaku.options.nodeResolver(this.shoukaku.nodes);
        if (!node) {
            console.error('[Lavalink] No nodes available for search');
            throw new Error('No available Lavalink nodes');
        }

        console.log(`[Lavalink] Searching: ${searchQuery} (node: ${node.name})`);

        try {
            const result = await node.rest.resolve(searchQuery);
            
            if (!result || result.loadType === 'empty') {
                throw new Error('NO_RESULTS');
            }

            if (result.loadType === 'error') {
                console.error('[Lavalink] Load error:', result.data);
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
            
            // Attach requester to track
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
        } catch (error) {
            console.error('[Lavalink] Search error:', error);
            throw error;
        }
    }
}

module.exports = new LavalinkService();