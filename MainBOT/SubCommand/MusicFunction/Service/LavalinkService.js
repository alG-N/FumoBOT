const { Kazagumo } = require('kazagumo');
const { Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.kazagumo = null;
        this.client = null;
        this.isReady = false;
    }

    initialize(client) {
        if (this.kazagumo) {
            console.log('[Lavalink] Already initialized');
            return this.kazagumo;
        }

        if (!client || !client.user) {
            throw new Error('Discord client must be logged in');
        }

        this.client = client;
        console.log('[Lavalink] Initializing for', client.user.tag);
        console.log('[Lavalink] Node configuration:', JSON.stringify(lavalinkConfig.nodes, null, 2));

        try {
            this.kazagumo = new Kazagumo(
                {
                    defaultSearchEngine: lavalinkConfig.defaultSearchPlatform || 'youtube',
                    send: (guildId, payload) => {
                        const guild = client.guilds.cache.get(guildId);
                        if (guild) guild.shard.send(payload);
                    }
                },
                new Connectors.DiscordJS(client),
                lavalinkConfig.nodes
            );

            console.log('[Lavalink] Kazagumo instance created successfully');
            this.setupEventHandlers();
            
        } catch (error) {
            console.error('[Lavalink] ❌ INITIALIZATION ERROR:', error);
            console.error('[Lavalink] Error stack:', error.stack);
            throw error;
        }

        return this.kazagumo;
    }

    setupEventHandlers() {
        console.log('[Lavalink] Setting up event handlers...');

        this.kazagumo.on('ready', (name) => {
            console.log(`[Lavalink] ✅ NODE READY: "${name}"`);
            this.isReady = true;
        });

        this.kazagumo.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ NODE ERROR: "${name}"`);
            console.error(`[Lavalink] Error message:`, error.message);
            console.error(`[Lavalink] Error stack:`, error.stack);
            console.error(`[Lavalink] Full error object:`, JSON.stringify(error, null, 2));
        });

        this.kazagumo.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 NODE CLOSED: "${name}"`);
            console.log(`[Lavalink] Close code: ${code}`);
            console.log(`[Lavalink] Close reason: ${reason}`);
        });

        this.kazagumo.on('disconnect', (name, reason) => {
            console.log(`[Lavalink] ⚠️ NODE DISCONNECTED: "${name}"`);
            console.log(`[Lavalink] Disconnect reason:`, reason);
            this.isReady = false;
        });

        this.kazagumo.on('reconnecting', (name, reconnectsLeft, reconnectInterval) => {
            console.log(`[Lavalink] 🔄 NODE RECONNECTING: "${name}"`);
            console.log(`[Lavalink] Attempts left: ${reconnectsLeft}, Interval: ${reconnectInterval}ms`);
        });

        this.kazagumo.on('debug', (name, info) => {
            console.log(`[Lavalink] 🐛 DEBUG [${name}]:`, info);
        });

        this.kazagumo.on('playerStart', (player, track) => {
            console.log(`[Lavalink] ▶️ Playing: ${track.title} in guild ${player.guildId}`);
        });

        this.kazagumo.on('playerEnd', (player) => {
            console.log(`[Lavalink] ⏹️ Track ended in guild ${player.guildId}`);
        });

        this.kazagumo.on('playerEmpty', (player) => {
            console.log(`[Lavalink] 📭 Queue empty in guild ${player.guildId}`);
        });

        this.kazagumo.on('playerException', (player, data) => {
            console.error(`[Lavalink] ❌ PLAYER EXCEPTION in guild ${player.guildId}`);
            console.error(`[Lavalink] Exception:`, data.exception?.message);
            console.error(`[Lavalink] Full exception data:`, JSON.stringify(data, null, 2));
        });

        this.kazagumo.on('playerStuck', (player, data) => {
            console.warn(`[Lavalink] ⏸️ PLAYER STUCK in guild ${player.guildId}`);
            console.warn(`[Lavalink] Threshold: ${data.thresholdMs}ms`);
        });

        console.log('[Lavalink] Event handlers registered');
    }

    getManager() {
        return this.kazagumo;
    }

    getPlayer(guildId) {
        return this.kazagumo?.players.get(guildId) || null;
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.kazagumo) {
            console.error('[Lavalink] Cannot create player: Kazagumo not initialized');
            throw new Error('Kazagumo not initialized');
        }
        
        if (!this.isReady) {
            console.error('[Lavalink] Cannot create player: Lavalink not ready');
            console.error('[Lavalink] Current ready state:', this.isReady);
            throw new Error('Lavalink not ready');
        }

        console.log(`[Lavalink] Creating player for guild ${guildId}`);
        console.log(`[Lavalink] Voice channel: ${voiceChannelId}`);
        console.log(`[Lavalink] Text channel: ${textChannelId}`);

        try {
            const player = await this.kazagumo.createPlayer({
                guildId,
                textId: textChannelId,
                voiceId: voiceChannelId,
                volume: lavalinkConfig.playerOptions?.volume || 100,
                deaf: lavalinkConfig.playerOptions?.selfDeafen || true
            });

            console.log(`[Lavalink] ✅ Player created successfully for guild ${guildId}`);
            return player;
            
        } catch (error) {
            console.error(`[Lavalink] ❌ FAILED to create player for guild ${guildId}`);
            console.error(`[Lavalink] Error:`, error.message);
            console.error(`[Lavalink] Stack:`, error.stack);
            throw error;
        }
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            console.log(`[Lavalink] Destroying player for guild ${guildId}`);
            player.destroy();
            console.log(`[Lavalink] ✅ Player destroyed for guild ${guildId}`);
        } else {
            console.log(`[Lavalink] No player found for guild ${guildId}`);
        }
    }

    async search(query, requester) {
        if (!this.kazagumo) {
            console.error('[Lavalink] Cannot search: Kazagumo not initialized');
            throw new Error('Kazagumo not initialized');
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

        try {
            const result = await this.kazagumo.search(searchQuery, { requester });

            if (!result || result.tracks.length === 0) {
                console.log(`[Lavalink] No results found for: ${searchQuery}`);
                throw new Error('NO_RESULTS');
            }

            const track = result.tracks[0];
            console.log(`[Lavalink] ✅ Found track: ${track.title}`);

            return {
                track: track,
                encoded: track.encoded,
                url: track.uri,
                title: track.title,
                lengthSeconds: Math.floor(track.length / 1000),
                thumbnail: track.thumbnail || track.artworkUrl || null,
                author: track.author,
                requestedBy: requester,
                source: track.sourceName || 'YouTube'
            };
            
        } catch (error) {
            console.error(`[Lavalink] ❌ Search failed for: ${searchQuery}`);
            console.error(`[Lavalink] Error:`, error.message);
            throw error;
        }
    }

    getNodeStatus() {
        if (!this.kazagumo) {
            console.log('[Lavalink] Status check: Kazagumo not initialized');
            return { ready: false, activeConnections: 0, error: 'Not initialized' };
        }

        const status = {
            ready: this.isReady,
            activeConnections: this.kazagumo.players.size,
            players: Array.from(this.kazagumo.players.values()).map(p => ({
                guildId: p.guildId,
                state: p.state
            }))
        };

        console.log('[Lavalink] Current status:', JSON.stringify(status, null, 2));
        return status;
    }
}

module.exports = new LavalinkService();