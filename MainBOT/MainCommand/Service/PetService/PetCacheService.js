const petCache = new Map();
const CACHE_TTL = 30000;

setInterval(() => {
    const now = Date.now();
    for (const [key, { timestamp }] of petCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            petCache.delete(key);
        }
    }
}, 60000);

function getCacheKey(userId, type) {
    return `${userId}_${type}`;
}

function set(userId, type, data) {
    petCache.set(getCacheKey(userId, type), {
        data,
        timestamp: Date.now()
    });
}

function get(userId, type) {
    const cached = petCache.get(getCacheKey(userId, type));
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > CACHE_TTL) {
        petCache.delete(getCacheKey(userId, type));
        return null;
    }
    
    return cached.data;
}

function invalidate(userId, type = null) {
    if (type) {
        petCache.delete(getCacheKey(userId, type));
    } else {
        for (const key of petCache.keys()) {
            if (key.startsWith(`${userId}_`)) {
                petCache.delete(key);
            }
        }
    }
}

function clear() {
    petCache.clear();
}

module.exports = {
    set,
    get,
    invalidate,
    clear
};