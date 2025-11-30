const { generateUserMarket } = require('./MarketGenerationService');
const { MARKET_RESET_INTERVAL } = require('../../../Configuration/marketConfig');
const { debugLog } = require('../../../Core/logger');

const userMarkets = new Map();

function getNextResetTime() {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(now.getHours() + 1);
    return next.getTime();
}

function getUserMarket(userId) {
    const now = Date.now();
    let cache = userMarkets.get(userId);

    if (!cache || now > cache.resetTime) {
        const market = generateUserMarket(userId);
        cache = {
            market,
            resetTime: getNextResetTime()
        };
        userMarkets.set(userId, cache);
        debugLog('MARKET_CACHE', `Created new market for ${userId}`);
    }

    return cache;
}

function updateMarketStock(userId, fumoName, quantity) {
    const cache = userMarkets.get(userId);
    if (!cache) return false;

    const fumo = cache.market.find(f => f.name === fumoName);
    if (!fumo) return false;

    fumo.stock -= quantity;
    
    if (fumo.stock <= 0) {
        const index = cache.market.findIndex(f => f.name === fumoName);
        if (index !== -1) {
            cache.market.splice(index, 1);
            debugLog('MARKET_CACHE', `Removed ${fumoName} from market (out of stock)`);
        }
    }

    return true;
}

function clearUserMarket(userId) {
    userMarkets.delete(userId);
    debugLog('MARKET_CACHE', `Cleared market cache for ${userId}`);
}

function clearAllMarkets() {
    const size = userMarkets.size;
    userMarkets.clear();
    debugLog('MARKET_CACHE', `Cleared all market caches (${size} users)`);
}

function scheduleGlobalMarketReset() {
    const msUntilReset = getNextResetTime() - Date.now();
    setTimeout(() => {
        for (const userId of userMarkets.keys()) {
            const newMarket = generateUserMarket(userId);
            userMarkets.set(userId, {
                market: newMarket,
                resetTime: getNextResetTime()
            });
        }
        debugLog('MARKET_CACHE', `Global market reset completed for ${userMarkets.size} users`);
        scheduleGlobalMarketReset();
    }, msUntilReset);
}

scheduleGlobalMarketReset();

module.exports = {
    getUserMarket,
    updateMarketStock,
    clearUserMarket,
    clearAllMarkets,
    getNextResetTime
};