const db = require('../../../Core/database');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');
const { logError } = require('../../../Core/logger');

async function hasClaimedStarter(userId) {
    try {
        const row = await db.get(
            'SELECT coins FROM userCoins WHERE userId = ?',
            [userId],
            true
        );
        return !!row;
    } catch (error) {
        throw new Error(`Failed to check starter status: ${error.message}`);
    }
}

function rollStarterReward() {
    const roll = Math.random() * 100;
    
    for (const tier of STARTER_CONFIG.REWARD_TIERS) {
        if (roll < tier.chance) {
            return {
                coins: tier.coins,
                gems: tier.gems,
                description: tier.description,
                rarity: tier.rarity
            };
        }
    }
    
    return STARTER_CONFIG.REWARD_TIERS[0];
}

async function claimStarter(userId) {
    try {
        const alreadyClaimed = await hasClaimedStarter(userId);
        
        if (alreadyClaimed) {
            return {
                success: false,
                reason: 'ALREADY_CLAIMED'
            };
        }
        
        const reward = rollStarterReward();
        const joinDate = new Date().toISOString();
        
        await db.run(
            `INSERT INTO userCoins (
                userId, coins, gems, joinDate,
                luck, level, exp, rebirth,
                dailyStreak, spiritTokens
            ) VALUES (?, ?, ?, ?, 0, 1, 0, 0, 0, 0)`,
            [userId, reward.coins, reward.gems, joinDate]
        );
        
        return {
            success: true,
            reward
        };
    } catch (error) {
        throw new Error(`Failed to claim starter: ${error.message}`);
    }
}

async function getStarterStats(userId) {
    try {
        const row = await db.get(
            `SELECT joinDate, coins, gems, level, rebirth
             FROM userCoins WHERE userId = ?`,
            [userId]
        );
        
        if (!row) return null;
        
        const joinedAt = new Date(row.joinDate);
        const now = new Date();
        const daysPlayed = Math.floor((now - joinedAt) / (1000 * 60 * 60 * 24));
        
        return {
            joinDate: row.joinDate,
            daysPlayed,
            currentCoins: row.coins,
            currentGems: row.gems,
            level: row.level,
            rebirth: row.rebirth
        };
    } catch (error) {
        throw new Error(`Failed to get starter stats: ${error.message}`);
    }
}

module.exports = {
    hasClaimedStarter,
    rollStarterReward,
    claimStarter,
    getStarterStats
};