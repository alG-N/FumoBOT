const { Shoukaku, Connectors } = require('shoukaku');
const lavalinkConfig = require('../Configuration/lavalinkConfig');

class LavalinkService {
    constructor() {
        this.shoukaku = null;
        this.client = null;
        this.players = new Map();
    }

    initialize(client) {
        this.client = client;
        
        if (!lavalinkConfig || !Array.isArray(lavalinkConfig.nodes) || lavalinkConfig.nodes.length === 0) {
            throw new Error('Invalid lavalinkConfig: nodes must be an array with at least one node');
        }

        // Convert config to Shoukaku format
        const nodes = lavalinkConfig.nodes.map(node => ({
            name: node.id,
            url: `${node.host}:${node.port}`,
            auth: node.password,
            secure: node.secure || false
        }));

        console.log('[Lavalink] Initializing Shoukaku with nodes:', JSON.stringify(nodes, null, 2));

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
                userAgent: 'MusicBot/1.0.0',
                structures: {
                    // Custom player structure can be added here if needed
                }
            }
        );

        // Event handlers
        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node ${name} is ready`);
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node ${name} error:`, error.message);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] 🔌 Node ${name} closed: ${code} - ${reason}`);
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[Lavalink] ⚠️ Node ${name} disconnected (${count} players affected)`);
        });

        this.shoukaku.on('reconnecting', (name, tries) => {
            console.log(`[Lavalink] 🔄 Node ${name} reconnecting (attempt ${tries})`);
        });

        this.shoukaku.on('debug', (name, info) => {
            // Uncomment for verbose debugging
            // console.log(`[Lavalink] 🐛 Node ${name}:`, info);
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
        console.log('[Lavalink] ✅ Shoukaku initialized and ready for connections');
    }

    getPlayer(guildId) {
        return this.shoukaku.players.get(guildId);
    }

    async createPlayer(guildId, voiceChannelId, textChannelId) {
        // Get the best node
        const node = this.shoukaku.getIdealNode();
        
        if (!node) {
            throw new Error('No available Lavalink nodes');
        }

        // Create player
        const player = await node.joinChannel({
            guildId: guildId,
            channelId: voiceChannelId,
            shardId: 0,
            deaf: lavalinkConfig.playerOptions.selfDeafen,
            mute: lavalinkConfig.playerOptions.selfMute
        });

        // Set initial volume
        await player.setGlobalVolume(lavalinkConfig.playerOptions.volume);

        // Store player reference
        this.players.set(guildId, {
            player: player,
            textChannelId: textChannelId,
            queue: [],
            current: null,
            loop: false,
            volume: lavalinkConfig.playerOptions.volume
        });

        // Setup player events
        this.setupPlayerEvents(player, guildId);

        return player;
    }

    setupPlayerEvents(player, guildId) {
        player.on('start', () => {
            console.log(`[Lavalink] ▶️ Track started in guild ${guildId}`);
        });

        player.on('end', (data) => {
            console.log(`[Lavalink] ⏹️ Track ended in guild ${guildId}:`, data.reason);
            
            const playerData = this.players.get(guildId);
            if (!playerData) return;

            // Handle looping
            if (playerData.loop && playerData.current) {
                player.playTrack({ track: { encoded: playerData.current.encoded } });
                return;
            }

            // Play next track
            if (playerData.queue.length > 0) {
                const nextTrack = playerData.queue.shift();
                playerData.current = nextTrack;
                player.playTrack({ track: { encoded: nextTrack.encoded } });
            } else {
                playerData.current = null;
            }
        });

        player.on('closed', (data) => {
            console.log(`[Lavalink] 🔌 Player closed in guild ${guildId}:`, data);
        });

        player.on('exception', (data) => {
            console.error(`[Lavalink] ❌ Player exception in guild ${guildId}:`, data);
        });

        player.on('stuck', (data) => {
            console.warn(`[Lavalink] ⚠️ Track stuck in guild ${guildId}:`, data);
            // Skip stuck track
            player.stopTrack();
        });

        player.on('resumed', () => {
            console.log(`[Lavalink] ▶️ Player resumed in guild ${guildId}`);
        });
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.connection.disconnect();
            this.players.delete(guildId);
        }
    }

    async search(query, requester) {
        let searchQuery = query;
        
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        const node = this.shoukaku.getIdealNode();
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

        // Handle different load types
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

    // Helper methods for queue management
    getPlayerData(guildId) {
        return this.players.get(guildId);
    }

    addToQueue(guildId, track) {
        const playerData = this.players.get(guildId);
        if (playerData) {
            playerData.queue.push(track);
            return playerData.queue.length;
        }
        return 0;
    }

    setCurrentTrack(guildId, track) {
        const playerData = this.players.get(guildId);
        if (playerData) {
            playerData.current = track;
        }
    }

    getCurrentTrack(guildId) {
        const playerData = this.players.get(guildId);
        return playerData?.current || null;
    }

    getQueue(guildId) {
        const playerData = this.players.get(guildId);
        return playerData?.queue || [];
    }

    setLoop(guildId, enabled) {
        const playerData = this.players.get(guildId);
        if (playerData) {
            playerData.loop = enabled;
            return enabled;
        }
        return false;
    }

    isLooping(guildId) {
        const playerData = this.players.get(guildId);
        return playerData?.loop || false;
    }

    toggleLoop(guildId) {
        const playerData = this.players.get(guildId);
        if (playerData) {
            playerData.loop = !playerData.loop;
            return playerData.loop;
        }
        return false;
    }
}

module.exports = new LavalinkService();