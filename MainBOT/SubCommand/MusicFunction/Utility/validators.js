class Validators {
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    isYouTubeUrl(url) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
    }

    isValidTrack(track) {
        return track && 
               typeof track.url === 'string' && 
               typeof track.title === 'string' && 
               typeof track.lengthSeconds === 'number';
    }

    isValidQueue(queue) {
        return queue && 
               Array.isArray(queue.tracks) && 
               typeof queue.current === 'object';
    }

    isValidDuration(seconds, maxSeconds) {
        return typeof seconds === 'number' && 
               seconds > 0 && 
               seconds <= maxSeconds;
    }

    isInVoiceChannel(member) {
        return member?.voice?.channel != null;
    }

    isInSameVoiceChannel(member, botChannelId) {
        return member?.voice?.channelId === botChannelId;
    }

    hasVoicePermissions(channel) {
        if (!channel) return false;
        
        const permissions = channel.permissionsFor(channel.guild.members.me);
        return permissions?.has(['Connect', 'Speak', 'ViewChannel']);
    }

    isValidVolume(volume) {
        return typeof volume === 'number' && 
               volume >= 0 && 
               volume <= 2;
    }

    isValidGuildId(guildId) {
        return typeof guildId === 'string' && 
               /^\d{17,19}$/.test(guildId);
    }

    isValidUserId(userId) {
        return typeof userId === 'string' && 
               /^\d{17,19}$/.test(userId);
    }
}

module.exports = new Validators();