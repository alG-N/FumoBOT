const { get, all } = require('../../Core/database');
const { CRAFT_CONFIG } = require('../../Configuration/craftConfig');

const craftCache = new Map();
const CACHE_TTL = 30000;

function getCacheKey(userId, craftType) {
    return `${userId}_${craftType}`;
}

async function getUserCraftData(userId, craftType) {
    const cacheKey = getCacheKey(userId, craftType);
    const cached = craftCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const [inventory, balance, queue] = await Promise.all([
        all(`SELECT itemName, SUM(quantity) as totalQuantity FROM userInventory WHERE userId = ? GROUP BY itemName`, [userId]),
        get(`SELECT coins, gems FROM userCoins WHERE userId = ?`, [userId]),
        all(`SELECT * FROM craftQueue WHERE userId = ? AND claimed = 0 ORDER BY completesAt ASC`, [userId])
    ]);

    const userInventory = {};
    inventory.forEach(row => userInventory[row.itemName] = row.totalQuantity);

    const data = {
        inventory: userInventory,
        coins: balance?.coins || 0,
        gems: balance?.gems || 0,
        queue
    };

    craftCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });

    return data;
}

function clearUserCache(userId, craftType = null) {
    if (craftType) {
        craftCache.delete(getCacheKey(userId, craftType));
    } else {
        for (const key of craftCache.keys()) {
            if (key.startsWith(userId)) {
                craftCache.delete(key);
            }
        }
    }
}

setInterval(() => {
    const now = Date.now();
    for (const [key, { timestamp }] of craftCache.entries()) {
        if (now - timestamp > CACHE_TTL) {
            craftCache.delete(key);
        }
    }
}, 60000);

module.exports = {
    getUserCraftData,
    clearUserCache
};