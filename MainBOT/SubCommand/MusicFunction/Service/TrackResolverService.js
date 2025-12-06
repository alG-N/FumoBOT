const lavalinkService = require('./LavalinkService');

class TrackResolverService {
    async resolve(query, user) {
        const result = await lavalinkService.search(query, user);

        if (!result || !result.track) {
            throw new Error('NO_RESULTS');
        }

        // Try to fetch view count if not available
        let viewCount = result.viewCount;
        if (!viewCount && result.url) {
            viewCount = await this.fetchViewCount(result.url);
        }

        return {
            track: result.track,
            url: result.url,
            title: result.title,
            lengthSeconds: result.lengthSeconds,
            thumbnail: result.thumbnail,
            author: result.author,
            requestedBy: user,
            source: result.source,
            viewCount: viewCount
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

    async fetchViewCount(url) {
        try {
            // Extract YouTube video ID
            const videoId = this.extractYouTubeId(url);
            if (!videoId) return null;

            console.log(`[TrackResolver] Fetching view count for video: ${videoId}`);

            // Fetch the YouTube page
            const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                console.log(`[TrackResolver] Failed to fetch YouTube page: ${response.status}`);
                return null;
            }

            const html = await response.text();

            // Try multiple patterns to extract view count
            // Pattern 1: viewCount in ytInitialData
            const viewCountMatch1 = html.match(/"viewCount":"(\d+)"/);
            if (viewCountMatch1) {
                const count = parseInt(viewCountMatch1[1]);
                console.log(`[TrackResolver] ✅ Found view count (pattern 1): ${count}`);
                return count;
            }

            // Pattern 2: viewCount in different format
            const viewCountMatch2 = html.match(/"viewCount":\{"simpleText":"([\d,]+) views?"\}/);
            if (viewCountMatch2) {
                const count = parseInt(viewCountMatch2[1].replace(/,/g, ''));
                console.log(`[TrackResolver] ✅ Found view count (pattern 2): ${count}`);
                return count;
            }

            // Pattern 3: Looking for views text
            const viewCountMatch3 = html.match(/"viewCountText":\{"simpleText":"([\d,]+) views?"\}/);
            if (viewCountMatch3) {
                const count = parseInt(viewCountMatch3[1].replace(/,/g, ''));
                console.log(`[TrackResolver] ✅ Found view count (pattern 3): ${count}`);
                return count;
            }

            console.log(`[TrackResolver] ⚠️ Could not find view count in page`);
            return null;

        } catch (error) {
            console.error(`[TrackResolver] Error fetching view count:`, error.message);
            return null;
        }
    }

    extractYouTubeId(url) {
        if (!url) return null;
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/);
        return match ? match[1] : null;
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