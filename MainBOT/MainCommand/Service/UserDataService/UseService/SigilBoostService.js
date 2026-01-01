const { get, all, run } = require('../../../Core/database');

const SIGIL_SOURCES = ['S!gil', 'GoldenSigil', 'CrystalSigil', 'VoidCrystal', 'EternalEssence', 'CosmicCore'];

// Special variant types from Tier 6 items
const SPECIAL_VARIANT_TYPES = {
    GLITCHED: {
        tag: '[🔮GLITCHED]',
        emoji: '🔮',
        sources: ['S!gil', 'CosmicCore']
    },
    VOID: {
        tag: '[🌀VOID]',
        emoji: '🌀',
        sources: ['VoidCrystal']
    }
};

async function isSigilActive(userId) {
    const sigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, Date.now()]
    );
    return !!sigil;
}

async function getActiveBoostsWithSigilCheck(userId) {
    const sigilActive = await isSigilActive(userId);
    
    if (sigilActive) {
        // Only return S!gil boosts when S!gil is active
        return all(
            `SELECT * FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, Date.now()]
        );
    }
    
    // Return all non-disabled boosts
    return all(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? 
         AND (expiresAt IS NULL OR expiresAt > ?)
         AND (json_extract(extra, '$.sigilDisabled') IS NULL OR json_extract(extra, '$.sigilDisabled') = 0)`,
        [userId, Date.now()]
    );
}

/**
 * Get remaining nullified rolls (TOTAL, not daily reset)
 */
async function getNullifiedRollsRemaining(userId) {
    const boost = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'nullifiedRolls'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, Date.now()]
    );
    
    if (!boost) return 0;
    
    try {
        const extra = JSON.parse(boost.extra || '{}');
        return Math.max(0, extra.remaining || 0);
    } catch {
        return 0;
    }
}

/**
 * Use a nullified roll (decrements total remaining)
 */
async function useNullifiedRoll(userId) {
    const remaining = await getNullifiedRollsRemaining(userId);
    if (remaining <= 0) return { success: false, remaining: 0 };
    
    const boost = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'nullifiedRolls'`,
        [userId]
    );
    
    if (!boost) return { success: false, remaining: 0 };
    
    try {
        const extra = JSON.parse(boost.extra || '{}');
        const newRemaining = Math.max(0, (extra.remaining || 0) - 1);
        extra.remaining = newRemaining;
        
        await run(
            `UPDATE activeBoosts SET extra = ?
             WHERE userId = ? AND source = 'S!gil' AND type = 'nullifiedRolls'`,
            [JSON.stringify(extra), userId]
        );
        
        return { success: true, remaining: newRemaining };
    } catch {
        return { success: false, remaining: 0 };
    }
}

async function shouldBlockAstralDuplicate(userId, fumoName, rarity) {
    // Check if astral block is active
    const block = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'astralBlock'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, Date.now()]
    );
    
    if (!block) return false;
    
    try {
        const extra = JSON.parse(block.extra || '{}');
        if (!extra.blocksAstralDuplicates) return false;
        
        // Check if ASTRAL+ rarity
        const astralPlusRarities = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        if (!astralPlusRarities.includes(rarity)) return false;
        
        // Check if user already has this fumo (any variant)
        const baseName = fumoName.replace(/\[.*?\]/g, '').trim();
        const existing = await get(
            `SELECT quantity FROM userInventory 
             WHERE userId = ? AND fumoName LIKE ?`,
            [userId, `%${baseName}%`]
        );
        
        return existing && existing.quantity > 0;
    } catch {
        return false;
    }
}

/**
 * Get combined variant luck multiplier from all sources
 * This affects SHINY and alG base variant chances
 */
async function getVariantLuckMultiplier(userId) {
    const now = Date.now();
    const sigilActive = await isSigilActive(userId);
    
    let multiplier = 1.0;
    
    if (sigilActive) {
        // Only use S!gil variant luck when active
        const sigilVariantLuck = await get(
            `SELECT multiplier FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'traitLuck'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        if (sigilVariantLuck) {
            multiplier *= sigilVariantLuck.multiplier;
        }
    } else {
        // Combine all non-disabled variant luck boosts
        const variantLuckBoosts = await all(
            `SELECT multiplier FROM activeBoosts 
             WHERE userId = ? AND type = 'traitLuck'
             AND (expiresAt IS NULL OR expiresAt > ?)
             AND (json_extract(extra, '$.sigilDisabled') IS NULL OR json_extract(extra, '$.sigilDisabled') = 0)`,
            [userId, now]
        );
        
        for (const boost of variantLuckBoosts) {
            multiplier *= boost.multiplier;
        }
    }
    
    return multiplier;
}

// Alias for backwards compatibility
const getTraitLuckMultiplier = getVariantLuckMultiplier;

async function cleanupExpiredSigilBoosts(userId) {
    const now = Date.now();
    
    // Check if S!gil has expired
    const sigil = await get(
        `SELECT expiresAt FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'`,
        [userId]
    );
    
    if (sigil && sigil.expiresAt && sigil.expiresAt <= now) {
        // Re-enable disabled boosts and restore frozen timers
        const disabledBoosts = await all(
            `SELECT userId, type, source, extra FROM activeBoosts 
             WHERE userId = ? AND source != 'S!gil'
             AND json_extract(extra, '$.sigilDisabled') = 1`,
            [userId]
        );
        
        for (const boost of disabledBoosts) {
            let extra = {};
            try {
                extra = JSON.parse(boost.extra || '{}');
            } catch {}
            
            // Restore the frozen timer if it was stored
            let newExpiresAt = null;
            if (extra.frozenTimeRemaining) {
                newExpiresAt = now + extra.frozenTimeRemaining;
            }
            
            // Remove the disabled flags
            delete extra.sigilDisabled;
            delete extra.frozenTimeRemaining;
            
            if (newExpiresAt) {
                await run(
                    `UPDATE activeBoosts SET extra = ?, expiresAt = ? WHERE userId = ? AND type = ? AND source = ?`,
                    [JSON.stringify(extra), newExpiresAt, boost.userId, boost.type, boost.source]
                );
            } else {
                await run(
                    `UPDATE activeBoosts SET extra = ? WHERE userId = ? AND type = ? AND source = ?`,
                    [JSON.stringify(extra), boost.userId, boost.type, boost.source]
                );
            }
        }
        
        // Remove all S!gil boosts
        await run(
            `DELETE FROM activeBoosts WHERE userId = ? AND source = 'S!gil'`,
            [userId]
        );
        
        return true; // Sigil expired and was cleaned up
    }
    
    return false;
}

async function getSigilBoostSummary(userId) {
    const boosts = await all(
        `SELECT type, multiplier, extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, Date.now()]
    );
    
    if (boosts.length === 0) return null;
    
    const summary = {};
    for (const boost of boosts) {
        summary[boost.type] = {
            multiplier: boost.multiplier,
            extra: boost.extra ? JSON.parse(boost.extra) : {}
        };
    }
    
    return summary;
}

module.exports = {
    isSigilActive,
    getActiveBoostsWithSigilCheck,
    getNullifiedRollsRemaining,
    useNullifiedRoll,
    shouldBlockAstralDuplicate,
    getVariantLuckMultiplier,
    getTraitLuckMultiplier, // Alias for backwards compatibility
    cleanupExpiredSigilBoosts,
    getSigilBoostSummary,
    SIGIL_SOURCES,
    SPECIAL_VARIANT_TYPES
};
