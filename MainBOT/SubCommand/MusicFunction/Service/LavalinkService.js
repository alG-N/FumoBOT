const { Kazagumo, Plugins } = require('kazagumo');
const { Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.kazagumo = null;
        this.client = null;
        this.isReady = false;
        this.connectionTimeout = null;
    }

    initialize(client) {
        if (this.kazagumo) {
            console.log('[Lavalink] ⚠️ Already initialized');
            return this.kazagumo;
        }

        this.client = client;
        
        console.log('[Lavalink] Initializing Kazagumo...');
        console.log('[Lavalink] Config:', JSON.stringify(lavalinkConfig.nodes, null, 2));

        // Create Kazagumo instance
        this.kazagumo = new Kazagumo(
            {
                plugins: [
                    new Plugins.PlayerMoved(client)
                ],
                send: (guildId, payload) => {
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) guild.shard.send(payload);
                }
            },
            new Connectors.DiscordJS(client),
            lavalinkConfig.nodes,
            {
                reconnectTries: 5,
                reconnectInterval: 3000,
                restTimeout: 10000,
                moveOnDisconnect: false,
                resume: false,
                resumeTimeout: 30,
                userAgent: 'MusicBot/1.0.0 (Kazagumo)'
            }
        );

        console.log('[Lavalink] Kazagumo instance created');

        // Setup event handlers
        this.setupEventHandlers();

        // Set a timeout to check connection status
        this.connectionTimeout = setTimeout(() => {
            if (!this.isReady) {
                console.error('[Lavalink] ❌ Connection timeout after 30 seconds');
                console.error('[Lavalink] Troubleshooting:');
                console.error('   1. Is Lavalink running? Run: java -jar Lavalink.jar');
                console.error('   2. Check lavalinkConfig.js - verify host/port/password');
                console.error('   3. Check application.yml password matches config');
                console.error('   4. Try restarting both Lavalink and the bot');
                console.error('\n[Lavalink] Current nodes:');
                if (this.kazagumo?.shoukaku?.nodes) {
                    this.kazagumo.shoukaku.nodes.forEach((node, name) => {
                        console.error(`   - ${name}: state=${node.state} (0=DISCONNECTED, 1=CONNECTING, 2=CONNECTED, 3=RECONNECTING)`);
                    });
                }
            }
        }, 30000);

        return this.kazagumo;
    }

    setupEventHandlers() {
        const shoukaku = this.kazagumo.shoukaku;

        // Node ready event - THIS IS THE KEY EVENT
        shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node "${name}" connected successfully!`);
            this.isReady = true;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            console.log(`[Lavalink] 📊 Status:`);
            console.log(`   - Total nodes: ${shoukaku.nodes.size}`);
            console.log(`   - Node names:`, Array.from(shoukaku.nodes.keys()));
            console.log(`[Lavalink] 🎵 Music system is now fully operational!`);
        });

        // Node error event
        shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node "${name}" error:`, error.message);
            console.error(`[Lavalink] Full error:`, error);
        });

        // Node close event
        shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 Node "${name}" closed: ${code} - ${reason}`);
            
            const hasActiveNodes = Array.from(shoukaku.nodes.values())
                .some(node => node.state === 2);
            if (!hasActiveNodes) {
                this.isReady = false;
                console.log('[Lavalink] ⚠️ All nodes disconnected');
            }
        });

        // Node disconnect event
        shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ Node "${name}" disconnected (${count} players affected)`);
        });

        // Node reconnecting event
        shoukaku.on('reconnecting', (name, tries) => {
            console.log(`[Lavalink] 🔄 Node "${name}" reconnecting (attempt ${tries}/5)`);
        });

        // Debug event - VERY USEFUL FOR TROUBLESHOOTING
        shoukaku.on('debug', (name, info) => {
            // Uncomment for verbose debugging
            console.log(`[Lavalink] 🐛 Node "${name}":`, info);
        });

        // Kazagumo player events
        this.kazagumo.on('playerStart', (player, track) => {
            console.log(`[Lavalink] 🎵 Started: ${track.title} in guild ${player.guildId}`);
        });

        this.kazagumo.on('playerEnd', (player, track) => {
            console.log(`[Lavalink] ✅ Finished: ${track.title}`);
        });

        this.kazagumo.on('playerEmpty', (player) => {
            console.log(`[Lavalink] 📭 Queue empty for guild ${player.guildId}`);
        });

        this.kazagumo.on('playerException', (player, data) => {
            console.error(`[Lavalink] ❌ Player exception in guild ${player.guildId}:`, data.exception?.message);
        });

        this.kazagumo.on('playerStuck', (player, data) => {
            console.warn(`[Lavalink] ⚠️ Player stuck in guild ${player.guildId}, threshold: ${data.thresholdMs}ms`);
        });

        this.kazagumo.on('playerResolveError', (player, track, message) => {
            console.error(`[Lavalink] ❌ Resolve error for ${track?.title}:`, message);
        });
    }

    getManager() {
        return this.kazagumo;
    }

    getPlayer(guildId) {
        return this.kazagumo?.players.get(guildId) || null;
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        if (!this.kazagumo) {
            throw new Error('Kazagumo not initialized');
        }

        if (!this.isReady) {
            throw new Error('Lavalink nodes are not ready yet. Please wait a moment and try again.');
        }

        console.log(`[Lavalink] Creating player for guild ${guildId}`);

        const player = await this.kazagumo.createPlayer({
            guildId: guildId,
            textId: textChannelId,
            voiceId: voiceChannelId,
            deaf: lavalinkConfig.playerOptions?.selfDeafen ?? true,
            volume: lavalinkConfig.playerOptions?.volume ?? 100
        });

        console.log(`[Lavalink] ✅ Player created for guild ${guildId}`);
        return player;
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.destroy();
            console.log(`[Lavalink] 🗑️ Player destroyed for guild ${guildId}`);
        }
    }

    async search(query, requester) {
        if (!this.kazagumo) {
            throw new Error('Kazagumo not initialized');
        }

        if (!this.isReady) {
            throw new Error('Lavalink nodes are not ready yet. Please wait a moment and try again.');
        }

        let searchQuery = query;
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform || 'ytsearch'}:${query}`;
        }

        console.log(`[Lavalink] Searching: ${searchQuery}`);

        const result = await this.kazagumo.search(searchQuery, { requester });
        
        if (!result || result.tracks.length === 0) {
            throw new Error('NO_RESULTS');
        }

        const track = result.tracks[0];
        
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
    }

    // Helper method to check node status
    getNodeStatus() {
        if (!this.kazagumo?.shoukaku?.nodes) {
            return { ready: false, nodes: [] };
        }

        const nodes = Array.from(this.kazagumo.shoukaku.nodes.entries()).map(([name, node]) => ({
            name,
            state: node.state,
            stateText: ['DISCONNECTED', 'CONNECTING', 'CONNECTED', 'RECONNECTING'][node.state] || 'UNKNOWN'
        }));

        return {
            ready: this.isReady,
            nodes
        };
    }
}

module.exports = new LavalinkService();