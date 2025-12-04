const searchService = require('./SearchService');

class TrackResolverService {
    async resolve(query, user, forceAlt = false) {
        const searchResult = await searchService.search(query);

        return {
            url: searchResult.url,
            title: searchResult.title,
            lengthSeconds: Number(searchResult.lengthSeconds),
            thumbnail: searchResult.thumbnail,
            author: searchResult.author,
            requestedBy: user,
            views: searchResult.views,
            searchInfo: searchResult.searchInfo,
            source: searchResult.source
        };
    }

    createTrackFromData(data, user) {
        return {
            url: data.url,
            title: data.title,
            lengthSeconds: data.lengthSeconds,
            thumbnail: data.thumbnail,
            author: data.author,
            requestedBy: user,
            views: data.views || null,
            searchInfo: data.searchInfo || "Unknown",
            source: data.source || "YouTube"
        };
    }

    isLongTrack(track, maxDuration) {
        return track.lengthSeconds > maxDuration;
    }

    validateTrack(track) {
        if (!track.url || !track.title) {
            throw new Error("INVALID_TRACK_DATA");
        }
        return true;
    }
}

module.exports = new TrackResolverService();