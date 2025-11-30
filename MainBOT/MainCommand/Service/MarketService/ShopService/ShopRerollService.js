const { getUserRerollData, updateRerollCount } = require('./ShopDatabaseService');
const { REROLL_COOLDOWN, MAX_REROLLS } = require('../../../Configuration/shopConfig');
const { debugLog } = require('../../../Core/logger');

const userRerollData = new Map();
const paidRerollCount = new Map(); // Track paid rerolls per user

function getRerollData(userId) {
    if (!userRerollData.has(userId)) {
        userRerollData.set(userId, { count: MAX_REROLLS, lastResetTime: Date.now() });
    }
    
    const data = userRerollData.get(userId);
    const now = Date.now();
    
    if (now - data.lastResetTime >= REROLL_COOLDOWN) {
        data.count = MAX_REROLLS;
        data.lastResetTime = now;
        // Reset paid reroll count on cooldown reset
        paidRerollCount.delete(userId);
    }
    
    return data;
}

async function initializeRerollData(userId) {
    const dbData = await getUserRerollData(userId);
    const now = Date.now();
    
    if (now - dbData.lastRerollReset >= REROLL_COOLDOWN) {
        userRerollData.set(userId, { 
            count: MAX_REROLLS, 
            lastResetTime: now 
        });
        await updateRerollCount(userId, MAX_REROLLS, now);
        paidRerollCount.delete(userId);
    } else {
        userRerollData.set(userId, { 
            count: dbData.rerollCount, 
            lastResetTime: dbData.lastRerollReset 
        });
    }
    
    return userRerollData.get(userId);
}

function useReroll(userId, isPaid = false) {
    const data = getRerollData(userId);
    
    if (!isPaid) {
        // Free reroll
        if (data.count > 0) {
            data.count--;
            debugLog('SHOP_REROLL', `Used free reroll for ${userId}, remaining: ${data.count}`);
            return true;
        }
        return false;
    } else {
        // Paid reroll - increment the paid counter
        const current = paidRerollCount.get(userId) || 0;
        paidRerollCount.set(userId, current + 1);
        debugLog('SHOP_REROLL', `Used paid reroll for ${userId}, total paid: ${current + 1}`);
        return true;
    }
}

function getPaidRerollCost(userId) {
    const paidCount = paidRerollCount.get(userId) || 0;
    // Base cost is 15,000 gems, multiplied by the number of paid rerolls used + 1
    const cost = 15000 * (paidCount + 1);
    return cost;
}

function getRerollCooldownRemaining(userId) {
    const data = getRerollData(userId);
    const now = Date.now();
    const timeSinceReset = now - data.lastResetTime;
    
    if (timeSinceReset >= REROLL_COOLDOWN) {
        return 0;
    }
    
    return REROLL_COOLDOWN - timeSinceReset;
}

function formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    getRerollData,
    initializeRerollData,
    useReroll,
    getPaidRerollCost,
    getRerollCooldownRemaining,
    formatTimeRemaining
};