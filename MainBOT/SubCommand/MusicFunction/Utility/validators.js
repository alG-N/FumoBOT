class Validators {
    constructor() {
        // Pre-compile regex patterns for better performance
        this._youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
        this._idRegex = /^\d{17,19}$/;
    }

    isValidUrl(url) {
        if (!url || typeof url !== 'string') return false;
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isYouTubeUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return this._youtubeRegex.test(url);
    }

    isValidTrack(track) {
        return !!(track && 
               typeof track.url === 'string' && 
               typeof track.title === 'string' && 
               typeof track.lengthSeconds === 'number' &&
               track.track?.encoded);
    }

    isValidQueue(queue) {
        return !!(queue && Array.isArray(queue.tracks));
    }

    isValidDuration(seconds, maxSeconds) {
        return typeof seconds === 'number' && 
               seconds > 0 && 
               seconds <= maxSeconds;
    }

    isInVoiceChannel(member) {
        return !!(member?.voice?.channel);
    }

    isInSameVoiceChannel(member, botChannelId) {
        return member?.voice?.channelId === botChannelId;
    }

    hasVoicePermissions(channel) {
        if (!channel) return false;
        
        const permissions = channel.permissionsFor(channel.guild?.members?.me);
        return !!(permissions?.has(['Connect', 'Speak', 'ViewChannel']));
    }

    isValidVolume(volume) {
        return typeof volume === 'number' && 
               volume >= 0 && 
               volume <= 200;
    }

    isValidGuildId(guildId) {
        return typeof guildId === 'string' && 
               this._idRegex.test(guildId);
    }

    isValidUserId(userId) {
        return typeof userId === 'string' && 
               this._idRegex.test(userId);
    }

    // Helper to validate track has required playback data
    canPlayTrack(track) {
        return !!(track?.track?.encoded);
    }
}

module.exports = new Validators();