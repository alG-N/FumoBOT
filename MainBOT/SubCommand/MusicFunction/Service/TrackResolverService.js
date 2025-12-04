const lavalinkService = require('./LavalinkService');

class TrackResolverService {
    async resolve(query, user) {
        const result = await lavalinkService.search(query, user);

        if (!result || result.loadType === 'NO_MATCHES') {
            throw new Error('NO_RESULTS');
        }

        if (result.loadType === 'LOAD_FAILED') {
            throw new Error('LOAD_FAILED');
        }

        const track = result.tracks[0];
        
        return {
            track: track,
            url: track.uri,
            title: track.title,
            lengthSeconds: Math.floor(track.duration / 1000),
            thumbnail: track.thumbnail || track.displayThumbnail?.() || null,
            author: track.author,
            requestedBy: user,
            source: track.sourceName || 'YouTube'
        };
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