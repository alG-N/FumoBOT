const { Shoukaku, Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.shoukaku = null;
        this.client = null;
        this.isReady = false;
        this.readyNodes = new Set();
    }

    preInitialize(client) {
        if (this.shoukaku) {
            console.log('[Lavalink] Already initialized');
            return this.shoukaku;
        }

        this.client = client;
        console.log('[Lavalink] Pre-initializing Shoukaku (before login)...');

        const nodes = lavalinkConfig.nodes.map(node => ({
            name: node.name,
            url: node.url,
            auth: node.auth,
            secure: node.secure || false
        }));

        console.log('[Lavalink] Nodes configuration:', JSON.stringify(nodes, null, 2));

        try {
            const connector = new Connectors.DiscordJS(client);
            this.shoukaku = new Shoukaku(connector, nodes, lavalinkConfig.shoukakuOptions);
            
            console.log('[Lavalink] Shoukaku pre-initialized successfully');
            this.setupEventHandlers();
            
        } catch (error) {
            console.error('[Lavalink] ❌ PRE-INITIALIZATION ERROR:', error);
            console.error('[Lavalink] Error stack:', error.stack);
            throw error;
        }

        return this.shoukaku;
    }

    finalize() {
        console.log('[Lavalink] Finalizing connection to nodes...');
        console.log('[Lavalink] Client user ID:', this.client.user.id);
        console.log('[Lavalink] Total nodes:', this.shoukaku.nodes.size);
        
        for (const [name, node] of this.shoukaku.nodes) {
            console.log(`[Lavalink] Node "${name}": state=${node.state}`);
        }
    }

    setupEventHandlers() {
        console.log('[Lavalink] Setting up event handlers...');

        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ NODE READY: "${name}"`);
            this.readyNodes.add(name);
            this.isReady = true;
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ NODE ERROR: "${name}"`);
            console.error(`[Lavalink] Error message:`, error.message);
            console.error(`[Lavalink] Error stack:`, error.stack);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 NODE CLOSED: "${name}"`);
            console.log(`[Lavalink] Close code: ${code}`);
            console.log(`[Lavalink] Close reason: ${reason}`);
            this.readyNodes.delete(name);
            if (this.readyNodes.size === 0) {
                this.isReady = false;
            }
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ NODE DISCONNECTED: "${name}"`);
            console.log(`[Lavalink] Moved players: ${count}`);
            this.readyNodes.delete(name);
            if (this.readyNodes.size === 0) {
                this.isReady = false;
            }
        });

        this.shoukaku.on('reconnecting', (name, reconnectsLeft, reconnectInterval) => {
            console.log(`[Lavalink] 🔄 NODE RECONNECTING: "${name}"`);
            console.log(`[Lavalink] Attempts left: ${reconnectsLeft}, Interval: ${reconnectInterval}ms`);
        });

        this.shoukaku.on('debug', (name, info) => {
            console.log(`[Lavalink] 🐛 DEBUG [${name}]:`, info);
        });

        console.log('[Lavalink] Event handlers registered');
    }

    getManager() {
        return this.shoukaku;
    }

    getPlayer(guildId) {
        return this.shoukaku?.players.get(guildId) || null;
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.shoukaku) {
            console.error('[Lavalink] Cannot create player: Shoukaku not initialized');
            throw new Error('Shoukaku not initialized');
        }
        
        if (!this.isReady) {
            console.error('[Lavalink] Cannot create player: Lavalink not ready');
            throw new Error('Lavalink not ready');
        }

        console.log(`[Lavalink] Creating player for guild ${guildId}`);

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);

        if (!node) throw new Error('No available nodes');

        try {
            const player = await this.shoukaku.joinVoiceChannel({
                guildId: guildId,
                channelId: voiceChannelId,
                shardId: this.client.guilds.cache.get(guildId)?.shardId || 0,
                deaf: lavalinkConfig.playerOptions?.selfDeafen || true
            });

            await player.setGlobalVolume(lavalinkConfig.playerOptions?.volume || 100);

            console.log(`[Lavalink] ✅ Player created successfully for guild ${guildId}`);
            return player;
            
        } catch (error) {
            console.error(`[Lavalink] ❌ FAILED to create player for guild ${guildId}`);
            console.error(`[Lavalink] Error:`, error.message);
            throw error;
        }
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            console.log(`[Lavalink] Destroying player for guild ${guildId}`);
            this.shoukaku.leaveVoiceChannel(guildId);
            console.log(`[Lavalink] ✅ Player destroyed for guild ${guildId}`);
        } else {
            console.log(`[Lavalink] No player found for guild ${guildId}`);
        }
    }

    async search(query, requester) {
        if (!this.shoukaku) {
            console.error('[Lavalink] Cannot search: Shoukaku not initialized');
            throw new Error('Shoukaku not initialized');
        }
        
        if (!this.isReady) {
            console.error('[Lavalink] Cannot search: Lavalink not ready');
            throw new Error('Lavalink not ready');
        }

        let searchQuery = query;
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        console.log(`[Lavalink] Searching: ${searchQuery}`);

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);

        if (!node) throw new Error('No available nodes');

        try {
            const result = await node.rest.resolve(searchQuery);

            if (!result || !result.tracks || result.tracks.length === 0) {
                console.log(`[Lavalink] No results found for: ${searchQuery}`);
                throw new Error('NO_RESULTS');
            }

            const track = result.tracks[0];
            console.log(`[Lavalink] ✅ Found track: ${track.info.title}`);

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
            console.error(`[Lavalink] ❌ Search failed for: ${searchQuery}`);
            console.error(`[Lavalink] Error:`, error.message);
            throw error;
        }
    }

    getNodeStatus() {
        if (!this.shoukaku) {
            console.log('[Lavalink] Status check: Shoukaku not initialized');
            return { ready: false, activeConnections: 0, error: 'Not initialized' };
        }

        const nodes = Array.from(this.shoukaku.nodes.values()).map(node => ({
            name: node.name,
            state: node.state,
            stats: node.stats
        }));

        const status = {
            ready: this.isReady,
            activeConnections: this.shoukaku.players.size,
            nodes: nodes,
            players: Array.from(this.shoukaku.players.values()).map(p => ({
                guildId: p.guildId,
                paused: p.paused,
                track: p.track
            }))
        };

        console.log('[Lavalink] Current status:', JSON.stringify(status, null, 2));
        return status;
    }
}

module.exports = new LavalinkService();