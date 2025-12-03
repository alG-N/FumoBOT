const { generateCoinMarket, generateGemMarket } = require('./MarketGenerationService');
const { 
    COIN_MARKET_RESET_INTERVAL, 
    GEM_MARKET_RESET_INTERVAL 
} = require('../../../Configuration/marketConfig');
const { 
    getUserCoinMarket, 
    setUserCoinMarket,
    getUserGemMarket,
    setUserGemMarket
} = require('./MarketStorageService');

function getNextCoinResetTime() {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(now.getHours() + 1);
    return next.getTime();
}

function getNextGemResetTime() {
    const now = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    return Math.ceil(now / sixHours) * sixHours;
}

function getCoinMarket(userId) {
    const now = Date.now();
    let cache = getUserCoinMarket(userId);

    if (!cache || now > cache.resetTime) {
        const market = generateCoinMarket(userId);
        cache = {
            market,
            resetTime: getNextCoinResetTime()
        };
        setUserCoinMarket(userId, cache);
    }

    return cache;
}

function getGemMarket(userId) {
    const now = Date.now();
    let cache = getUserGemMarket(userId);

    if (!cache || now > cache.resetTime) {
        const market = generateGemMarket(userId);
        cache = {
            market,
            resetTime: getNextGemResetTime()
        };
        setUserGemMarket(userId, cache);
    }

    return cache;
}

function updateCoinMarketStock(userId, fumoName, quantity) {
    const cache = getUserCoinMarket(userId);
    if (!cache) return false;

    const fumo = cache.market.find(f => f.name === fumoName);
    if (!fumo) return false;

    fumo.stock -= quantity;
    
    if (fumo.stock <= 0) {
        const index = cache.market.findIndex(f => f.name === fumoName);
        if (index !== -1) {
            cache.market.splice(index, 1);
        }
    }

    setUserCoinMarket(userId, cache);
    return true;
}

function updateGemMarketStock(userId, fumoName, quantity) {
    const cache = getUserGemMarket(userId);
    if (!cache) return false;

    const fumo = cache.market.find(f => f.name === fumoName);
    if (!fumo) return false;

    fumo.stock -= quantity;
    
    if (fumo.stock <= 0) {
        const index = cache.market.findIndex(f => f.name === fumoName);
        if (index !== -1) {
            cache.market.splice(index, 1);
        }
    }

    setUserGemMarket(userId, cache);
    return true;
}

module.exports = {
    getCoinMarket,
    getGemMarket,
    updateCoinMarketStock,
    updateGemMarketStock,
    getNextCoinResetTime,
    getNextGemResetTime
};