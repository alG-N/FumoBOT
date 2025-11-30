const { generateGlobalEggShop } = require('./EggShopGenerationService');
const { debugLog } = require('../../../Core/logger');

const globalShop = {
    eggs: [],
    timestamp: 0,
    buyers: new Map()
};

function getNextHourTimestamp() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.getTime();
}

function getTimeUntilReset() {
    const now = Date.now();
    const nextHour = getNextHourTimestamp();
    const msLeft = nextHour - now;
    const minutes = Math.floor(msLeft / 60000);
    const seconds = Math.floor((msLeft % 60000) / 1000);
    return { minutes, seconds, ms: msLeft };
}

function getGlobalShop() {
    return {
        eggs: [...globalShop.eggs],
        timestamp: globalShop.timestamp,
        resetTime: getNextHourTimestamp()
    };
}

function getUserPurchases(userId) {
    return globalShop.buyers.get(userId) || new Set();
}

function markEggPurchased(userId, eggIndex) {
    if (!globalShop.buyers.has(userId)) {
        globalShop.buyers.set(userId, new Set());
    }
    globalShop.buyers.get(userId).add(eggIndex);
    debugLog('EGG_CACHE', `User ${userId} purchased egg ${eggIndex}`);
}

function hasUserPurchased(userId, eggIndex) {
    const purchases = globalShop.buyers.get(userId);
    return purchases ? purchases.has(eggIndex) : false;
}

function resetGlobalShop() {
    globalShop.eggs = generateGlobalEggShop();
    globalShop.timestamp = Date.now();
    globalShop.buyers.clear();
    debugLog('EGG_CACHE', `Global shop reset with ${globalShop.eggs.length} eggs`);
}

function scheduleHourlyReset() {
    const { ms } = getTimeUntilReset();
    
    setTimeout(() => {
        resetGlobalShop();
        setInterval(resetGlobalShop, 3600000);
    }, ms);
    
    debugLog('EGG_CACHE', `Scheduled next reset in ${Math.floor(ms / 60000)} minutes`);
}

function initializeShop() {
    resetGlobalShop();
    scheduleHourlyReset();
    console.log('✅ Egg shop initialized');
}

module.exports = {
    getGlobalShop,
    getUserPurchases,
    markEggPurchased,
    hasUserPurchased,
    resetGlobalShop,
    initializeShop,
    getTimeUntilReset
};