/**
 * Biome Database Service
 * 
 * Handles all database operations for the biome system.
 * Biomes are stored per-user and affect farming income.
 */

const { get, run, withUserLock } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');
const { 
    BIOME_CHANGE_COOLDOWN, 
    canUseBiome, 
    getDefaultBiome,
    getBiome 
} = require('../../../Configuration/biomeConfig');

/**
 * Get user's current biome
 * @param {string} userId 
 * @returns {Promise<{biomeId: string, changedAt: number|null}>}
 */
async function getUserBiome(userId) {
    const row = await get(
        `SELECT biomeId, biomeChangedAt FROM userBiome WHERE userId = ?`,
        [userId]
    );
    
    if (row) {
        return {
            biomeId: row.biomeId,
            changedAt: row.biomeChangedAt
        };
    }
    
    // Return default biome
    return {
        biomeId: getDefaultBiome().id,
        changedAt: null
    };
}

/**
 * Set user's biome
 * @param {string} userId 
 * @param {string} biomeId 
 * @param {number} level - User's level
 * @param {number} rebirthLevel - User's rebirth level
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function setUserBiome(userId, biomeId, level, rebirthLevel = 0) {
    return await withUserLock(userId, 'setBiome', async () => {
        // Validate biome exists and user can access it
        if (!canUseBiome(biomeId, level, rebirthLevel)) {
            return { 
                success: false, 
                error: 'You cannot access this biome. Check level and rebirth requirements.' 
            };
        }
        
        // Check cooldown
        const current = await getUserBiome(userId);
        if (current.changedAt) {
            const timeSinceChange = Date.now() - current.changedAt;
            if (timeSinceChange < BIOME_CHANGE_COOLDOWN) {
                const remainingMs = BIOME_CHANGE_COOLDOWN - timeSinceChange;
                const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
                return { 
                    success: false, 
                    error: `You can change biome again in ${remainingHours} hour(s).` 
                };
            }
        }
        
        // Update biome
        const now = Date.now();
        await run(
            `INSERT INTO userBiome (userId, biomeId, biomeChangedAt)
             VALUES (?, ?, ?)
             ON CONFLICT(userId) DO UPDATE SET
                biomeId = excluded.biomeId,
                biomeChangedAt = excluded.biomeChangedAt`,
            [userId, biomeId, now]
        );
        
        debugLog('BIOME', `User ${userId} changed biome to ${biomeId}`);
        
        return { success: true };
    });
}

/**
 * Check if user can change biome (cooldown check)
 * @param {string} userId 
 * @returns {Promise<{canChange: boolean, remainingMs?: number}>}
 */
async function canChangeBiome(userId) {
    const current = await getUserBiome(userId);
    
    if (!current.changedAt) {
        return { canChange: true };
    }
    
    const timeSinceChange = Date.now() - current.changedAt;
    if (timeSinceChange >= BIOME_CHANGE_COOLDOWN) {
        return { canChange: true };
    }
    
    return { 
        canChange: false, 
        remainingMs: BIOME_CHANGE_COOLDOWN - timeSinceChange 
    };
}

/**
 * Get biome data with full config
 * @param {string} userId 
 * @returns {Promise<Object>}
 */
async function getUserBiomeData(userId) {
    const { biomeId, changedAt } = await getUserBiome(userId);
    const biomeConfig = getBiome(biomeId) || getDefaultBiome();
    
    const cooldownStatus = await canChangeBiome(userId);
    
    return {
        biomeId,
        biome: biomeConfig,
        changedAt,
        canChange: cooldownStatus.canChange,
        remainingMs: cooldownStatus.remainingMs || 0
    };
}

/**
 * Reset user biome to default (admin function or rebirth reset)
 * @param {string} userId 
 * @param {boolean} resetCooldown - Whether to also reset the cooldown
 */
async function resetUserBiome(userId, resetCooldown = true) {
    const defaultBiome = getDefaultBiome();
    
    if (resetCooldown) {
        await run(
            `INSERT INTO userBiome (userId, biomeId, biomeChangedAt)
             VALUES (?, ?, NULL)
             ON CONFLICT(userId) DO UPDATE SET
                biomeId = excluded.biomeId,
                biomeChangedAt = NULL`,
            [userId, defaultBiome.id]
        );
    } else {
        await run(
            `INSERT INTO userBiome (userId, biomeId)
             VALUES (?, ?)
             ON CONFLICT(userId) DO UPDATE SET
                biomeId = excluded.biomeId`,
            [userId, defaultBiome.id]
        );
    }
    
    debugLog('BIOME', `Reset biome for user ${userId}`);
}

module.exports = {
    getUserBiome,
    setUserBiome,
    canChangeBiome,
    getUserBiomeData,
    resetUserBiome
};
