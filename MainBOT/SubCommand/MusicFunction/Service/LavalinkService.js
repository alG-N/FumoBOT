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
            console.log('[Lavalink] Already initialized');
            return this.shoukaku;
        }

        if (!client || !client.user) {
            throw new Error('Discord client must be logged in');
        }

        this.client = client;
        console.log('[Lavalink] Initializing for', client.user.tag);
        console.log('[Lavalink] Node configuration:', JSON.stringify(lavalinkConfig.nodes, null, 2));

        try {
            this.shoukaku = new Shoukaku(
                new Connectors.DiscordJS(client),
                lavalinkConfig.nodes,
                lavalinkConfig.shoukakuOptions
            );

            console.log('[Lavalink] Shoukaku instance created successfully');
            this.setupEventHandlers();
            
        } catch (error) {
            console.error('[Lavalink] ❌ INITIALIZATION ERROR:', error);
            console.error('[Lavalink] Error stack:', error.stack);
            throw error;
        }

        return this.shoukaku;
    }

    setupEventHandlers() {
        console.log('[Lavalink] Setting up event handlers...');

        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ NODE READY: "${name}"`);
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
            this.isReady = false;
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ NODE DISCONNECTED: "${name}"`);
            console.log(`[Lavalink] Players: ${count}`);
            this.isReady = false;
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

        const node = this.shoukaku.options.nodeResolver ? this.shoukaku.options.nodeResolver(this.shoukaku.nodes) : [...this.shoukaku.nodes.values()].sort((a, b) => a.penalties - b.penalties).shift();

        if (!node) throw new Error('No nodes available');

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

        const node = this.shoukaku.options.nodeResolver ? this.shoukaku.options.nodeResolver(this.shoukaku.nodes) : [...this.shoukaku.nodes.values()].sort((a, b) => a.penalties - b.penalties).shift();

        if (!node) throw new Error('No nodes available');

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

        const status = {
            ready: this.isReady,
            activeConnections: this.shoukaku.players.size,
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