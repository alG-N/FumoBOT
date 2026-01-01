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
            // console.log(`[Lavalink] 🐛 DEBUG [${name}]:`, info);
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

            // Shoukaku setGlobalVolume: 100 = 100% volume
            const configVolume = lavalinkConfig.playerOptions?.volume || 100;
            await player.setGlobalVolume(configVolume);

            console.log(`[Lavalink] ✅ Player created successfully for guild ${guildId}`);
            console.log(`[Lavalink] Setting up player event logging for debugging...`);

            player.on('start', () => {
                console.log(`[Lavalink] PLAYER EVENT: start fired for guild ${guildId}`);
            });

            player.on('end', (data) => {
                console.log(`[Lavalink] PLAYER EVENT: end fired for guild ${guildId}, reason:`, data?.reason);
            });

            player.on('exception', (data) => {
                console.log(`[Lavalink] PLAYER EVENT: exception fired for guild ${guildId}`, data);
            });

            player.on('stuck', (data) => {
                console.log(`[Lavalink] PLAYER EVENT: stuck fired for guild ${guildId}, data:`, data);
            });

            player.on('update', (data) => {
                console.log(`[Lavalink] PLAYER EVENT: update fired for guild ${guildId}`);
            });

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

            console.log(`[Lavalink] Raw result:`, {
                loadType: result?.loadType,
                hasData: !!result?.data,
                dataType: typeof result?.data,
                isArray: Array.isArray(result?.data),
                trackCount: result?.data?.tracks?.length || (Array.isArray(result?.data) ? result?.data.length : 0)
            });

            if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                console.log('[Lavalink] YouTube search failed, trying SoundCloud fallback...');
                
                const fallbackQuery = /^https?:\/\//.test(query) 
                    ? query 
                    : `${lavalinkConfig.fallbackSearchPlatform}:${query}`;
                
                console.log(`[Lavalink] Fallback searching: ${fallbackQuery}`);
                result = await node.rest.resolve(fallbackQuery);

                if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                    console.error('[Lavalink] Both YouTube and SoundCloud search failed');
                    throw new Error('NO_RESULTS');
                }

                console.log('[Lavalink] ✅ SoundCloud fallback successful');
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
                console.error('[Lavalink] No valid track found in result');
                console.error('[Lavalink] Result structure:', JSON.stringify(result, null, 2));
                throw new Error('NO_RESULTS');
            }

            console.log(`[Lavalink] ✅ Found track: ${track.info.title} by ${track.info.author}`);
            console.log(`[Lavalink] Track plugin info:`, track.pluginInfo);

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
            console.error(`[Lavalink] ❌ Search failed for: ${searchQuery}`);
            console.error(`[Lavalink] Error:`, error.message);
            console.error(`[Lavalink] Stack:`, error.stack);
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
            console.error('[Lavalink] Cannot search playlist: Shoukaku not initialized');
            throw new Error('Shoukaku not initialized');
        }

        if (!this.isReady) {
            console.error('[Lavalink] Cannot search playlist: Lavalink not ready');
            throw new Error('Lavalink not ready');
        }

        let searchQuery = query;
        if (!/^https?:\/\//.test(query)) {
            searchQuery = `${lavalinkConfig.defaultSearchPlatform}:${query}`;
        }

        console.log(`[Lavalink] Searching playlist: ${searchQuery}`);

        const node = [...this.shoukaku.nodes.values()].find(n => n.state === 2);

        if (!node) {
            console.error('[Lavalink] No available nodes');
            throw new Error('No available nodes');
        }

        try {
            let result = await node.rest.resolve(searchQuery);

            console.log(`[Lavalink] Playlist result:`, {
                loadType: result?.loadType,
                isPlaylist: result?.loadType === 'playlist',
                trackCount: result?.data?.tracks?.length || 0
            });

            if (!result || result.loadType === 'error' || result.loadType === 'empty') {
                console.log(`[Lavalink] ${lavalinkConfig.defaultSearchPlatform} playlist search failed, trying fallback search without platform prefix...`);
                
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

                console.log(`[Lavalink] ✅ Found playlist: ${playlistData.info.name} with ${tracks.length} tracks`);

                return {
                    playlistName: playlistData.info.name,
                    tracks: tracks
                };
            }

            throw new Error('NOT_A_PLAYLIST');

        } catch (error) {
            console.error(`[Lavalink] ❌ Playlist search failed for: ${searchQuery}`);
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