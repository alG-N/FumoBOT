const { generateCoinMarket, generateGemMarket } = require('./MarketGenerationService');
const { 
    COIN_MARKET_RESET_INTERVAL, 
    GEM_MARKET_RESET_INTERVAL 
} = require('../../../Configuration/marketConfig');
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../../Data');
const GLOBAL_COIN_MARKET_FILE = path.join(STORAGE_DIR, 'globalCoinMarket.json');
const GLOBAL_GEM_MARKET_FILE = path.join(STORAGE_DIR, 'globalGemMarket.json');

function ensureStorageExists() {
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
}

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

function loadGlobalCoinMarket() {
    ensureStorageExists();
    try {
        if (fs.existsSync(GLOBAL_COIN_MARKET_FILE)) {
            const data = fs.readFileSync(GLOBAL_COIN_MARKET_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load global coin market:', error);
    }
    return null;
}

function saveGlobalCoinMarket(data) {
    ensureStorageExists();
    try {
        fs.writeFileSync(GLOBAL_COIN_MARKET_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save global coin market:', error);
    }
}

function loadGlobalGemMarket() {
    ensureStorageExists();
    try {
        if (fs.existsSync(GLOBAL_GEM_MARKET_FILE)) {
            const data = fs.readFileSync(GLOBAL_GEM_MARKET_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load global gem market:', error);
    }
    return null;
}

function saveGlobalGemMarket(data) {
    ensureStorageExists();
    try {
        fs.writeFileSync(GLOBAL_GEM_MARKET_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save global gem market:', error);
    }
}

function getCoinMarket(userId) {
    const now = Date.now();
    let cache = loadGlobalCoinMarket();

    if (!cache || now > cache.resetTime) {
        const market = generateCoinMarket();
        cache = {
            market,
            resetTime: getNextCoinResetTime()
        };
        saveGlobalCoinMarket(cache);
    }

    return cache;
}

function getGemMarket(userId) {
    const now = Date.now();
    let cache = loadGlobalGemMarket();

    if (!cache || now > cache.resetTime) {
        const market = generateGemMarket();
        cache = {
            market,
            resetTime: getNextGemResetTime()
        };
        saveGlobalGemMarket(cache);
    }

    return cache;
}

function updateCoinMarketStock(userId, fumoName, quantity) {
    const cache = loadGlobalCoinMarket();
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

    saveGlobalCoinMarket(cache);
    return true;
}

function updateGemMarketStock(userId, fumoName, quantity) {
    const cache = loadGlobalGemMarket();
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

    saveGlobalGemMarket(cache);
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