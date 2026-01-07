const db = require('../../../Core/database');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');
const { logError } = require('../../../Core/logger');

/**
 * Check if user has already claimed starter
 */
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

/**
 * Get available starter paths
 */
function getStarterPaths() {
    return STARTER_CONFIG.PATHS;
}

/**
 * Validate path selection
 */
function isValidPath(pathId) {
    return !!STARTER_CONFIG.PATHS[pathId];
}

/**
 * Claim starter pack with selected path
 */
async function claimStarter(userId, pathId) {
    try {
        const alreadyClaimed = await hasClaimedStarter(userId);
        
        if (alreadyClaimed) {
            return {
                success: false,
                reason: 'ALREADY_CLAIMED'
            };
        }
        
        if (!isValidPath(pathId)) {
            return {
                success: false,
                reason: 'INVALID_PATH'
            };
        }
        
        const path = STARTER_CONFIG.PATHS[pathId];
        const welcome = STARTER_CONFIG.WELCOME_BONUS;
        const joinDate = new Date().toISOString();
        
        // Calculate total rewards
        const totalCoins = path.coins + welcome.coins;
        const totalGems = path.gems + welcome.gems;
        const totalTokens = path.spiritTokens;
        
        // Create user account (without level/exp/rebirth - those are in separate tables)
        await db.run(
            `INSERT INTO userCoins (
                userId, coins, gems, joinDate,
                luck, dailyStreak, spiritTokens, starterPath
            ) VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
            [userId, totalCoins, totalGems, joinDate, totalTokens, pathId]
        );
        
        // Create level progress entry
        await db.run(
            `INSERT INTO userLevelProgress (userId, level, exp, totalExpEarned, lastUpdated)
             VALUES (?, 1, 0, 0, ?)`,
            [userId, Date.now()]
        );
        
        // Create rebirth progress entry
        await db.run(
            `INSERT INTO userRebirthProgress (userId, rebirthCount, totalRebirths)
             VALUES (?, 0, 0)`,
            [userId]
        );
        
        // Add path items to inventory
        const allItems = [...path.items, ...welcome.items];
        for (const item of allItems) {
            await db.run(
                `INSERT INTO userInventory (userId, itemName, quantity, type)
                 VALUES (?, ?, ?, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                [userId, item.name, item.quantity, item.quantity]
            );
        }
        
        return {
            success: true,
            path: path,
            rewards: {
                coins: totalCoins,
                gems: totalGems,
                spiritTokens: totalTokens,
                items: allItems
            }
        };
    } catch (error) {
        // Check for unique constraint violation (race condition protection)
        if (error.code === 'SQLITE_CONSTRAINT') {
            return {
                success: false,
                reason: 'ALREADY_CLAIMED'
            };
        }
        throw new Error(`Failed to claim starter: ${error.message}`);
    }
}

/**
 * Get user starter stats
 */
async function getStarterStats(userId) {
    try {
        // Get base data from userCoins, level from userLevelProgress, rebirth from userRebirthProgress
        const [row, levelRow, rebirthRow] = await Promise.all([
            db.get(
                `SELECT joinDate, coins, gems, starterPath
                 FROM userCoins WHERE userId = ?`,
                [userId],
                true
            ),
            db.get(
                `SELECT level FROM userLevelProgress WHERE userId = ?`,
                [userId],
                true
            ),
            db.get(
                `SELECT rebirthCount FROM userRebirthProgress WHERE userId = ?`,
                [userId],
                true
            )
        ]);
        
        if (!row) return null;
        
        const joinedAt = new Date(row.joinDate);
        const now = new Date();
        const daysPlayed = Math.floor((now - joinedAt) / (1000 * 60 * 60 * 24));
        
        return {
            joinDate: row.joinDate,
            daysPlayed,
            currentCoins: row.coins,
            currentGems: row.gems,
            level: levelRow?.level || 1,
            rebirth: rebirthRow?.rebirthCount || 0,
            starterPath: row.starterPath || 'unknown'
        };
    } catch (error) {
        throw new Error(`Failed to get starter stats: ${error.message}`);
    }
}

module.exports = {
    hasClaimedStarter,
    getStarterPaths,
    isValidPath,
    claimStarter,
    getStarterStats
};