const { generateUserShop } = require('./ShopGenerationService');
const { debugLog } = require('../../../Core/logger');

const userShopCache = new Map();

function getCurrentHourTimestamp() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return now.getTime();
}

function getUserShopTimeLeft() {
    const now = Date.now();
    const nextHour = getCurrentHourTimestamp() + 3600000;
    const timeRemaining = nextHour - now;
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    return `${minutes} minute(s) and ${seconds} second(s)`;
}

function getUserShop(userId) {
    const currentHour = getCurrentHourTimestamp();
    let cache = userShopCache.get(userId);

    if (!cache || cache.timestamp !== currentHour) {
        cache = {
            shop: generateUserShop(),
            timestamp: currentHour
        };
        userShopCache.set(userId, cache);
        debugLog('SHOP_CACHE', `Generated new shop for ${userId}`);
    }

    return cache.shop;
}

function forceRerollUserShop(userId) {
    const currentHour = getCurrentHourTimestamp();
    const cache = {
        shop: generateUserShop(),
        timestamp: currentHour
    };
    userShopCache.set(userId, cache);
    debugLog('SHOP_CACHE', `Force rerolled shop for ${userId}`);
    return cache.shop;
}

function clearUserShopCache(userId) {
    userShopCache.delete(userId);
    debugLog('SHOP_CACHE', `Cleared cache for ${userId}`);
}

function clearAllShopCaches() {
    const size = userShopCache.size;
    userShopCache.clear();
    debugLog('SHOP_CACHE', `Cleared all caches (${size} entries)`);
}

module.exports = {
    getUserShop,
    forceRerollUserShop,
    getUserShopTimeLeft,
    clearUserShopCache,
    clearAllShopCaches
};