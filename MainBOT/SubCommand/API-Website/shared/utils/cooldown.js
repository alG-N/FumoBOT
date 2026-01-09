/**
 * Shared Cooldown Manager
 * Handles rate limiting across all API commands
 */

class CooldownManager {
    constructor() {
        this.cooldowns = new Map();
        this.defaultCooldownMs = 3000;
        
        // Cleanup expired cooldowns every 5 minutes
        setInterval(() => this._cleanup(), 300000);
    }

    /**
     * Check if user is on cooldown
     */
    check(userId, commandName, cooldownMs = this.defaultCooldownMs) {
        const key = `${userId}_${commandName}`;
        const now = Date.now();
        const lastUsed = this.cooldowns.get(key);

        if (lastUsed && now - lastUsed < cooldownMs) {
            const remaining = ((cooldownMs - (now - lastUsed)) / 1000).toFixed(1);
            return { onCooldown: true, remaining: parseFloat(remaining) };
        }

        this.cooldowns.set(key, now);
        return { onCooldown: false };
    }

    /**
     * Reset cooldown for a user/command
     */
    reset(userId, commandName) {
        const key = `${userId}_${commandName}`;
        this.cooldowns.delete(key);
    }

    _cleanup() {
        const now = Date.now();
        for (const [key, timestamp] of this.cooldowns.entries()) {
            if (now - timestamp > 60000) {
                this.cooldowns.delete(key);
            }
        }
    }
}

// Command-specific cooldown settings
const COOLDOWN_SETTINGS = {
    nhentai: 3000,
    reddit: 5000,
    rule34: 3000,
    pixiv: 3000,
    google: 5000,
    wikipedia: 3000,
    steam: 5000,
    anime: 3000
};

const cooldownManager = new CooldownManager();

module.exports = {
    CooldownManager,
    cooldownManager,
    COOLDOWN_SETTINGS
};
