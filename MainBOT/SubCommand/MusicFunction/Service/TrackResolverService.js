const lavalinkService = require('./LavalinkService');

class TrackResolverService {
    async resolve(query, user) {
        const result = await lavalinkService.search(query, user);

        if (!result || !result.track) {
            throw new Error('NO_RESULTS');
        }

        return {
            track: result.track,
            url: result.url,
            title: result.title,
            lengthSeconds: result.lengthSeconds,
            thumbnail: result.thumbnail,
            author: result.author,
            requestedBy: user,
            source: result.source
        };
    }

    async resolvePlaylist(query, user) {
        const result = await lavalinkService.searchPlaylist(query, user);

        if (!result || !result.tracks || result.tracks.length === 0) {
            throw new Error('NO_RESULTS');
        }

        return {
            name: result.playlistName,
            tracks: result.tracks,
            trackCount: result.tracks.length
        };
    }

    isPlaylistUrl(query) {
        if (query.includes('youtube.com') && query.includes('list=')) {
            return true;
        }
        if (query.includes('spotify.com/playlist/')) {
            return true;
        }
        return false;
    }

    isLongTrack(trackData, maxDuration) {
        return trackData.lengthSeconds > maxDuration;
    }

    validateTrack(trackData) {
        if (!trackData.url || !trackData.title) {
            throw new Error('INVALID_TRACK_DATA');
        }
        return true;
    }
}

module.exports = new TrackResolverService();