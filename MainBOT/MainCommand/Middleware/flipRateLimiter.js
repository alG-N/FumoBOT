const { FLIP_COOLDOWN } = require('../Configuration/flipConfig');

const cooldownMap = new Map();

function checkFlipCooldown(userId) {
    const lastUsed = cooldownMap.get(userId);
    const now = Date.now();
    
    if (lastUsed && now - lastUsed < FLIP_COOLDOWN) {
        const remaining = ((FLIP_COOLDOWN - (now - lastUsed)) / 1000).toFixed(1);
        return { 
            onCooldown: true, 
            remaining 
        };
    }
    
    return { onCooldown: false };
}

function setFlipCooldown(userId) {
    cooldownMap.set(userId, Date.now());
}

function resetFlipCooldown(userId) {
    cooldownMap.delete(userId);
}

function clearAllFlipCooldowns() {
    cooldownMap.clear();
}

function getRemainingCooldown(userId) {
    const lastUsed = cooldownMap.get(userId);
    if (!lastUsed) return 0;
    
    const now = Date.now();
    const elapsed = now - lastUsed;
    
    return Math.max(0, FLIP_COOLDOWN - elapsed);
}

function checkAndSetFlipCooldown(userId) {
    const check = checkFlipCooldown(userId);
    
    if (!check.onCooldown) {
        setFlipCooldown(userId);
    }
    
    return check;
}

function getCooldownStats() {
    return {
        totalUsers: cooldownMap.size,
        cooldownDuration: FLIP_COOLDOWN,
        activeCooldowns: Array.from(cooldownMap.entries())
            .filter(([_, time]) => Date.now() - time < FLIP_COOLDOWN)
            .length
    };
}

module.exports = {
    checkFlipCooldown,
    setFlipCooldown,
    resetFlipCooldown,
    clearAllFlipCooldowns,
    getRemainingCooldown,
    checkAndSetFlipCooldown,
    getCooldownStats
};