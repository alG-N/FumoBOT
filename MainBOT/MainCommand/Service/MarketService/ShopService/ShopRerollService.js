const { getUserRerollData, updateRerollCount, updatePaidRerollCount, resetPaidRerollCount } = require('./ShopDatabaseService');
const { REROLL_COOLDOWN, MAX_REROLLS } = require('../../../Configuration/shopConfig');
const { debugLog } = require('../../../Core/logger');

async function getRerollData(userId) {
    const dbData = await getUserRerollData(userId);
    const now = Date.now();
    
    if (!dbData.lastRerollReset || now - dbData.lastRerollReset >= REROLL_COOLDOWN) {
        const newData = { 
            count: MAX_REROLLS, 
            lastResetTime: now,
            paidCount: 0
        };
        await updateRerollCount(userId, MAX_REROLLS, now);
        await resetPaidRerollCount(userId);
        return newData;
    }
    
    return {
        count: dbData.rerollCount,
        lastResetTime: dbData.lastRerollReset,
        paidCount: dbData.paidRerollCount || 0
    };
}

async function initializeRerollData(userId) {
    return await getRerollData(userId);
}

async function useReroll(userId, isPaid = false) {
    if (!isPaid) {
        const data = await getRerollData(userId);
        
        if (data.count > 0) {
            const newCount = data.count - 1;
            await updateRerollCount(userId, newCount, data.lastResetTime);
            debugLog('SHOP_REROLL', `Used free reroll for ${userId}, remaining: ${newCount}`);
            return true;
        }
        return false;
    } else {
        const data = await getRerollData(userId);
        const newPaidCount = (data.paidCount || 0) + 1;
        await updatePaidRerollCount(userId, newPaidCount);
        debugLog('SHOP_REROLL', `Used paid reroll for ${userId}, total paid: ${newPaidCount}`);
        return true;
    }
}

async function getPaidRerollCost(userId) {
    const data = await getRerollData(userId);
    const paidCount = data.paidCount || 0;
    const cost = 15000 * Math.pow(5, paidCount);
    return cost;
}

async function getRerollCooldownRemaining(userId) {
    const data = await getRerollData(userId);
    const now = Date.now();
    
    if (!data.lastResetTime) {
        return 0;
    }
    
    const timeSinceReset = now - data.lastResetTime;
    
    if (timeSinceReset >= REROLL_COOLDOWN) {
        return 0;
    }
    
    return REROLL_COOLDOWN - timeSinceReset;
}

function formatTimeRemaining(milliseconds) {
    if (milliseconds <= 0) return '0s';
    
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

async function canUseGemReroll(userId) {
    const data = await getRerollData(userId);
    return data.count === 0;
}

module.exports = {
    getRerollData,
    initializeRerollData,
    useReroll,
    getPaidRerollCost,
    getRerollCooldownRemaining,
    formatTimeRemaining,
    canUseGemReroll
};