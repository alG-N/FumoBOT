/**
 * Player Service
 * High-level player control operations
 */

const config = require('../config/music.config');
const queueService = require('./queue.service');
const logger = require('../utils/logger.util');

class PlayerService {
    constructor(lavalinkService) {
        this.lavalink = lavalinkService;
    }

    /**
     * Play track in guild
     */
    async play(guildId, voiceChannelId, textChannelId, track) {
        try {
            const player = this.lavalink.createPlayer(guildId, voiceChannelId, textChannelId);

            if (!player.voiceChannel) {
                player.connect();
            }

            player.queue.add(track);

            if (!player.playing && !player.paused) {
                player.play();
            }

            return { success: true, player };
        } catch (error) {
            logger.error('Play error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Play multiple tracks
     */
    async playTracks(guildId, voiceChannelId, textChannelId, tracks) {
        try {
            const player = this.lavalink.createPlayer(guildId, voiceChannelId, textChannelId);

            if (!player.voiceChannel) {
                player.connect();
            }

            player.queue.add(tracks);

            if (!player.playing && !player.paused) {
                player.play();
            }

            return { success: true, player, added: tracks.length };
        } catch (error) {
            logger.error('Play tracks error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Pause playback
     */
    pause(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        player.pause(true);
        return true;
    }

    /**
     * Resume playback
     */
    resume(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        player.pause(false);
        return true;
    }

    /**
     * Stop playback and clear queue
     */
    stop(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        player.queue.clear();
        player.stop();
        player.destroy();
        queueService.cleanup(guildId);
        
        return true;
    }

    /**
     * Skip current track
     */
    skip(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        if (!player.queue.current) {
            throw new Error('NO_CURRENT_TRACK');
        }

        player.stop();
        return true;
    }

    /**
     * Seek to position
     */
    seek(guildId, position) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        if (!player.queue.current) {
            throw new Error('NO_CURRENT_TRACK');
        }

        const duration = player.queue.current.duration;
        if (position < 0 || position > duration) {
            throw new Error('INVALID_POSITION');
        }

        player.seek(position);
        return position;
    }

    /**
     * Set volume
     */
    setVolume(guildId, volume) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        const newVolume = Math.max(
            config.player.minVolume,
            Math.min(config.player.maxVolume, volume)
        );

        player.setVolume(newVolume);
        queueService.setVolume(guildId, newVolume);
        
        return newVolume;
    }

    /**
     * Adjust volume by step
     */
    adjustVolume(guildId, increase = true) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        const currentVolume = player.volume;
        const step = increase ? config.player.volumeStep : -config.player.volumeStep;
        const newVolume = currentVolume + step;

        return this.setVolume(guildId, newVolume);
    }

    /**
     * Toggle loop mode
     */
    toggleLoop(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        player.setTrackRepeat(!player.trackRepeat);
        return player.trackRepeat;
    }

    /**
     * Toggle queue loop mode
     */
    toggleQueueLoop(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        player.setQueueRepeat(!player.queueRepeat);
        return player.queueRepeat;
    }

    /**
     * Shuffle queue
     */
    shuffle(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            throw new Error('NO_PLAYER');
        }

        if (player.queue.size === 0) {
            throw new Error('QUEUE_EMPTY');
        }

        const current = player.queue.current;
        const queue = [...player.queue];
        
        // Fisher-Yates shuffle
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        player.queue.clear();
        player.queue.add(queue);
        
        return queue.length;
    }

    /**
     * Get current track
     */
    getCurrentTrack(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            return null;
        }
        return player.queue.current;
    }

    /**
     * Get player state
     */
    getPlayerState(guildId) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            return null;
        }

        return {
            playing: player.playing,
            paused: player.paused,
            volume: player.volume,
            position: player.position,
            queue: player.queue.size,
            current: player.queue.current,
            trackRepeat: player.trackRepeat,
            queueRepeat: player.queueRepeat,
        };
    }

    /**
     * Check if user is in same voice channel as bot
     */
    isInSameVoiceChannel(guildId, userId, guild) {
        const player = this.lavalink.getPlayer(guildId);
        if (!player) {
            return false;
        }

        const member = guild.members.cache.get(userId);
        if (!member || !member.voice.channelId) {
            return false;
        }

        return member.voice.channelId === player.voiceChannel;
    }

    /**
     * Start inactivity timer
     */
    startInactivityTimer(guildId, channel) {
        const queue = queueService.getQueue(guildId);
        
        if (queue.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
        }

        queue.inactivityTimer = setTimeout(async () => {
            logger.info(`Inactivity timeout for guild ${guildId}`);
            
            try {
                this.stop(guildId);
                if (channel) {
                    await channel.send('🛑 Disconnected due to inactivity.');
                }
            } catch (error) {
                logger.error('Inactivity timer error:', error);
            }
        }, config.player.inactivityTimeout);
    }

    /**
     * Clear inactivity timer
     */
    clearInactivityTimer(guildId) {
        const queue = queueService.getQueue(guildId);
        
        if (queue.inactivityTimer) {
            clearTimeout(queue.inactivityTimer);
            queue.inactivityTimer = null;
        }
    }

    /**
     * Monitor voice channel for users
     */
    monitorVoiceChannel(guildId, guild, channel) {
        const queue = queueService.getQueue(guildId);
        
        if (queue.vcMonitor) {
            clearInterval(queue.vcMonitor);
        }

        queue.vcMonitor = setInterval(async () => {
            const player = this.lavalink.getPlayer(guildId);
            if (!player) {
                clearInterval(queue.vcMonitor);
                queue.vcMonitor = null;
                return;
            }

            const voiceChannel = guild.channels.cache.get(player.voiceChannel);
            if (!voiceChannel) {
                clearInterval(queue.vcMonitor);
                queue.vcMonitor = null;
                return;
            }

            const listeners = voiceChannel.members.filter(m => !m.user.bot);
            if (listeners.size === 0) {
                logger.info(`No users in VC for guild ${guildId}, disconnecting`);
                this.stop(guildId);
                
                if (channel) {
                    await channel.send('🛑 Disconnected - no users in voice channel.');
                }

                clearInterval(queue.vcMonitor);
                queue.vcMonitor = null;
            }
        }, 60000); // Check every minute
    }
}

module.exports = PlayerService;