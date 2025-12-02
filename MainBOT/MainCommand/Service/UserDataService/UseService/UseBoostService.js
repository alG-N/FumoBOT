const { get, run } = require('../../../Core/database');

async function applyBoost(userId, type, source, multiplier, expiresAt) {
    try {        
        const row = await get(
            `SELECT expiresAt FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
            [userId, type, source]
        );

        const now = Date.now();
        const newExpiresAt = (row && row.expiresAt > now)
            ? row.expiresAt + (expiresAt - now)
            : expiresAt;

        await run(
            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(userId, type, source) DO UPDATE SET
                multiplier = excluded.multiplier,
                expiresAt = excluded.expiresAt`,
            [userId, type, source, multiplier, newExpiresAt]
        );
                
    } catch (error) {
        console.error(`[BOOST_SERVICE] Error applying boost:`, error);
        throw error;
    }
}

async function applyMultipleBoosts(userId, boosts, duration) {    
    const now = Date.now();
    const expiresAt = now + duration;
    const errors = [];

    for (const { type, source, multiplier } of boosts) {
        try {
            await applyBoost(userId, type, source, multiplier, expiresAt);
        } catch (err) {
            console.error(`[BOOST_SERVICE] Failed to apply ${type} boost:`, err);
            errors.push({ type, source, error: err });
        }
    }

    if (errors.length > 0) {
        console.error(`[BOOST_SERVICE] Some boosts failed:`, errors);
        throw new Error(`Failed to apply ${errors.length} boost(s): ${errors.map(e => e.type).join(', ')}`);
    }
    
}

async function updateBoostStack(userId, type, source, increment = 1, maxStack = 10) {
    const row = await get(
        `SELECT stack FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
        [userId, type, source]
    );

    const currentStack = row?.stack || 0;

    if (currentStack >= maxStack) {
        return { 
            success: false, 
            currentStack: maxStack,
            message: 'Max stack reached'
        };
    }

    const newStack = currentStack + increment;
    await run(
        `UPDATE activeBoosts SET stack = ? WHERE userId = ? AND type = ? AND source = ?`,
        [newStack, userId, type, source]
    );

    return { 
        success: true, 
        currentStack: newStack,
        isNew: !row
    };
}

async function setBoostUses(userId, type, source, uses) {
    await run(
        `INSERT INTO activeBoosts (userId, type, source, multiplier, uses)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(userId, type, source) DO UPDATE SET uses = ?`,
        [userId, type, source, uses, uses]
    );
}

async function clearAllBoosts(userId, exceptSource = null) {
    if (exceptSource) {
        await run(
            `DELETE FROM activeBoosts WHERE userId = ? AND source != ?`,
            [userId, exceptSource]
        );
    } else {
        await run(
            `DELETE FROM activeBoosts WHERE userId = ?`,
            [userId]
        );
    }
}

module.exports = {
    applyBoost,
    applyMultipleBoosts,
    updateBoostStack,
    setBoostUses,
    clearAllBoosts
};