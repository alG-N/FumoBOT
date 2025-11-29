const { calculateCooldown } = require('../Service/GachaService/BoostService');

const cooldownMap = new Map();

function checkCooldown(userId, action, cooldownMs) {
    const key = `${userId}_${action}`;
    const lastUsed = cooldownMap.get(key);
    const now = Date.now();

    if (lastUsed && now - lastUsed < cooldownMs) {
        const remaining = ((cooldownMs - (now - lastUsed)) / 1000).toFixed(1);
        return { onCooldown: true, remaining };
    }

    return { onCooldown: false };
}

function setCooldown(userId, action) {
    const key = `${userId}_${action}`;
    cooldownMap.set(key, Date.now());
}

async function checkAndSetCooldown(userId, action) {
    const cooldownMs = await calculateCooldown(userId);
    const result = checkCooldown(userId, action, cooldownMs);
    
    if (!result.onCooldown) {
        setCooldown(userId, action);
    }
    
    return result;
}

module.exports = {
    checkCooldown,
    setCooldown,
    checkAndSetCooldown
};