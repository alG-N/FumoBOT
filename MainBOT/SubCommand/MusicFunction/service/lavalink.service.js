/**
 * Lavalink Service
 * Manages Lavalink connection and player operations
 */

const { Manager } = require('erela.js');
const config = require('../config/music.config');
const logger = require('../utils/logger.util');

class LavalinkService {
    constructor(client) {
        this.client = client;
        this.manager = null;
    }

    /**
     * Initialize Lavalink manager
     */
    initialize() {
        this.manager = new Manager({
            nodes: config.lavalink.nodes,
            send: (id, payload) => {
                const guild = this.client.guilds.cache.get(id);
                if (guild) guild.shard.send(payload);
            },
            autoPlay: true,
        });

        this.setupEventListeners();
        return this;
    }

    /**
     * Setup manager event listeners
     */
    setupEventListeners() {
        this.manager
            .on('nodeConnect', node => {
                logger.info(`Lavalink node "${node.options.id}" connected`);
            })
            .on('nodeError', (node, error) => {
                logger.error(`Lavalink node "${node.options.id}" error:`, error);
            })
            .on('nodeDisconnect', (node, reason) => {
                logger.warn(`Lavalink node "${node.options.id}" disconnected:`, reason);
            })
            .on('nodeReconnect', node => {
                logger.info(`Lavalink node "${node.options.id}" reconnecting...`);
            })
            .on('trackStart', (player, track) => {
                logger.debug(`Track started in guild ${player.guild}: ${track.title}`);
            })
            .on('trackEnd', (player, track) => {
                logger.debug(`Track ended in guild ${player.guild}: ${track.title}`);
            })
            .on('queueEnd', player => {
                logger.debug(`Queue ended in guild ${player.guild}`);
                const channel = this.client.channels.cache.get(player.textChannel);
                if (channel) {
                    channel.send('✅ Queue finished - all songs have been played.');
                }
            })
            .on('playerMove', (player, oldChannel, newChannel) => {
                if (!newChannel) {
                    player.destroy();
                    logger.info(`Player destroyed - bot removed from VC in guild ${player.guild}`);
                }
            })
            .on('playerDisconnect', player => {
                player.destroy();
                logger.info(`Player disconnected in guild ${player.guild}`);
            });
    }

    /**
     * Create or get existing player
     */
    createPlayer(guildId, voiceChannelId, textChannelId) {
        let player = this.manager.players.get(guildId);

        if (!player) {
            player = this.manager.create({
                guild: guildId,
                voiceChannel: voiceChannelId,
                textChannel: textChannelId,
                selfDeafen: true,
                volume: config.player.defaultVolume,
            });
        }

        return player;
    }

    /**
     * Search for tracks
     */
    async search(query, requester) {
        try {
            // Check if it's a URL
            const urlPattern = /^https?:\/\//;
            const searchQuery = urlPattern.test(query) 
                ? query 
                : `${config.lavalink.defaultSearchPlatform}:${query}`;

            const result = await this.manager.search(searchQuery, requester);

            if (result.loadType === 'NO_MATCHES' || !result.tracks.length) {
                return { success: false, error: 'NO_RESULTS' };
            }

            return {
                success: true,
                tracks: result.tracks,
                playlist: result.loadType === 'PLAYLIST_LOADED' ? result.playlist : null,
            };
        } catch (error) {
            logger.error('Search error:', error);
            return { success: false, error: 'SEARCH_ERROR' };
        }
    }

    /**
     * Get player for a guild
     */
    getPlayer(guildId) {
        return this.manager.players.get(guildId);
    }

    /**
     * Destroy player
     */
    destroyPlayer(guildId) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.destroy();
            logger.info(`Player destroyed for guild ${guildId}`);
        }
    }

    /**
     * Connect to Discord voice gateway
     */
    init() {
        this.manager.init(this.client.user.id);
    }
}

module.exports = LavalinkService;