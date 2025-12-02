/**
 * Validation Utility
 * Input validation and checks
 */

const config = require('../config/music.config');

class ValidationUtil {
    /**
     * Check if user is in a voice channel
     */
    static isInVoiceChannel(member) {
        return member.voice?.channel !== null;
    }

    /**
     * Check if bot is in a voice channel
     */
    static isBotInVoiceChannel(guild) {
        return guild.members.me?.voice?.channel !== null;
    }

    /**
     * Check if user is in same voice channel as bot
     */
    static isInSameVoiceChannel(member, guild) {
        const botChannel = guild.members.me?.voice?.channel;
        const userChannel = member.voice?.channel;
        
        if (!botChannel || !userChannel) {
            return false;
        }
        
        return botChannel.id === userChannel.id;
    }

    /**
     * Check if bot has required permissions in voice channel
     */
    static hasVoicePermissions(voiceChannel, guild) {
        const permissions = voiceChannel.permissionsFor(guild.members.me);
        
        return permissions.has(['Connect', 'Speak']);
    }

    /**
     * Validate volume value
     */
    static isValidVolume(volume) {
        return (
            typeof volume === 'number' &&
            volume >= config.player.minVolume &&
            volume <= config.player.maxVolume
        );
    }

    /**
     * Validate seek position
     */
    static isValidPosition(position, duration) {
        return (
            typeof position === 'number' &&
            position >= 0 &&
            position <= duration
        );
    }

    /**
     * Check if track duration is within limits
     */
    static isValidTrackDuration(duration) {
        return duration <= config.player.maxTrackDuration * 1000; // Convert to ms
    }

    /**
     * Check if URL is valid
     */
    static isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Check if string is a YouTube URL
     */
    static isYouTubeUrl(string) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(string);
    }

    /**
     * Check if string is a Spotify URL
     */
    static isSpotifyUrl(string) {
        return /^(https?:\/\/)?(www\.)?open\.spotify\.com\/.+$/.test(string);
    }

    /**
     * Check if queue is full
     */
    static isQueueFull(queueSize) {
        return queueSize >= config.player.maxQueueSize;
    }

    /**
     * Get voice channel from member
     */
    static getVoiceChannel(member) {
        return member.voice?.channel || null;
    }

    /**
     * Create validation error message
     */
    static getErrorMessage(errorType) {
        const messages = {
            NO_VC: '❌ You must be in a voice channel to use this command.',
            NOT_SAME_VC: '❌ You must be in the same voice channel as the bot.',
            NO_PERMISSIONS: '❌ I don\'t have permission to join or speak in that voice channel.',
            NO_PLAYER: '❌ There is no active player in this server.',
            QUEUE_EMPTY: '❌ The queue is empty.',
            QUEUE_FULL: '❌ The queue is full. Please wait for some tracks to finish.',
            INVALID_VOLUME: `❌ Volume must be between ${config.player.minVolume} and ${config.player.maxVolume}.`,
            INVALID_POSITION: '❌ Invalid seek position.',
            TRACK_TOO_LONG: `❌ Track duration exceeds the maximum limit of ${config.player.maxTrackDuration / 60} minutes.`,
            NO_RESULTS: '❌ No results found for your search.',
            SEARCH_ERROR: '❌ An error occurred while searching. Please try again.',
            NO_CURRENT_TRACK: '❌ There is no track currently playing.',
            VOTE_IN_PROGRESS: '⚠️ A skip vote is already in progress.',
            NO_VOTE_IN_PROGRESS: '⚠️ There is no skip vote in progress.',
            ALREADY_VOTED: '⚠️ You have already voted to skip.',
        };

        return messages[errorType] || '❌ An error occurred.';
    }
}

module.exports = ValidationUtil;