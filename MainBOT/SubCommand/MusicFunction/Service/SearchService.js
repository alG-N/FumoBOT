const ytSearch = require("yt-search");
const ytsr = require("ytsr");
const { MAX_SEARCH_RESULTS } = require('../Configuration/searchConfig');
const rankingAlgorithm = require('../Utility/rankingAlgorithm');
const { parseDuration } = require('../Utility/formatters');

class SearchService {
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    isYouTubeUrl(query) {
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(query);
    }

    async searchByUrl(url) {
        try {
            console.log("[SearchService] URL detected, using yt-search");
            const videoId = this.extractVideoId(url);
            const info = await ytSearch({ videoId });

            return {
                url: info.url,
                title: info.title,
                lengthSeconds: info.seconds,
                thumbnail: info.thumbnail,
                author: info.author.name,
                views: info.views || null,
                searchInfo: "URL",
                source: "YouTube (yt-search)"
            };
        } catch (e) {
            console.log(`[SearchService] yt-search URL failed: ${e.message}`);
            throw new Error("INVALID_URL");
        }
    }

    async searchByQuery(query, forceAlt = false) {
        let searchQuery = forceAlt ? query + " music" : query + " song";

        try {
            console.log(`[SearchService] Searching: ${searchQuery}`);
            const ytResult = await ytSearch(searchQuery);

            if (ytResult && ytResult.videos.length > 0) {
                const rankedVideos = rankingAlgorithm.rankResults(ytResult.videos.slice(0, MAX_SEARCH_RESULTS), query);
                const vid = rankedVideos[0];

                console.log(`[SearchService] Top 3 ranked results:`);
                rankedVideos.slice(0, 3).forEach((v, i) => {
                    console.log(`  ${i + 1}. [Score: ${v._searchScore.toFixed(0)}] ${v.title}`);
                    console.log(`      Views: ${v.views} | Duration: ${v.seconds}s | Author: ${v.author.name}`);
                });

                return {
                    url: vid.url,
                    title: vid.title,
                    lengthSeconds: vid.seconds,
                    thumbnail: vid.thumbnail,
                    author: vid.author.name || vid.author,
                    views: vid.views || null,
                    searchInfo: `${query} - Based: Music (Ranked)`,
                    source: "YouTube (yt-search)"
                };
            }
        } catch (e) {
            console.log(`[SearchService] yt-search "${searchQuery}" failed: ${e.message}`);
        }

        if (!forceAlt) {
            try {
                console.log(`[SearchService] Fallback search: ${query} (by popularity)`);
                const ytResult = await ytSearch(query);

                if (ytResult && ytResult.videos.length > 0) {
                    const rankedVideos = rankingAlgorithm.rankResults(ytResult.videos.slice(0, MAX_SEARCH_RESULTS), query);
                    const vid = rankedVideos[0];

                    console.log(`[SearchService] Top 3 ranked results (popularity):`);
                    rankedVideos.slice(0, 3).forEach((v, i) => {
                        console.log(`  ${i + 1}. [Score: ${v._searchScore.toFixed(0)}] ${v.title}`);
                        console.log(`      Views: ${v.views} | Duration: ${v.seconds}s | Author: ${v.author.name}`);
                    });

                    return {
                        url: vid.url,
                        title: vid.title,
                        lengthSeconds: vid.seconds,
                        thumbnail: vid.thumbnail,
                        author: vid.author.name || vid.author,
                        views: vid.views || null,
                        searchInfo: `${query} - Based: Popularity (Ranked)`,
                        source: "YouTube (yt-search)"
                    };
                }
            } catch (e2) {
                console.log(`[SearchService] Popularity search failed: ${e2.message}`);
            }
        }

        return await this.searchWithYtsr(query);
    }

    async searchWithYtsr(query) {
        try {
            console.log(`[SearchService] Last resort: ytsr for ${query}`);
            const filters = await ytsr.getFilters(query);
            const filter = filters.get("Type").get("Video");
            const searchResults = await ytsr(filter.url, { limit: MAX_SEARCH_RESULTS });

            if (!searchResults.items.length) {
                throw new Error("NO_RESULTS");
            }

            const videos = searchResults.items.filter(item => item.type === 'video');
            const rankedVideos = rankingAlgorithm.rankResults(videos, query);
            const vid = rankedVideos[0];

            console.log(`[SearchService] Top 3 ranked ytsr results:`);
            rankedVideos.slice(0, 3).forEach((v, i) => {
                console.log(`  ${i + 1}. [Score: ${v._searchScore.toFixed(0)}] ${v.title}`);
                console.log(`      Views: ${v.views} | Duration: ${v.duration} | Author: ${v.author?.name}`);
            });

            return {
                url: vid.url,
                title: vid.title,
                lengthSeconds: vid.duration ? parseDuration(vid.duration) : 0,
                thumbnail: vid.bestThumbnail?.url || vid.thumbnails?.[0]?.url,
                author: vid.author?.name || "Unknown",
                views: vid.views || null,
                searchInfo: `${query} - Based: Video (Ranked)`,
                source: "YouTube (ytsr)"
            };
        } catch (e3) {
            console.log(`[SearchService] ytsr failed: ${e3.message}`);
            throw new Error("NO_RESULTS");
        }
    }

    async search(query) {
        if (this.isYouTubeUrl(query)) {
            return await this.searchByUrl(query);
        } else {
            return await this.searchByQuery(query);
        }
    }
}

module.exports = new SearchService();