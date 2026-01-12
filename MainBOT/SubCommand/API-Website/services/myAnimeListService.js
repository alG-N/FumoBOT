/**
 * MyAnimeList Service
 * Handles all API interactions with MyAnimeList using Jikan API v4
 */

const fetch = require('node-fetch');

// Jikan API v4 (unofficial MAL API)
const JIKAN_BASE = 'https://api.jikan.moe/v4';

// Media type configurations
const MEDIA_TYPE_CONFIG = {
    anime: { endpoint: 'anime', typeFilter: null },
    manga: { endpoint: 'manga', typeFilter: 'manga' },
    lightnovel: { endpoint: 'manga', typeFilter: 'lightnovel' },
    webnovel: { endpoint: 'manga', typeFilter: 'webnovel' }, // May have limited results
    oneshot: { endpoint: 'manga', typeFilter: 'oneshot' }
};

class MyAnimeListService {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 300000; // 5 minutes
        this.maxCacheSize = 100;
        this.rateLimitDelay = 400; // Jikan has rate limiting
        this.lastRequest = 0;
    }

    async _rateLimitedFetch(url) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.rateLimitDelay) {
            await new Promise(r => setTimeout(r, this.rateLimitDelay - timeSinceLastRequest));
        }
        
        this.lastRequest = Date.now();
        return fetch(url, {
            headers: {
                'User-Agent': 'FumoBOT Discord Bot',
                'Accept': 'application/json'
            },
            timeout: 10000
        });
    }

    /**
     * Search media by name (anime, manga, lightnovel, etc.)
     */
    async searchMedia(query, mediaType = 'anime') {
        const config = MEDIA_TYPE_CONFIG[mediaType] || MEDIA_TYPE_CONFIG.anime;
        const cacheKey = `search_${mediaType}_${query.toLowerCase()}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            let url = `${JIKAN_BASE}/${config.endpoint}?q=${encodeURIComponent(query)}&limit=1`;
            if (config.typeFilter) {
                url += `&type=${config.typeFilter}`;
            }
            
            const response = await this._rateLimitedFetch(url);
            
            if (!response.ok) {
                throw new Error(`MAL API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.data || data.data.length === 0) {
                return null;
            }
            
            const media = config.endpoint === 'manga' 
                ? this._transformMangaData(data.data[0], mediaType)
                : this._transformAnimeData(data.data[0]);
            this._setCache(cacheKey, media);
            
            return media;
        } catch (error) {
            console.error('[MAL Search Error]', error.message);
            return null;
        }
    }

    /**
     * Search anime by name (legacy support)
     */
    async searchAnime(query) {
        return this.searchMedia(query, 'anime');
    }

    /**
     * Search media for autocomplete (returns multiple results)
     */
    async searchMediaAutocomplete(query, mediaType = 'anime', limit = 10) {
        const config = MEDIA_TYPE_CONFIG[mediaType] || MEDIA_TYPE_CONFIG.anime;
        
        try {
            let url = `${JIKAN_BASE}/${config.endpoint}?q=${encodeURIComponent(query)}&limit=${limit}&sfw=true`;
            if (config.typeFilter) {
                url += `&type=${config.typeFilter}`;
            }
            
            const response = await this._rateLimitedFetch(url);
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            return (data.data || []).map(item => ({
                id: item.mal_id,
                title: {
                    romaji: item.title,
                    english: item.title_english,
                    japanese: item.title_japanese
                },
                format: item.type,
                status: this._mapStatus(item.status),
                seasonYear: item.year || (item.published?.from ? new Date(item.published.from).getFullYear() : null),
                startYear: item.published?.from ? new Date(item.published.from).getFullYear() : item.year,
                averageScore: item.score ? Math.round(item.score * 10) : null
            }));
        } catch (error) {
            console.error('[MAL Autocomplete Error]', error.message);
            return [];
        }
    }

    /**
     * Search anime for autocomplete (legacy support)
     */
    async searchAnimeAutocomplete(query, limit = 10) {
        return this.searchMediaAutocomplete(query, 'anime', limit);
    }

    /**
     * Get anime by ID
     */
    async getAnimeById(malId) {
        const cacheKey = `anime_${malId}`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        try {
            const response = await this._rateLimitedFetch(
                `${JIKAN_BASE}/anime/${malId}/full`
            );
            
            if (!response.ok) return null;
            
            const data = await response.json();
            const anime = this._transformAnimeData(data.data);
            this._setCache(cacheKey, anime);
            
            return anime;
        } catch (error) {
            console.error('[MAL GetById Error]', error.message);
            return null;
        }
    }

    /**
     * Transform Jikan data to match AniList format
     */
    _transformAnimeData(data) {
        return {
            id: data.mal_id,
            source: 'mal', // Mark as MAL source
            title: {
                romaji: data.title,
                english: data.title_english,
                native: data.title_japanese
            },
            coverImage: {
                large: data.images?.jpg?.large_image_url || data.images?.jpg?.image_url,
                color: null
            },
            description: data.synopsis,
            episodes: data.episodes,
            averageScore: data.score ? Math.round(data.score * 10) : null,
            popularity: data.members,
            format: data.type,
            season: data.season?.toUpperCase(),
            seasonYear: data.year,
            status: this._mapStatus(data.status),
            source: data.source,
            genres: data.genres?.map(g => g.name) || [],
            duration: data.duration ? parseInt(data.duration) : null,
            startDate: data.aired?.from ? this._parseDate(data.aired.from) : null,
            endDate: data.aired?.to ? this._parseDate(data.aired.to) : null,
            rankings: data.rank ? [{ rank: data.rank, type: 'RATED', allTime: true }] : [],
            characters: {
                edges: [] // Would need separate API call
            },
            relations: {
                edges: (data.relations || []).flatMap(rel => 
                    rel.entry.map(e => ({
                        relationType: rel.relation.toUpperCase().replace(/ /g, '_'),
                        node: {
                            id: e.mal_id,
                            title: { romaji: e.name, english: null },
                            type: e.type?.toUpperCase()
                        }
                    }))
                )
            },
            studios: {
                nodes: (data.studios || []).map(s => ({ name: s.name }))
            },
            trailer: data.trailer?.youtube_id ? {
                id: data.trailer.youtube_id,
                site: 'youtube'
            } : null,
            siteUrl: data.url,
            nextAiringEpisode: null, // MAL doesn't provide this directly
            malId: data.mal_id,
            score: data.score,
            scoredBy: data.scored_by,
            rank: data.rank,
            popularity_rank: data.popularity,
            members: data.members,
            favorites: data.favorites,
            rating: data.rating,
            broadcast: data.broadcast?.string,
            mediaType: 'anime'
        };
    }

    /**
     * Transform Jikan manga data
     */
    _transformMangaData(data, mediaType = 'manga') {
        return {
            id: data.mal_id,
            source: 'mal',
            mediaType: mediaType, // manga, lightnovel, webnovel, oneshot
            title: {
                romaji: data.title,
                english: data.title_english,
                native: data.title_japanese
            },
            coverImage: {
                large: data.images?.jpg?.large_image_url || data.images?.jpg?.image_url,
                color: null
            },
            description: data.synopsis,
            chapters: data.chapters,
            volumes: data.volumes,
            averageScore: data.score ? Math.round(data.score * 10) : null,
            popularity: data.members,
            format: data.type, // Manga, Light Novel, One-shot, etc.
            status: this._mapMangaStatus(data.status),
            genres: data.genres?.map(g => g.name) || [],
            themes: data.themes?.map(t => t.name) || [],
            demographics: data.demographics?.map(d => d.name) || [],
            startDate: data.published?.from ? this._parseDate(data.published.from) : null,
            endDate: data.published?.to ? this._parseDate(data.published.to) : null,
            authors: data.authors?.map(a => ({
                name: a.name,
                role: a.type // Author, Story, Art, etc.
            })) || [],
            serialization: data.serializations?.map(s => s.name) || [],
            relations: {
                edges: (data.relations || []).flatMap(rel => 
                    rel.entry.map(e => ({
                        relationType: rel.relation.toUpperCase().replace(/ /g, '_'),
                        node: {
                            id: e.mal_id,
                            title: { romaji: e.name, english: null },
                            type: e.type?.toUpperCase()
                        }
                    }))
                )
            },
            siteUrl: data.url,
            malId: data.mal_id,
            score: data.score,
            scoredBy: data.scored_by,
            rank: data.rank,
            popularity_rank: data.popularity,
            members: data.members,
            favorites: data.favorites
        };
    }

    _mapMangaStatus(status) {
        const statusMap = {
            'Finished': 'FINISHED',
            'Publishing': 'RELEASING',
            'On Hiatus': 'HIATUS',
            'Discontinued': 'CANCELLED',
            'Not yet published': 'NOT_YET_RELEASED'
        };
        return statusMap[status] || status;
    }

    _mapStatus(status) {
        const statusMap = {
            'Finished Airing': 'FINISHED',
            'Currently Airing': 'RELEASING',
            'Not yet aired': 'NOT_YET_RELEASED'
        };
        return statusMap[status] || status;
    }

    _parseDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate()
        };
    }

    // Cache management
    _getFromCache(key) {
        const entry = this.cache.get(key);
        if (!entry || Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    _setCache(key, data) {
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.cacheExpiry
        });
    }
}

module.exports = new MyAnimeListService();
