const cooldownMap = new Map();
const CLEANUP_INTERVAL = 300000;

setInterval(() => {
    const now = Date.now();
    const toDelete = [];
    
    for (const [key, timestamp] of cooldownMap.entries()) {
        if (now - timestamp > 3600000) {
            toDelete.push(key);
        }
    }
    
    toDelete.forEach(key => cooldownMap.delete(key));
    
    // Cleanup log disabled for cleaner console
    // if (toDelete.length > 0) {
    //     console.log(`[Rate Limiter] Cleaned up ${toDelete.length} expired cooldowns`);
    // }
}, CLEANUP_INTERVAL);

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

async function checkAndSetCooldown(userId, action, cooldownMs = null) {
    if (!cooldownMs) {
        const { calculateCooldown } = require('../Service/GachaService/NormalGachaService/BoostService');
        try {
            cooldownMs = await calculateCooldown(userId);
        } catch (error) {
            cooldownMs = 4000;
        }
    }
    
    const result = checkCooldown(userId, action, cooldownMs);
    
    if (!result.onCooldown) {
        setCooldown(userId, action);
    }
    
    return result;
}

function resetCooldown(userId, action) {
    const key = `${userId}_${action}`;
    cooldownMap.delete(key);
}

function clearAllCooldowns() {
    const size = cooldownMap.size;
    cooldownMap.clear();
    console.log(`[Rate Limiter] Cleared ${size} cooldowns`);
}

function getRemainingCooldown(userId, action, cooldownMs) {
    const key = `${userId}_${action}`;
    const lastUsed = cooldownMap.get(key);
    
    if (!lastUsed) return 0;
    
    const elapsed = Date.now() - lastUsed;
    return Math.max(0, cooldownMs - elapsed);
}

function getCooldownStats() {
    const now = Date.now();
    let active = 0;
    const byAction = {};
    
    for (const [key, timestamp] of cooldownMap.entries()) {
        const action = key.split('_').slice(1).join('_');
        
        if (now - timestamp < 60000) {
            active++;
            byAction[action] = (byAction[action] || 0) + 1;
        }
    }
    
    return {
        total: cooldownMap.size,
        active,
        byAction
    };
}

function checkMultipleCooldowns(userId, actions) {
    const results = {};
    
    for (const { action, cooldownMs } of actions) {
        results[action] = checkCooldown(userId, action, cooldownMs);
    }
    
    return results;
}

module.exports = {
    checkCooldown,
    setCooldown,
    checkAndSetCooldown,
    resetCooldown,
    clearAllCooldowns,
    getRemainingCooldown,
    getCooldownStats,
    checkMultipleCooldowns
};