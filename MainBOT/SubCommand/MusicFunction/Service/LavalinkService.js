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
            return this.shoukaku;
        }

        this.client = client;

        const nodes = lavalinkConfig.nodes.map(node => ({
            name: node.name,
            url: node.url,
            auth: node.auth,
            secure: node.secure || false
        }));

        try {
            const connector = new Connectors.DiscordJS(client);
            this.shoukaku = new Shoukaku(connector, nodes, lavalinkConfig.shoukakuOptions);
            this.setupEventHandlers();
        } catch (error) {
            console.error('[Lavalink] ❌ Initialization error:', error.message);
            throw error;
        }

        return this.shoukaku;
    }

    finalize() {
        // Connection finalized - nodes will emit 'ready' when connected
    }

    setupEventHandlers() {
        this.shoukaku.on('ready', (name) => {
            console.log(`[Lavalink] ✅ Node "${name}" ready`);
            this.readyNodes.add(name);
            this.isReady = true;
        });

        this.shoukaku.on('error', (name, error) => {
            console.error(`[Lavalink] ❌ Node "${name}" error:`, error.message);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[Lavalink] Node "${name}" closed (${code})`);
            this.readyNodes.delete(name);
            if (this.readyNodes.size === 0) {
                this.isReady = false;
            }
        });

        this.shoukaku.on('disconnect', (name, count) => {
            this.readyNodes.delete(name);
            if (this.readyNodes.size === 0) {
                this.isReady = false;
            }
        });

        this.shoukaku.on('reconnecting', (name, reconnectsLeft) => {
            console.log(`[Lavalink] 🔄 Reconnecting "${name}" (${reconnectsLeft} left)`);
        });

        this.shoukaku.on('debug', () => {});
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

        if (!this.isReady) {
            throw new Error('Lavalink not ready');
        }

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);
        if (!node) throw new Error('No available nodes');

        try {
            const player = await this.shoukaku.joinVoiceChannel({
                guildId: guildId,
                channelId: voiceChannelId,
                shardId: this.client.guilds.cache.get(guildId)?.shardId || 0,
                deaf: lavalinkConfig.playerOptions?.selfDeafen || true
            });

            // Shoukaku setGlobalVolume: 100 = 100% volume (no distortion)
            const configVolume = lavalinkConfig.playerOptions?.volume || 100;
            await player.setGlobalVolume(configVolume);

            return player;

        } catch (error) {
            console.error(`[Lavalink] ❌ Failed to create player:`, error.message);
            throw error;
        }
    }

    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            this.shoukaku.leaveVoiceChannel(guildId);
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
        if (/^https?:\/\//.test(query)) {
            try {
                const url = new URL(query);
                url.searchParams.delete('si');
                url.searchParams.delete('feature');
                searchQuery = url.toString();
                console.log(`[Lavalink] Cleaned URL: ${searchQuery}`);
            } catch (e) {
                console.log('[Lavalink] Failed to parse URL, using original');
            }
        } else {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        console.log(`[Lavalink] Searching: ${searchQuery}`);

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);

        if (!node) {
            console.error('[Lavalink] No available nodes');
            throw new Error('No available nodes');
        }

        console.log(`[Lavalink] Using node: ${node.name}, State: ${node.state}`);

        try {
            let result = await node.rest.resolve(searchQuery);

            if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                const fallbackQuery = /^https?:\/\//.test(query) 
                    ? query 
                    : `${lavalinkConfig.fallbackSearchPlatform}:${query}`;
                
                result = await node.rest.resolve(fallbackQuery);

                if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                    throw new Error('NO_RESULTS');
                }
            }

            let track;
            if (result.loadType === 'track') {
                track = result.data;
            } else if (result.loadType === 'search') {
                track = result.data?.[0];
            } else if (result.loadType === 'playlist') {
                track = result.data?.tracks?.[0];
            } else {
                track = result.data?.tracks?.[0] || result.data?.[0] || result.tracks?.[0];
            }

            if (!track || !track.info) {
                throw new Error('NO_RESULTS');
            }

            const youtubeId = this.extractYouTubeId(track.info.uri);
            
            // Try multiple thumbnail options with fallbacks
            let thumbnail = track.info.artworkUrl;
            if (!thumbnail && youtubeId) {
                // Try hqdefault first (more reliable), then maxresdefault
                thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
            }

            const viewCount = track.pluginInfo?.viewCount || 
                            track.pluginInfo?.playCount || 
                            track.info?.viewCount ||
                            null;

            return {
                track: track,
                encoded: track.encoded,
                url: track.info.uri,
                title: track.info.title,
                lengthSeconds: Math.floor(track.info.length / 1000),
                thumbnail: thumbnail,
                author: track.info.author,
                requestedBy: requester,
                source: track.info.sourceName || 'Unknown',
                viewCount: viewCount,
                identifier: youtubeId || track.info.identifier
            };

        } catch (error) {
            throw error;
        }
    }

    extractYouTubeId(url) {
        if (!url) return null;
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
        return match ? match[1] : null;
    }

    async searchPlaylist(query, requester) {
        if (!this.shoukaku) {
            throw new Error('Shoukaku not initialized');
        }

        if (!this.isReady) {
            throw new Error('Lavalink not ready');
        }

        let searchQuery = query;
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);

        if (!node) {
            throw new Error('No available nodes');
        }

        try {
            let result = await node.rest.resolve(searchQuery);

            if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                result = await node.rest.resolve(query);

                if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                    throw new Error('NO_RESULTS');
                }
            }

            if (result.loadType === 'playlist') {
                const playlistData = result.data;
                const tracks = playlistData.tracks.map(track => {
                    const youtubeId = this.extractYouTubeId(track.info.uri);
                    
                    // Try multiple thumbnail options with fallbacks
                    let thumbnail = track.info.artworkUrl;
                    if (!thumbnail && youtubeId) {
                        thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
                    }

                    const viewCount = track.pluginInfo?.viewCount || 
                                    track.pluginInfo?.playCount || 
                                    track.info?.viewCount ||
                                    null;

                    return {
                        track: track,
                        encoded: track.encoded,
                        url: track.info.uri,
                        title: track.info.title,
                        lengthSeconds: Math.floor(track.info.length / 1000),
                        thumbnail: thumbnail,
                        author: track.info.author,
                        requestedBy: requester,
                        source: track.info.sourceName || 'Unknown',
                        viewCount: viewCount,
                        identifier: youtubeId || track.info.identifier
                    };
                });

                return {
                    playlistName: playlistData.info.name,
                    tracks: tracks
                };
            }

            throw new Error('NOT_A_PLAYLIST');

        } catch (error) {
            throw error;
        }
    }

    getNodeStatus() {
        if (!this.shoukaku) {
            return { ready: false, activeConnections: 0, error: 'Not initialized' };
        }

        const nodes = Array.from(this.shoukaku.nodes.values()).map(node => ({
            name: node.name,
            state: node.state,
            stats: node.stats
        }));

        return {
            ready: this.isReady,
            activeConnections: this.shoukaku.players.size,
            nodes: nodes,
            players: Array.from(this.shoukaku.players.values()).map(p => ({
                guildId: p.guildId,
                paused: p.paused,
                track: p.track
            }))
        };
    }
}

module.exports = new LavalinkService();