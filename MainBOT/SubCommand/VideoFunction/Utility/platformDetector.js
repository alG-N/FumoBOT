/**
 * Enhanced PlatformDetector with additional platform info and styling
 */
class PlatformDetector {
    constructor() {
        // Platform configurations with enhanced metadata
        this.platforms = {
            tiktok: {
                name: '🎵 TikTok',
                id: 'tiktok',
                color: '#000000',
                patterns: ['tiktok.com', 'vm.tiktok.com'],
                supports: ['video', 'slideshow'],
                maxQuality: '1080p',
            },
            twitter: {
                name: '𝕏 Twitter/X',
                id: 'twitter',
                color: '#1DA1F2',
                patterns: ['twitter.com', 'x.com', 't.co'],
                supports: ['video', 'gif'],
                maxQuality: '1080p',
            },
            instagram: {
                name: '📷 Instagram',
                id: 'instagram',
                color: '#E4405F',
                patterns: ['instagram.com', 'instagr.am'],
                supports: ['video', 'reel', 'story'],
                maxQuality: '1080p',
            },
            youtubeShorts: {
                name: '📱 YouTube Shorts',
                id: 'youtube-shorts',
                color: '#FF0000',
                patterns: ['youtube.com/shorts'],
                supports: ['video'],
                maxQuality: '1080p',
            },
            youtube: {
                name: '▶️ YouTube',
                id: 'youtube',
                color: '#FF0000',
                patterns: ['youtube.com', 'youtu.be'],
                supports: ['video', 'live', 'playlist'],
                maxQuality: '4K',
            },
            reddit: {
                name: '🤖 Reddit',
                id: 'reddit',
                color: '#FF4500',
                patterns: ['reddit.com', 'redd.it', 'v.redd.it'],
                supports: ['video', 'gif'],
                maxQuality: '1080p',
            },
            facebook: {
                name: '📘 Facebook',
                id: 'facebook',
                color: '#1877F2',
                patterns: ['facebook.com', 'fb.watch', 'fb.com'],
                supports: ['video', 'reel', 'story'],
                maxQuality: '1080p',
            },
            twitch: {
                name: '🎮 Twitch',
                id: 'twitch',
                color: '#9146FF',
                patterns: ['twitch.tv', 'clips.twitch.tv'],
                supports: ['clip', 'vod'],
                maxQuality: '1080p',
            },
            vimeo: {
                name: '🎬 Vimeo',
                id: 'vimeo',
                color: '#1AB7EA',
                patterns: ['vimeo.com'],
                supports: ['video'],
                maxQuality: '4K',
            },
            pinterest: {
                name: '📌 Pinterest',
                id: 'pinterest',
                color: '#E60023',
                patterns: ['pinterest.com', 'pin.it'],
                supports: ['video', 'gif'],
                maxQuality: '720p',
            },
            snapchat: {
                name: '👻 Snapchat',
                id: 'snapchat',
                color: '#FFFC00',
                patterns: ['snapchat.com', 'story.snapchat.com'],
                supports: ['video', 'story'],
                maxQuality: '1080p',
            },
            dailymotion: {
                name: '🎥 Dailymotion',
                id: 'dailymotion',
                color: '#0066DC',
                patterns: ['dailymotion.com', 'dai.ly'],
                supports: ['video'],
                maxQuality: '1080p',
            },
            bilibili: {
                name: '📺 Bilibili',
                id: 'bilibili',
                color: '#00A1D6',
                patterns: ['bilibili.com', 'b23.tv'],
                supports: ['video'],
                maxQuality: '4K',
            },
            soundcloud: {
                name: '🎵 SoundCloud',
                id: 'soundcloud',
                color: '#FF5500',
                patterns: ['soundcloud.com'],
                supports: ['audio'],
                maxQuality: 'audio',
            },
        };
    }

    /**
     * Detect platform from URL
     * @param {string} url - URL to detect
     * @returns {Object} Platform info
     */
    detect(url) {
        const lowerUrl = url.toLowerCase();
        
        // Check YouTube Shorts first (before general YouTube)
        if (lowerUrl.includes('youtube.com/shorts')) {
            return this._formatPlatform(this.platforms.youtubeShorts);
        }

        // Priority check for Reddit (check before Twitter due to 't.co' in 'content')
        if (lowerUrl.includes('reddit.com') || lowerUrl.includes('redd.it') || lowerUrl.includes('v.redd.it')) {
            return this._formatPlatform(this.platforms.reddit);
        }

        // Check each platform
        for (const [key, platform] of Object.entries(this.platforms)) {
            if (key === 'youtubeShorts' || key === 'reddit') continue; // Already checked
            
            for (const pattern of platform.patterns) {
                if (lowerUrl.includes(pattern)) {
                    return this._formatPlatform(platform);
                }
            }
        }

        // Default to generic web
        return { 
            name: '🌐 Web', 
            id: 'web',
            color: '#7289DA',
            supports: ['video'],
            maxQuality: 'varies'
        };
    }

    /**
     * Format platform object for return
     */
    _formatPlatform(platform) {
        return {
            name: platform.name,
            id: platform.id,
            color: platform.color,
            supports: platform.supports,
            maxQuality: platform.maxQuality,
        };
    }

    /**
     * Check if URL is supported
     * @param {string} url - URL to check
     * @returns {boolean} Is supported
     */
    isSupported(url) {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    /**
     * Check if URL is a raw CDN link that expires quickly
     * @param {string} url - URL to check
     * @returns {boolean} Is CDN link
     */
    isDirectCdnLink(url) {
        const cdnPatterns = [
            'googlevideo.com',
            'fbcdn.net',
            'cdninstagram.com',
            'twimg.com',
            'redd.it',
            'akamaized.net',
            'cloudfront.net',
            'tiktokcdn.com',
        ];
        return cdnPatterns.some(pattern => url.includes(pattern));
    }

    /**
     * Get display-safe URL (hide CDN links)
     * @param {string} url - URL to format
     * @param {number} maxLength - Maximum length
     * @returns {string} Display URL
     */
    getDisplayUrl(url, maxLength = 60) {
        if (this.isDirectCdnLink(url)) {
            return '[Direct CDN Link - Expires quickly]';
        }
        if (url.length > maxLength) {
            return url.substring(0, maxLength) + '...';
        }
        return url;
    }

    /**
     * Get all supported platforms
     * @returns {Array} List of platform objects
     */
    getSupportedPlatforms() {
        return Object.values(this.platforms).map(p => ({
            name: p.name,
            id: p.id,
            supports: p.supports,
        }));
    }

    /**
     * Get platform by ID
     * @param {string} id - Platform ID
     * @returns {Object|null} Platform info or null
     */
    getPlatformById(id) {
        for (const platform of Object.values(this.platforms)) {
            if (platform.id === id) {
                return this._formatPlatform(platform);
            }
        }
        return null;
    }

    /**
     * Extract video ID from URL (if applicable)
     * @param {string} url - URL to parse
     * @returns {string|null} Video ID or null
     */
    extractVideoId(url) {
        try {
            const urlObj = new URL(url);
            
            // YouTube
            if (url.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
            if (url.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
            
            // TikTok
            if (url.includes('tiktok.com')) {
                const match = url.match(/\/video\/(\d+)/);
                return match ? match[1] : null;
            }
            
            // Twitter
            if (url.includes('twitter.com') || url.includes('x.com')) {
                const match = url.match(/\/status\/(\d+)/);
                return match ? match[1] : null;
            }

            return null;
        } catch {
            return null;
        }
    }
}

module.exports = new PlatformDetector();