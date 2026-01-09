class RedditCache {
    constructor() {
        this.userPosts = new Map();
        this.galleryStates = new Map();
        this.pageStates = new Map();
        this.sortStates = new Map();
        this.nsfwStates = new Map(); // Track if user is in NSFW channel
    }

    // Post management
    setPosts(userId, posts) {
        this.userPosts.set(userId, posts);
    }

    getPosts(userId) {
        return this.userPosts.get(userId);
    }

    clearPosts(userId) {
        this.userPosts.delete(userId);
    }

    // Page state management
    setPage(userId, page) {
        this.pageStates.set(userId, page);
    }

    getPage(userId) {
        return this.pageStates.get(userId) || 0;
    }

    // Sort state management
    setSort(userId, sortBy) {
        this.sortStates.set(userId, sortBy);
    }

    getSort(userId) {
        return this.sortStates.get(userId) || 'top';
    }

    // NSFW channel state management
    setNsfwChannel(userId, isNsfw) {
        this.nsfwStates.set(userId, isNsfw);
    }

    getNsfwChannel(userId) {
        return this.nsfwStates.get(userId) || false;
    }

    // Gallery state management
    setGalleryPage(userId, postIndex, page) {
        const key = `${userId}_${postIndex}`;
        this.galleryStates.set(key, page);
    }

    getGalleryPage(userId, postIndex) {
        const key = `${userId}_${postIndex}`;
        return this.galleryStates.get(key) || 0;
    }

    clearGalleryStates(userId) {
        for (const key of this.galleryStates.keys()) {
            if (key.startsWith(`${userId}_`)) {
                this.galleryStates.delete(key);
            }
        }
    }

    // Clear all user data
    clearAll(userId) {
        this.clearPosts(userId);
        this.pageStates.delete(userId);
        this.sortStates.delete(userId);
        this.nsfwStates.delete(userId);
        this.clearGalleryStates(userId);
    }
}

module.exports = new RedditCache();
