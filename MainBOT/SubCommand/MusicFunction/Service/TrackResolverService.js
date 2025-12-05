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