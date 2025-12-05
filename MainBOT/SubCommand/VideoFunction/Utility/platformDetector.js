class PlatformDetector {
    detect(url) {
        if (url.includes('tiktok.com')) return { name: '🎵 TikTok', id: 'tiktok' };
        if (url.includes('twitter.com') || url.includes('x.com')) return { name: '𝕏 Twitter/X', id: 'twitter' };
        if (url.includes('instagram.com')) return { name: '📷 Instagram', id: 'instagram' };
        if (url.includes('youtube.com') || url.includes('youtu.be')) return { name: '▶️ YouTube', id: 'youtube' };
        if (url.includes('reddit.com')) return { name: '🤖 Reddit', id: 'reddit' };
        if (url.includes('facebook.com') || url.includes('fb.watch')) return { name: '📘 Facebook', id: 'facebook' };
        if (url.includes('twitch.tv')) return { name: '🎮 Twitch', id: 'twitch' };
        if (url.includes('vimeo.com')) return { name: '🎬 Vimeo', id: 'vimeo' };
        return { name: '🌐 Web', id: 'web' };
    }

    isSupported(url) {
        return url.startsWith('http://') || url.startsWith('https://');
    }
}

module.exports = new PlatformDetector();