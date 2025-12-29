const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

class Rule34Service {
    constructor() {
        this.baseUrl = 'https://api.rule34.xxx/index.php';
        this.autocompleteUrl = 'https://api.rule34.xxx/autocomplete.php';
        this.auth = {
            userId: process.env.RULE34_USER_ID || '',
            apiKey: process.env.RULE34_API_KEY || ''
        };
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };
        this.translationCache = new Map();
        
        // Known AI-related tags for filtering
        this.aiTags = [
            'ai_generated', 'ai-generated', 'ai_art', 'ai-art', 
            'stable_diffusion', 'novelai', 'midjourney', 'dalle',
            'ai_assisted', 'nai_diffusion', 'machine_learning',
            'artificial_intelligence', 'ai_created', 'ai_(artwork)'
        ];
        
        // Quality indicator tags
        this.qualityTags = {
            high: ['high_resolution', 'highres', 'absurdres', 'incredibly_absurdres', 'masterpiece', 'best_quality'],
            low: ['low_resolution', 'lowres', 'bad_anatomy', 'bad_proportions', 'poorly_drawn']
        };
        
        // Content type tags
        this.contentTypeTags = {
            animated: ['animated', 'video', 'webm', 'gif', 'animated_gif', 'mp4', 'sound'],
            comic: ['comic', 'manga', 'doujinshi', 'multi-panel', 'page_number'],
            photo: ['photo_(medium)', 'photorealistic', 'realistic', '3d', 'cosplay']
        };
        
        // Rating mappings
        this.ratings = {
            safe: 'safe',
            questionable: 'questionable',
            explicit: 'explicit'
        };
    }

    /**
     * Search for posts with advanced filtering
     */
    async search(query, options = {}) {
        const {
            limit = 50,
            page = 0,
            sort = 'score:desc',
            rating = null,          // 'safe', 'questionable', 'explicit', or null for all
            excludeAi = false,      // Filter out AI-generated content
            minScore = 0,           // Minimum score filter
            contentType = null,     // 'animated', 'comic', 'photo', or null
            excludeTags = [],       // Tags to exclude
            requireTags = [],       // Additional required tags
            minWidth = 0,           // Minimum width
            minHeight = 0,          // Minimum height
            highQualityOnly = false,// Only high quality posts
            excludeLowQuality = false
        } = options;

        // Build tag query
        let searchTags = this._buildSearchQuery(query, {
            rating,
            excludeAi,
            minScore,
            contentType,
            excludeTags,
            requireTags,
            minWidth,
            minHeight,
            highQualityOnly,
            excludeLowQuality,
            sort
        });

        const url = new URL(this.baseUrl);
        url.searchParams.append('page', 'dapi');
        url.searchParams.append('s', 'post');
        url.searchParams.append('q', 'index');
        url.searchParams.append('limit', Math.min(limit, 100).toString());
        url.searchParams.append('pid', page.toString());
        url.searchParams.append('tags', searchTags);
        url.searchParams.append('json', '1');

        // Add API auth if available
        if (this.auth.userId && this.auth.apiKey) {
            url.searchParams.append('user_id', this.auth.userId);
            url.searchParams.append('api_key', this.auth.apiKey);
        }

        console.log(`[Rule34] Searching: "${searchTags}" | Page: ${page} | Limit: ${limit}`);

        try {
            const response = await fetch(url.toString(), { headers: this.headers });
            
            if (!response.ok) {
                throw new Error(`Rule34 API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !Array.isArray(data)) {
                return { posts: [], totalCount: 0, hasMore: false };
            }

            // Post-process results for additional filtering
            let posts = this._processResults(data, {
                excludeAi,
                minScore,
                highQualityOnly,
                excludeLowQuality
            });

            console.log(`[Rule34] Found ${posts.length} posts (pre-filter: ${data.length})`);

            return {
                posts,
                totalCount: data.length,
                hasMore: data.length === limit,
                query: searchTags
            };
        } catch (error) {
            console.error('[Rule34 Search Error]', error);
            throw error;
        }
    }

    /**
     * Get a single post by ID
     */
    async getPostById(id) {
        const url = new URL(this.baseUrl);
        url.searchParams.append('page', 'dapi');
        url.searchParams.append('s', 'post');
        url.searchParams.append('q', 'index');
        url.searchParams.append('id', id.toString());
        url.searchParams.append('json', '1');

        if (this.auth.userId && this.auth.apiKey) {
            url.searchParams.append('user_id', this.auth.userId);
            url.searchParams.append('api_key', this.auth.apiKey);
        }

        try {
            const response = await fetch(url.toString(), { headers: this.headers });
            
            if (!response.ok) {
                throw new Error(`Rule34 API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || data.length === 0) {
                return null;
            }

            return this._enrichPost(data[0]);
        } catch (error) {
            console.error('[Rule34 GetById Error]', error);
            throw error;
        }
    }

    /**
     * Get random posts with optional filters
     */
    async getRandom(options = {}) {
        const {
            tags = '',
            count = 1,
            rating = null,
            excludeAi = false,
            minScore = 0
        } = options;

        // For random, we fetch more and pick randomly
        const result = await this.search(tags, {
            limit: Math.min(100, count * 10),
            page: Math.floor(Math.random() * 10), // Random page for variety
            rating,
            excludeAi,
            minScore,
            sort: 'random' // Will use random sort if API supports, else post-shuffle
        });

        if (result.posts.length === 0) {
            return [];
        }

        // Shuffle and pick
        const shuffled = this._shuffleArray([...result.posts]);
        return shuffled.slice(0, count);
    }

    /**
     * Get trending/popular posts
     */
    async getTrending(options = {}) {
        const { timeframe = 'day', limit = 50, excludeAi = false } = options;
        
        // Rule34 doesn't have trending endpoint, so we simulate with high score sort
        const minScore = timeframe === 'day' ? 50 : timeframe === 'week' ? 100 : 200;
        
        return this.search('', {
            limit,
            sort: 'score:desc',
            minScore,
            excludeAi
        });
    }

    /**
     * Get autocomplete suggestions
     */
    async getAutocompleteSuggestions(query) {
        if (!query || query.length < 2) return [];

        const url = `${this.autocompleteUrl}?q=${encodeURIComponent(query)}`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(url, {
                headers: this.headers,
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            
            // Format: [{ label: "tag_name", value: "tag_name", type: "tag_type" }]
            return data.slice(0, 25).map(item => ({
                name: item.label || item.value,
                value: item.value || item.label,
                type: item.type || 'tag',
                count: item.count || 0
            }));
        } catch (error) {
            console.log('[Rule34 Autocomplete] Error:', error.message);
            return [];
        }
    }

    /**
     * Get tag information
     */
    async getTagInfo(tagName) {
        const url = new URL(this.baseUrl);
        url.searchParams.append('page', 'dapi');
        url.searchParams.append('s', 'tag');
        url.searchParams.append('q', 'index');
        url.searchParams.append('name', tagName);
        url.searchParams.append('json', '1');

        try {
            const response = await fetch(url.toString(), { headers: this.headers });
            
            if (!response.ok) return null;
            
            const data = await response.json();
            return data[0] || null;
        } catch {
            return null;
        }
    }

    /**
     * Get comments for a post
     */
    async getComments(postId) {
        const url = new URL(this.baseUrl);
        url.searchParams.append('page', 'dapi');
        url.searchParams.append('s', 'comment');
        url.searchParams.append('q', 'index');
        url.searchParams.append('post_id', postId.toString());
        url.searchParams.append('json', '1');

        try {
            const response = await fetch(url.toString(), { headers: this.headers });
            
            if (!response.ok) return [];
            
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    /**
     * Get related tags
     */
    async getRelatedTags(tag, limit = 20) {
        // Get posts with the tag and extract common co-occurring tags
        const result = await this.search(tag, { limit: 50 });
        
        if (result.posts.length === 0) return [];

        const tagCounts = new Map();
        const searchTag = tag.toLowerCase();

        for (const post of result.posts) {
            const tags = post.tags.split(' ');
            for (const t of tags) {
                if (t.toLowerCase() !== searchTag && t.length > 2) {
                    tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
                }
            }
        }

        // Sort by count and return top tags
        return [...tagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([tag, count]) => ({ tag, count }));
    }

    /**
     * Translate English tag to Japanese/common booru format
     */
    async translateTag(tag) {
        if (this.translationCache.has(tag)) {
            return this.translationCache.get(tag);
        }

        // Common translations for booru tags
        const commonTranslations = {
            // Characters/series often have specific tags
            'blonde hair': 'blonde_hair',
            'blue eyes': 'blue_eyes',
            'big breasts': 'large_breasts',
            'small breasts': 'small_breasts',
            'long hair': 'long_hair',
            'short hair': 'short_hair',
            'cat ears': 'cat_ears',
            'animal ears': 'animal_ears',
            // Add more common translations
        };

        const lowerTag = tag.toLowerCase();
        
        // Check common translations
        if (commonTranslations[lowerTag]) {
            this.translationCache.set(tag, commonTranslations[lowerTag]);
            return commonTranslations[lowerTag];
        }

        // Convert spaces to underscores (booru standard)
        const formatted = tag.trim().replace(/\s+/g, '_').toLowerCase();
        this.translationCache.set(tag, formatted);
        return formatted;
    }

    // ========== PRIVATE METHODS ==========

    _buildSearchQuery(query, options) {
        const {
            rating,
            excludeAi,
            minScore,
            contentType,
            excludeTags,
            requireTags,
            minWidth,
            minHeight,
            highQualityOnly,
            excludeLowQuality,
            sort
        } = options;

        let tags = [];

        // Base query
        if (query && query.trim()) {
            // Handle multiple tags properly
            const queryTags = query.split(/[\s,]+/).filter(t => t.length > 0);
            tags.push(...queryTags);
        }

        // Rating filter
        if (rating && this.ratings[rating]) {
            tags.push(`rating:${this.ratings[rating]}`);
        }

        // AI exclusion
        if (excludeAi) {
            for (const aiTag of this.aiTags) {
                tags.push(`-${aiTag}`);
            }
        }

        // Score filter
        if (minScore > 0) {
            tags.push(`score:>=${minScore}`);
        }

        // Dimension filters
        if (minWidth > 0) {
            tags.push(`width:>=${minWidth}`);
        }
        if (minHeight > 0) {
            tags.push(`height:>=${minHeight}`);
        }

        // Content type
        if (contentType) {
            const typeTags = this.contentTypeTags[contentType];
            if (typeTags && typeTags.length > 0) {
                // Use OR grouping for content type
                tags.push(`( ${typeTags.join(' ~ ')} )`);
            }
        }

        // Quality filters
        if (highQualityOnly) {
            const qualityTags = this.qualityTags.high;
            tags.push(`( ${qualityTags.join(' ~ ')} )`);
        }
        if (excludeLowQuality) {
            for (const lowTag of this.qualityTags.low) {
                tags.push(`-${lowTag}`);
            }
        }

        // Excluded tags
        for (const excludeTag of excludeTags) {
            if (excludeTag && excludeTag.trim()) {
                tags.push(`-${excludeTag.trim()}`);
            }
        }

        // Required tags
        for (const requireTag of requireTags) {
            if (requireTag && requireTag.trim()) {
                tags.push(requireTag.trim());
            }
        }

        // Sort
        if (sort && sort !== 'default') {
            tags.push(`sort:${sort}`);
        }

        return tags.join(' ');
    }

    _processResults(posts, options) {
        const { excludeAi, minScore, highQualityOnly, excludeLowQuality } = options;

        return posts
            .map(post => this._enrichPost(post))
            .filter(post => {
                // Score filter (double-check)
                if (minScore > 0 && (post.score || 0) < minScore) {
                    return false;
                }

                // AI filter (double-check using tags)
                if (excludeAi && this._isAiGenerated(post)) {
                    return false;
                }

                // Quality filter
                if (highQualityOnly && !this._isHighQuality(post)) {
                    return false;
                }

                if (excludeLowQuality && this._isLowQuality(post)) {
                    return false;
                }

                return true;
            });
    }

    _enrichPost(post) {
        const tags = (post.tags || '').split(' ');
        
        return {
            id: post.id,
            hash: post.hash || post.md5,
            width: post.width,
            height: post.height,
            score: post.score || 0,
            rating: post.rating,
            owner: post.owner,
            tags: post.tags,
            tagList: tags,
            tagCount: tags.length,
            
            // URLs
            fileUrl: post.file_url,
            sampleUrl: post.sample_url || post.file_url,
            previewUrl: post.preview_url,
            
            // Media info
            hasVideo: this._isVideo(post),
            hasSound: tags.some(t => t === 'sound' || t === 'has_audio'),
            isAnimated: this._isAnimated(post),
            isAiGenerated: this._isAiGenerated(post),
            
            // Quality indicators
            isHighQuality: this._isHighQuality(post),
            isHighRes: post.width >= 1920 || post.height >= 1080,
            
            // Metadata
            source: post.source || '',
            parentId: post.parent_id,
            hasChildren: post.has_children,
            createdAt: post.created_at,
            change: post.change,
            
            // Content type detection
            contentType: this._detectContentType(post),
            
            // File info
            fileExtension: this._getFileExtension(post.file_url),
            
            // URL for the website
            pageUrl: `https://rule34.xxx/index.php?page=post&s=view&id=${post.id}`
        };
    }

    _isAiGenerated(post) {
        const tags = (post.tags || post.tagList?.join(' ') || '').toLowerCase();
        return this.aiTags.some(aiTag => tags.includes(aiTag));
    }

    _isHighQuality(post) {
        const tags = (post.tags || post.tagList?.join(' ') || '').toLowerCase();
        return this.qualityTags.high.some(tag => tags.includes(tag));
    }

    _isLowQuality(post) {
        const tags = (post.tags || post.tagList?.join(' ') || '').toLowerCase();
        return this.qualityTags.low.some(tag => tags.includes(tag));
    }

    _isVideo(post) {
        const url = post.file_url || '';
        return url.endsWith('.mp4') || url.endsWith('.webm');
    }

    _isAnimated(post) {
        const url = post.file_url || '';
        const tags = (post.tags || '').toLowerCase();
        return url.endsWith('.gif') || 
               url.endsWith('.mp4') || 
               url.endsWith('.webm') ||
               tags.includes('animated');
    }

    _detectContentType(post) {
        if (this._isVideo(post)) return 'video';
        
        const url = post.file_url || '';
        if (url.endsWith('.gif')) return 'gif';
        
        const tags = (post.tags || '').toLowerCase();
        if (tags.includes('comic') || tags.includes('manga')) return 'comic';
        if (tags.includes('animated')) return 'animated';
        
        return 'image';
    }

    _getFileExtension(url) {
        if (!url) return 'unknown';
        const match = url.match(/\.(\w+)(?:\?|$)/);
        return match ? match[1].toLowerCase() : 'unknown';
    }

    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Format tags for display
     */
    formatTagsForDisplay(tags, maxLength = 500) {
        if (typeof tags === 'string') {
            tags = tags.split(' ');
        }
        
        // Categorize tags
        const categories = {
            character: [],
            copyright: [],
            artist: [],
            general: [],
            meta: []
        };
        
        for (const tag of tags) {
            // Simple categorization based on common patterns
            if (tag.includes('(') && tag.includes(')')) {
                categories.character.push(tag);
            } else if (tag.startsWith('artist:') || tag.endsWith('_(artist)')) {
                categories.artist.push(tag);
            } else if (['tagme', 'meta', 'source_request'].includes(tag)) {
                categories.meta.push(tag);
            } else {
                categories.general.push(tag);
            }
        }

        let result = '';
        
        if (categories.character.length > 0) {
            result += `**Characters:** ${categories.character.slice(0, 5).join(', ')}\n`;
        }
        if (categories.artist.length > 0) {
            result += `**Artist:** ${categories.artist.slice(0, 3).join(', ')}\n`;
        }
        if (categories.general.length > 0) {
            const generalStr = categories.general.slice(0, 15).join(', ');
            result += `**Tags:** ${generalStr}`;
            if (categories.general.length > 15) {
                result += ` (+${categories.general.length - 15} more)`;
            }
        }

        return result.length > maxLength ? result.slice(0, maxLength - 3) + '...' : result;
    }

    /**
     * Get blacklist suggestions based on common NSFW tags
     */
    getBlacklistSuggestions() {
        return [
            // Extreme content
            'gore', 'guro', 'death', 'blood', 'violence',
            // Specific fetishes users might want to avoid
            'scat', 'vore', 'inflation', 'feet', 'furry',
            // AI content
            ...this.aiTags,
            // Quality issues
            ...this.qualityTags.low
        ];
    }
}

module.exports = new Rule34Service();
