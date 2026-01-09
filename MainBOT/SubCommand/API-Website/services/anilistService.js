const { GraphQLClient, gql } = require('graphql-request');

class AnilistService {
    constructor() {
        this.client = new GraphQLClient('https://graphql.anilist.co');
    }

    async searchAnime(searchTerm) {
        const query = gql`
            query ($search: String) {
                Media(search: $search, type: ANIME) {
                    id
                    title { romaji english native }
                    coverImage { large color }
                    description(asHtml: false)
                    episodes
                    averageScore
                    popularity
                    format
                    season
                    seasonYear
                    status
                    source
                    genres
                    duration
                    startDate { year month day }
                    endDate { year month day }
                    rankings { rank allTime type context }
                    characters(sort: [ROLE, RELEVANCE], perPage: 5) {
                        edges { node { name { full } } }
                    }
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                type
                                status
                                averageScore
                            }
                        }
                    }
                    studios { nodes { name } }
                    trailer { id site }
                    siteUrl
                    nextAiringEpisode { episode airingAt timeUntilAiring }
                }
            }
        `;

        try {
            const data = await this.client.request(query, { search: searchTerm });
            return data.Media;
        } catch (error) {
            console.error('[AniList Search Error]', error.message);
            return null;
        }
    }

    async searchAnimeAutocomplete(searchTerm, limit = 10) {
        const query = gql`
            query ($search: String, $perPage: Int) {
                Page(page: 1, perPage: $perPage) {
                    media(search: $search, type: ANIME, sort: [POPULARITY_DESC]) {
                        id
                        title { romaji english native }
                        format
                        status
                        seasonYear
                        averageScore
                    }
                }
            }
        `;

        try {
            const data = await this.client.request(query, { search: searchTerm, perPage: limit });
            return data.Page?.media || [];
        } catch (error) {
            console.error('[AniList Autocomplete Error]', error.message);
            return [];
        }
    }

    async getAnimeById(id) {
        const query = gql`
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    title { romaji english native }
                    coverImage { large color }
                    status
                    nextAiringEpisode { episode airingAt timeUntilAiring }
                    episodes
                    relations {
                        edges {
                            relationType
                            node {
                                id
                                title { romaji english }
                                status
                            }
                        }
                    }
                }
            }
        `;

        try {
            const data = await this.client.request(query, { id });
            return data.Media;
        } catch (error) {
            console.error('[AniList GetById Error]', error.message);
            return null;
        }
    }

    async findNextOngoingSeason(animeId) {
        let currentId = animeId;
        const maxIterations = 10;
        let iterations = 0;

        while (iterations < maxIterations) {
            iterations++;
            const media = await this.getAnimeById(currentId);

            if (!media) return null;
            if (media.status === 'RELEASING') return media;

            const sequel = media.relations?.edges?.find(e => e.relationType === 'SEQUEL');
            if (!sequel) return null;

            currentId = sequel.node.id;
        }

        return null;
    }

    formatDuration(minutes) {
        if (!minutes) return 'N/A';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    getRecommendation(score) {
        if (score >= 85) return '🔥 Must Watch';
        if (score >= 70) return '👍 Good';
        if (score >= 55) return '👌 Decent';
        return '😬 Skip or Unknown';
    }

    truncate(str, max = 1000) {
        if (!str) return '';
        return str.length > max ? str.slice(0, max) + '...' : str;
    }

    formatDate(dateObj) {
        if (!dateObj?.year) return 'Unknown';
        const day = dateObj.day || '?';
        const month = dateObj.month || '?';
        return `${day}/${month}/${dateObj.year}`;
    }

    formatCountdown(seconds) {
        if (seconds <= 0) return 'Airing now';
        const days = Math.floor(seconds / (60 * 60 * 24));
        const hours = Math.floor((seconds % (60 * 60 * 24)) / (60 * 60));
        const mins = Math.floor((seconds % (60 * 60)) / 60);
        return `${days}d ${hours}h ${mins}m`;
    }

    getTrailerUrl(trailer) {
        if (!trailer?.site || !trailer?.id) return 'None';

        const site = trailer.site.toLowerCase();
        if (site === 'youtube') {
            return `[Watch Trailer](https://www.youtube.com/watch?v=${trailer.id})`;
        } else if (site === 'dailymotion') {
            return `[Watch Trailer](https://www.dailymotion.com/video/${trailer.id})`;
        }

        return 'None';
    }

    formatRelatedEntries(edges) {
        if (!edges || edges.length === 0) return 'No other seasons or movies available.';

        const seen = new Set();
        const list = [];

        for (const rel of edges) {
            if (!['ANIME', 'MOVIE'].includes(rel.node?.type)) continue;

            const key = rel.node.title?.romaji;
            if (!key || seen.has(key)) continue;

            seen.add(key);
            const typeLabel = rel.node.type === 'ANIME' ? '[TV]' : `[${rel.node.type}]`;
            const score = rel.node.averageScore || '?';
            const recommendation = this.getRecommendation(rel.node.averageScore || 0);

            list.push(`${typeLabel} ${key} - Score: ${score} - ${recommendation}`);
        }

        return list.length > 0 ? list.join('\n') : 'No other seasons or movies available.';
    }
}

module.exports = new AnilistService();
