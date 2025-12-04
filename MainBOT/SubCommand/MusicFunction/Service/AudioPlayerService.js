const { AudioPlayerStatus } = require("@discordjs/voice");
const queueRepository = require('../Repository/QueueRepository');
const trackRepository = require('../Repository/TrackRepository');
const voiceConnectionRepository = require('../Repository/VoiceConnectionRepository');

class AudioPlayerService {
    play(queue, resource) {
        if (!queue.player) {
            throw new Error('Player not initialized');
        }
        queue.player.play(resource);
    }

    stop(queue, force = false) {
        if (queue.player) {
            queue.player.stop(force);
        }
    }

    pause(queue) {
        if (queue.player && queue.player.state.status === AudioPlayerStatus.Playing) {
            queue.player.pause();
            return true;
        }
        return false;
    }

    unpause(queue) {
        if (queue.player && queue.player.state.status === AudioPlayerStatus.Paused) {
            queue.player.unpause();
            return true;
        }
        return false;
    }

    isPaused(queue) {
        return queue.player?.state.status === AudioPlayerStatus.Paused;
    }

    isPlaying(queue) {
        return queue.player?.state.status === AudioPlayerStatus.Playing;
    }

    isIdle(queue) {
        return queue.player?.state.status === AudioPlayerStatus.Idle;
    }

    getStatus(queue) {
        return queue.player?.state.status || AudioPlayerStatus.Idle;
    }

    setVolume(queue, volume) {
        queue.volume = Math.max(0.0, Math.min(2.0, Math.round(volume * 10) / 10));
        const resource = queue.player?._state?.resource;
        if (resource?.volume) {
            resource.volume.setVolume(queue.volume);
        }
        return queue.volume;
    }

    getVolume(queue) {
        return queue.volume;
    }

    adjustVolume(queue, delta) {
        const newVolume = queue.volume + delta;
        return this.setVolume(queue, newVolume);
    }

    bindEvents(queue, guildId, eventHandlers) {
        if (queue._eventsBound) {
            return;
        }

        queue._eventsBound = true;

        if (eventHandlers.onIdle) {
            queue.player.on(AudioPlayerStatus.Idle, () => eventHandlers.onIdle(guildId));
        }

        if (eventHandlers.onPlaying) {
            queue.player.on(AudioPlayerStatus.Playing, () => eventHandlers.onPlaying(guildId));
        }

        if (eventHandlers.onPaused) {
            queue.player.on(AudioPlayerStatus.Paused, () => eventHandlers.onPaused(guildId));
        }

        if (eventHandlers.onError) {
            queue.player.on("error", (error) => eventHandlers.onError(guildId, error));
        }
    }

    removeAllListeners(queue) {
        if (queue.player) {
            queue.player.removeAllListeners();
        }
    }

    killYtdlpProcess(queue) {
        if (queue.currentYtdlpProcess) {
            try {
                queue.currentYtdlpProcess.kill('SIGKILL');
                console.log('[AudioPlayerService] Killed yt-dlp process');
            } catch (e) {
                console.error('[AudioPlayerService] Error killing process:', e.message);
            }
            queue.currentYtdlpProcess = null;
        }
    }

    setYtdlpProcess(queue, process) {
        queue.currentYtdlpProcess = process;
    }

    getCurrentResource(queue) {
        return queue.player?._state?.resource || null;
    }
}

module.exports = new AudioPlayerService();