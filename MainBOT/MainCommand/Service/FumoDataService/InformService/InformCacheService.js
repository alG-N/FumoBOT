const { get, all } = require('../../../Core/database');

const informCache = new Map();
const CACHE_TTL = 30000;

function getCacheKey(userId, fumoName) {
    return `${userId}_${fumoName}`;
}

async function getFumoOwnershipData(userId, fumoName) {
    const cacheKey = getCacheKey(userId, fumoName);
    const cached = informCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const [userFumos, totalCount, userCount] = await Promise.all([
        all(`SELECT dateObtained FROM userInventory WHERE userId = ? AND fumoName = ? ORDER BY dateObtained`, [userId, fumoName]),
        get(`SELECT COUNT(*) as totalCount FROM userInventory WHERE fumoName = ?`, [fumoName]),
        get(`SELECT COUNT(DISTINCT userId) as userCount FROM userInventory WHERE fumoName = ?`, [fumoName])
    ]);

    const data = {
        userOwns: userFumos.length > 0,
        userQuantity: userFumos.length,
        firstObtained: userFumos[0]?.dateObtained || null,
        totalExistence: totalCount?.totalCount || 0,
        uniqueOwners: userCount?.userCount || 0
    };

    informCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });

    return data;
}

function clearCache(userId = null, fumoName = null) {
    if (userId && fumoName) {
        informCache.delete(getCacheKey(userId, fumoName));
    } else if (userId) {
        for (const key of informCache.keys()) {
            if (key.startsWith(userId)) {
                informCache.delete(key);
            }
        }
    } else {
        informCache.clear();
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [key, { timestamp }] of informCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            informCache.delete(key);
        }
    }
}, 60000);

module.exports = {
    getFumoOwnershipData,
    clearCache
};