const { get, all, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

/**
 * Check if S!gil is currently active for a user
 * When active, only S!gil boosts apply
 */
async function isSigilActive(userId) {
    const now = Date.now();
    const sigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    return !!sigil;
}

/**
 * Get Sanae boost multiplier (x2, x5, etc.) that applies to all other boosts
 */
async function getSanaeBoostMultiplier(userId) {
    // If S!gil is active, Sanae boosts don't apply
    if (await isSigilActive(userId)) {
        return 1;
    }
    
    const now = Date.now();
    const sanaeBoost = await get(
        `SELECT boostMultiplier FROM sanaeBlessings 
         WHERE userId = ? AND boostMultiplierExpiry > ?`,
        [userId, now]
    );
    return sanaeBoost?.boostMultiplier || 1;
}

/**
 * Get all active boosts for a user including Sanae blessings
 * Returns formatted object for UI display
 */
async function getUserBoosts(userId) {
    debugLog('BOOST', `Fetching boosts for user ${userId}`);
    const startTime = Date.now();

    const now = Date.now();
    
    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, timeBlessing, timeClock, petBoosts, nullified, sigilNullified, sanaeBoostMultiplier, sanaeData] = await Promise.all([
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        get(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now]),
        all(`SELECT multiplier, source FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source NOT IN ('SanaeBlessing', 'S!gil', 'AncientRelic', 'MysteriousCube', 'MysteriousDice') AND expiresAt > ?`, [userId, now]),
        get(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]),
        get(`SELECT extra FROM activeBoosts WHERE userId = ? AND type = 'nullifiedRolls' AND source = 'S!gil' AND (expiresAt IS NULL OR expiresAt > ?)`, [userId, now]),
        getSanaeBoostMultiplier(userId),
        get(`SELECT luckForRolls, luckForRollsAmount, guaranteedRarityRolls, guaranteedMinRarity FROM sanaeBlessings WHERE userId = ?`, [userId])
    ]);

    // Parse S!gil nullified rolls from extra JSON
    let sigilNullifiedRolls = 0;
    if (sigilNullified?.extra) {
        try {
            const extra = JSON.parse(sigilNullified.extra);
            sigilNullifiedRolls = extra.remaining || 0;
        } catch {}
    }

    // Get Sanae temporary luck boost from activeBoosts (this is different from the roll-based luck)
    const sanaeTempLuck = await get(
        `SELECT multiplier, expiresAt FROM activeBoosts 
         WHERE userId = ? AND type = 'luck' AND source = 'SanaeBlessing' AND expiresAt > ?`,
        [userId, now]
    );

    // Apply Sanae boost multiplier to all luck boosts
    const globalMultiplier = sanaeBoostMultiplier || 1;

    // Base multipliers before global boost
    let baseAncient = (ancientRelic && ancientRelic.expiresAt > now) ? ancientRelic.multiplier : 1;
    let baseMysterious = (mysteriousCube && mysteriousCube.expiresAt > now) ? mysteriousCube.multiplier : 1;

    let baseDice = 1;
    if (mysteriousDice && mysteriousDice.expiresAt > now) {
        baseDice = await getMysteriousDiceMultiplier(userId);
    }

    // Calculate pet boost (excluding Sanae from pet boosts)
    let basePet = 1;
    if (Array.isArray(petBoosts)) {
        for (const row of petBoosts) {
            if (row.source !== 'SanaeBlessing') {
                basePet *= (row.multiplier || 1);
            }
        }
    }

    // Apply global multiplier from Sanae blessing (x2, x5, etc.) - multiply the EFFECT, not the base
    let ancientLuckMultiplier = baseAncient;
    let mysteriousLuckMultiplier = baseMysterious;
    let mysteriousDiceMultiplier = baseDice;
    let petBoost = basePet;

    if (globalMultiplier > 1) {
        // Only multiply the boost effect of OTHER boosts, not the base
        // The global multiplier does NOT affect the Sanae direct luck itself
        if (baseAncient > 1) {
            ancientLuckMultiplier = 1 + ((baseAncient - 1) * globalMultiplier);
        }
        if (baseMysterious > 1) {
            mysteriousLuckMultiplier = 1 + ((baseMysterious - 1) * globalMultiplier);
        }
        if (baseDice > 1) {
            mysteriousDiceMultiplier = 1 + ((baseDice - 1) * globalMultiplier);
        } else if (baseDice < 1) {
            // For negative multipliers, also scale the effect
            mysteriousDiceMultiplier = 1 + ((baseDice - 1) * globalMultiplier);
        }
        if (basePet > 1) {
            petBoost = 1 + ((basePet - 1) * globalMultiplier);
        }
    }

    // Sanae direct luck multiplier (x50 luck from SanaeBlessing)
    // This is NOT affected by the global multiplier (it IS a Sanae blessing itself)
    let sanaeLuckMultiplier = sanaeTempLuck?.multiplier || 1;

    const elapsed = Date.now() - startTime;
    debugLog('BOOST', `Boosts fetched in ${elapsed}ms`, {
        ancient: ancientLuckMultiplier,
        cube: mysteriousLuckMultiplier,
        dice: mysteriousDiceMultiplier,
        pet: petBoost,
        sanaeTempLuck: sanaeLuckMultiplier,
        globalMultiplier
    });

    // Sanae roll-based boosts
    const sanaeGuaranteedRolls = sanaeData?.guaranteedRarityRolls || 0;
    const sanaeGuaranteedRarity = sanaeData?.guaranteedMinRarity || null;
    const sanaeLuckRollsRemaining = sanaeData?.luckForRolls || 0;
    const sanaeLuckBoost = sanaeData?.luckForRollsAmount || 0;

    // Get S!gil luck multiplier if active
    let sigilLuckMultiplier = 1;
    const sigilActive = await isSigilActive(userId);
    if (sigilActive) {
        const sigilLuck = await get(
            `SELECT multiplier FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'luck'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        sigilLuckMultiplier = sigilLuck?.multiplier || 1;
    }

    return {
        ancientLuckMultiplier,
        mysteriousLuckMultiplier,
        mysteriousDiceMultiplier,
        petBoost,
        luminaActive: !!lumina,
        nullifiedUses: nullified?.uses || 0,
        sigilNullifiedRolls,  // S!gil nullified rolls (separate from regular Nullified item)
        sanaeTempLuckMultiplier: sanaeLuckMultiplier,
        sanaeGlobalMultiplier: globalMultiplier,
        sanaeGuaranteedRolls,
        sanaeGuaranteedRarity,
        sanaeLuckRollsRemaining,
        sanaeLuckBoost,
        timeBlessing: timeBlessing?.multiplier || 1,
        timeClock: timeClock?.multiplier || 1,
        sigilLuckMultiplier
    };
}

/**
 * Get Sanae-specific luck boosts from sanaeBlessings table
 */
async function getSanaeLuckBoosts(userId, now) {
    const sanaeBoosts = [];
    
    const blessing = await get(
        `SELECT luckForRollsAmount, luckForRolls,
                guaranteedRarityRolls, guaranteedMinRarity
         FROM sanaeBlessings WHERE userId = ?`,
        [userId]
    );
    
    if (!blessing) return sanaeBoosts;
    
    // Per-roll luck boost
    if (blessing.luckForRolls > 0 && blessing.luckForRollsAmount) {
        sanaeBoosts.push({
            type: 'luckPerRoll',
            source: 'SanaeLuckRolls',
            multiplier: 1 + blessing.luckForRollsAmount,
            uses: blessing.luckForRolls
        });
    }
    
    // Guaranteed rarity rolls
    if (blessing.guaranteedRarityRolls > 0 && blessing.guaranteedMinRarity) {
        sanaeBoosts.push({
            type: 'guaranteedRarity',
            source: 'SanaeGuaranteed',
            minRarity: blessing.guaranteedMinRarity,
            uses: blessing.guaranteedRarityRolls
        });
    }
    
    return sanaeBoosts;
}

/**
 * Consume one Sanae luck roll and return the bonus
 */
async function consumeSanaeLuckRoll(userId) {
    // Don't consume if S!gil is active
    if (await isSigilActive(userId)) {
        return { consumed: false, bonus: 0 };
    }
    
    const blessing = await get(
        `SELECT luckForRollsAmount, luckForRolls 
         FROM sanaeBlessings WHERE userId = ?`,
        [userId]
    );
    
    if (!blessing || blessing.luckForRolls <= 0) {
        return { consumed: false, bonus: 0 };
    }
    
    await run(
        `UPDATE sanaeBlessings SET luckForRolls = luckForRolls - 1 WHERE userId = ?`,
        [userId]
    );
    
    return { consumed: true, bonus: blessing.luckForRollsAmount };
}

/**
 * Consume one Sanae guaranteed rarity roll
 */
async function consumeSanaeGuaranteedRoll(userId) {
    // Don't consume if S!gil is active
    if (await isSigilActive(userId)) {
        return { consumed: false, guaranteedRarity: null };
    }
    
    const blessing = await get(
        `SELECT guaranteedMinRarity, guaranteedRarityRolls 
         FROM sanaeBlessings WHERE userId = ?`,
        [userId]
    );
    
    if (!blessing || blessing.guaranteedRarityRolls <= 0) {
        return { consumed: false, guaranteedRarity: null };
    }
    
    await run(
        `UPDATE sanaeBlessings SET guaranteedRarityRolls = guaranteedRarityRolls - 1 WHERE userId = ?`,
        [userId]
    );
    
    return { consumed: true, guaranteedRarity: blessing.guaranteedMinRarity };
}

/**
 * Calculate the mysterious dice multiplier for current hour
 */
async function getMysteriousDiceMultiplier(userId) {
    // Mysterious dice doesn't work during S!gil
    if (await isSigilActive(userId)) {
        return 1;
    }
    
    const now = Date.now();
    const diceBoost = await get(
        `SELECT multiplier, extra FROM activeBoosts 
         WHERE userId = ? AND source = 'MysteriousDice' AND type = 'luck'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    if (!diceBoost) return 1;
    
    // Dice re-rolls multiplier every hour
    const currentHour = Math.floor(now / (60 * 60 * 1000));
    let extra = {};
    try {
        extra = JSON.parse(diceBoost.extra || '{}');
    } catch {}
    
    if (extra.lastHour !== currentHour) {
        // Generate new multiplier
        const newMultiplier = parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
        await run(
            `UPDATE activeBoosts SET multiplier = ?, extra = ? 
             WHERE userId = ? AND source = 'MysteriousDice' AND type = 'luck'`,
            [newMultiplier, JSON.stringify({ lastHour: currentHour }), userId]
        );
        return newMultiplier;
    }
    
    return diceBoost.multiplier;
}

/**
 * Get roll speed multiplier (from CrystalSigil or S!gil)
 */
async function getRollSpeedMultiplier(userId) {
    const now = Date.now();
    
    // Check S!gil first
    const sigilSpeed = await get(
        `SELECT multiplier FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'rollSpeed'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilSpeed) {
        return sigilSpeed.multiplier;
    }
    
    // Check CrystalSigil
    const crystalSpeed = await get(
        `SELECT multiplier FROM activeBoosts 
         WHERE userId = ? AND source = 'CrystalSigil' AND type = 'rollSpeed'
         AND expiresAt > ?`,
        [userId, now]
    );
    
    return crystalSpeed?.multiplier || 1;
}

/**
 * Calculate total luck multiplier from boosts object (for RarityService)
 */
function calculateTotalLuckMultiplier(boosts, isBoostActive, rollsLeft, totalRolls, baseLuck = 0) {
    // boosts is the object returned by getUserBoosts
    let total = 1;
    
    // Base luck from permanent stats
    if (baseLuck > 0) {
        total *= (1 + baseLuck);
    }
    
    // Ancient Relic
    if (boosts.ancientLuckMultiplier && boosts.ancientLuckMultiplier > 1) {
        total *= boosts.ancientLuckMultiplier;
    }
    
    // Mysterious Cube
    if (boosts.mysteriousLuckMultiplier && boosts.mysteriousLuckMultiplier > 1) {
        total *= boosts.mysteriousLuckMultiplier;
    }
    
    // Mysterious Dice
    if (boosts.mysteriousDiceMultiplier && boosts.mysteriousDiceMultiplier !== 1) {
        total *= boosts.mysteriousDiceMultiplier;
    }
    
    // Pet boost
    if (boosts.petBoost && boosts.petBoost > 1) {
        total *= boosts.petBoost;
    }
    
    // Sanae direct luck multiplier (x50, etc.)
    if (boosts.sanaeTempLuckMultiplier && boosts.sanaeTempLuckMultiplier > 1) {
        total *= boosts.sanaeTempLuckMultiplier;
    }
    
    // Sanae per-roll luck boost
    if (boosts.sanaeLuckRollsRemaining > 0 && boosts.sanaeLuckBoost > 0) {
        total *= (1 + boosts.sanaeLuckBoost);
    }
    
    // Boost mode active (25x luck)
    if (isBoostActive) {
        total *= 25;
    } else if (rollsLeft > 0) {
        // Bonus rolls (2x luck)
        total *= 2;
    }
    
    // Lumina (every 10th roll)
    if (boosts.luminaActive && totalRolls % 10 === 0) {
        total *= 5;
    }
    
    return total;
}

/**
 * Calculate auto-roll cooldown based on roll speed boost
 */
async function calculateCooldown(userId, baseCooldown = 3000) {
    const rollSpeed = await getRollSpeedMultiplier(userId);
    return Math.max(1000, Math.floor(baseCooldown / rollSpeed));
}

/**
 * Get Sanae boost display lines for UI (takes boosts object from getUserBoosts)
 */
function getSanaeBoostDisplay(boosts) {
    const lines = [];
    
    // Roll-based luck boost
    if (boosts.sanaeLuckRollsRemaining > 0 && boosts.sanaeLuckBoost > 0) {
        lines.push(`🍀 +${(boosts.sanaeLuckBoost * 100).toFixed(0)}% luck (${boosts.sanaeLuckRollsRemaining} rolls remaining)`);
    }
    
    // Guaranteed rarity rolls
    if (boosts.sanaeGuaranteedRolls > 0 && boosts.sanaeGuaranteedRarity) {
        lines.push(`✨ Guaranteed ${boosts.sanaeGuaranteedRarity}+ (${boosts.sanaeGuaranteedRolls} rolls remaining)`);
    }
    
    return lines;
}

/**
 * Migrate existing frozen boosts to have frozenTimeRemaining if they don't have it
 * This fixes boosts that were frozen before the frozenTimeRemaining feature was added
 */
async function migrateFrozenBoosts(userId) {
    const now = Date.now();
    
    // Find boosts that are marked as sigilDisabled but don't have frozenTimeRemaining
    // Note: activeBoosts uses (userId, type, source) as composite primary key, not id
    const boostsToMigrate = await all(
        `SELECT userId, type, source, expiresAt, extra FROM activeBoosts 
         WHERE userId = ? 
         AND json_extract(extra, '$.sigilDisabled') = 1
         AND json_extract(extra, '$.frozenTimeRemaining') IS NULL
         AND expiresAt > ?`,
        [userId, now]
    );
    
    if (boostsToMigrate.length > 0) {
        for (const boost of boostsToMigrate) {
            try {
                let extra = JSON.parse(boost.extra || '{}');
                // Calculate frozenTimeRemaining from current expiresAt
                extra.frozenTimeRemaining = boost.expiresAt - now;
                
                // Update using composite primary key
                await run(
                    `UPDATE activeBoosts SET extra = ? WHERE userId = ? AND type = ? AND source = ?`,
                    [JSON.stringify(extra), boost.userId, boost.type, boost.source]
                );
            } catch (e) {
                // Silently ignore migration errors
            }
        }
    }
}

/**
 * Get VOID and GLITCHED trait boost display lines with timer for gacha UI
 * S!gil has priority over CosmicCore for GLITCHED trait
 * When S!gil is active, non-S!gil boosts show frozen timer from stored frozenTimeRemaining
 */
async function getTraitBoostDisplay(userId) {
    const now = Date.now();
    const lines = [];
    
    // Clean up expired S!gil and unfreeze boosts BEFORE checking status
    await cleanupExpiredSigil(userId);
    
    // Check if S!gil is active (determines GLITCHED priority and timer freezing)
    const sigilRow = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    const sigilActive = !!sigilRow; // Convert to boolean
    
    // console.log(`[TraitBoostDisplay] userId=${userId}, sigilActive=${sigilActive}`);
    
    // If S!gil is active, migrate any frozen boosts that don't have frozenTimeRemaining
    if (sigilActive) {
        await migrateFrozenBoosts(userId);
    }
    
    // Get GLITCHED trait from S!gil
    const sigilGlitched = await get(
        `SELECT multiplier, expiresAt FROM activeBoosts 
         WHERE userId = ? AND type = 'glitchedTrait' AND source = 'S!gil' AND expiresAt > ?`,
        [userId, now]
    );
    
    // Get GLITCHED trait from CosmicCore (may be frozen if S!gil active)
    const cosmicGlitched = await get(
        `SELECT multiplier, expiresAt, stack, extra FROM activeBoosts 
         WHERE userId = ? AND type = 'glitchedTrait' AND source = 'CosmicCore'
         AND (expiresAt > ? OR json_extract(extra, '$.sigilDisabled') = 1)`,
        [userId, now]
    );
    
    // Helper to get display time - uses frozenTimeRemaining when frozen
    // If frozenTimeRemaining not stored (old boosts), we need to calculate and store it
    const getDisplayTime = (boost, isFrozen) => {
        if (isFrozen) {
            // Try to get frozenTimeRemaining from extra
            if (boost.extra) {
                try {
                    const extra = typeof boost.extra === 'string' ? JSON.parse(boost.extra) : boost.extra;
                    // If we have frozenTimeRemaining stored, use it (this is the FROZEN time that shouldn't decrease)
                    if (extra.frozenTimeRemaining && extra.frozenTimeRemaining > 0) {
                        return formatTimeRemaining(extra.frozenTimeRemaining);
                    }
                } catch (e) {
                    // Silently ignore parse errors
                }
            }
            // If frozen but no frozenTimeRemaining stored (old boosts before fix),
            // show remaining time but mark it needs migration
            const remaining = boost.expiresAt - now;
            return formatTimeRemaining(remaining > 0 ? remaining : 0);
        }
        // For non-frozen, calculate from expiresAt
        const calcTime = boost.expiresAt - now;
        return formatTimeRemaining(calcTime);
    };
    
    // Helper to check if boost has sigilDisabled flag in extra
    // SQLite stores boolean as 1/0, so check for both true and 1
    const hasSigilDisabledFlag = (boost) => {
        if (!boost?.extra) return false;
        try {
            const extra = typeof boost.extra === 'string' ? JSON.parse(boost.extra) : boost.extra;
            return extra.sigilDisabled === true || extra.sigilDisabled === 1;
        } catch {}
        return false;
    };
    
    // Display GLITCHED traits with active/deactivated status - all use "1 in X" format
    if (sigilGlitched && cosmicGlitched) {
        // Both exist - S!gil takes priority when active
        if (sigilActive) {
            const timeLeft = formatTimeRemaining(sigilGlitched.expiresAt - now);
            const oneInX = Math.round(1 / sigilGlitched.multiplier).toLocaleString();
            lines.push(`🔮 GLITCHED Trait (S!gil) — 1 in ${oneInX} (${timeLeft}) ✅`);
            
            // CosmicCore is frozen - show frozen time (use flag check OR sigilActive)
            const isFrozen = hasSigilDisabledFlag(cosmicGlitched) || sigilActive;
            const cosmicTime = getDisplayTime(cosmicGlitched, isFrozen);
            const cosmicOneInX = Math.round(1 / cosmicGlitched.multiplier).toLocaleString();
            lines.push(`🔮 GLITCHED Trait (CosmicCore) — 1 in ${cosmicOneInX} (${cosmicTime}) ❄️FROZEN`);
        } else {
            // S!gil not active, CosmicCore takes effect
            const cosmicTime = getDisplayTime(cosmicGlitched, false);
            const cosmicOneInX = Math.round(1 / cosmicGlitched.multiplier).toLocaleString();
            lines.push(`🔮 GLITCHED Trait (CosmicCore) — 1 in ${cosmicOneInX} (${cosmicTime}) ✅`);
            
            const timeLeft = formatTimeRemaining(sigilGlitched.expiresAt - now);
            const oneInX = Math.round(1 / sigilGlitched.multiplier).toLocaleString();
            lines.push(`🔮 GLITCHED Trait (S!gil) — 1 in ${oneInX} (${timeLeft}) ⏸️`);
        }
    } else if (sigilGlitched) {
        // Only S!gil GLITCHED
        const timeLeft = formatTimeRemaining(sigilGlitched.expiresAt - now);
        const oneInX = Math.round(1 / sigilGlitched.multiplier).toLocaleString();
        lines.push(`🔮 GLITCHED Trait (S!gil) — 1 in ${oneInX} (${timeLeft})`);
    } else if (cosmicGlitched) {
        // Only CosmicCore GLITCHED - check if frozen (flag OR sigil active)
        const isFrozen = hasSigilDisabledFlag(cosmicGlitched) || sigilActive;
        const timeLeft = getDisplayTime(cosmicGlitched, isFrozen);
        const oneInX = Math.round(1 / cosmicGlitched.multiplier).toLocaleString();
        const status = isFrozen ? ' ❄️FROZEN' : '';
        lines.push(`🔮 GLITCHED Trait (CosmicCore) — 1 in ${oneInX} (${timeLeft})${status}`);
    }
    
    // Get VOID trait from VoidCrystal (check if frozen by S!gil)
    const voidBoost = await get(
        `SELECT multiplier, expiresAt, stack, extra FROM activeBoosts 
         WHERE userId = ? AND type = 'voidTrait' AND source = 'VoidCrystal'
         AND (expiresAt > ? OR json_extract(extra, '$.sigilDisabled') = 1)`,
        [userId, now]
    );
    
    if (voidBoost) {
        // Check if VOID is frozen - by flag OR if S!gil is currently active
        const isFrozen = hasSigilDisabledFlag(voidBoost) || sigilActive;
        
        const timeLeft = getDisplayTime(voidBoost, isFrozen);
        const oneInX = Math.round(1 / voidBoost.multiplier).toLocaleString();
        const status = isFrozen ? ' ❄️FROZEN' : '';
        lines.push(`🌀 VOID Trait (VoidCrystal) — 1 in ${oneInX} (${timeLeft})${status}`);
    }
    
    return lines;
}

/**
 * Format milliseconds into a human-readable time string
 */
function formatTimeRemaining(ms) {
    if (ms <= 0) return 'Expired';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m`;
    }
    return `${seconds}s`;
}

/**
 * Check and consume a nullified roll (from S!gil or Nullified item)
 */
async function checkAndConsumeNullifiedRoll(userId) {
    const now = Date.now();
    
    // Check S!gil nullified rolls first
    const sigilNullified = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'nullifiedRolls'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (sigilNullified) {
        try {
            const extra = JSON.parse(sigilNullified.extra || '{}');
            if (extra.remaining > 0) {
                extra.remaining--;
                await run(
                    `UPDATE activeBoosts SET extra = ? 
                     WHERE userId = ? AND source = 'S!gil' AND type = 'nullifiedRolls'`,
                    [JSON.stringify(extra), userId]
                );
                return { nullified: true, source: 'S!gil', remaining: extra.remaining };
            }
        } catch {}
    }
    
    // Check regular Nullified item uses
    const nullifiedUses = await get(
        `SELECT uses FROM activeBoosts 
         WHERE userId = ? AND source = 'Nullified' AND type = 'rarityOverride'`,
        [userId]
    );
    
    if (nullifiedUses && nullifiedUses.uses > 0) {
        await run(
            `UPDATE activeBoosts SET uses = uses - 1 
             WHERE userId = ? AND source = 'Nullified' AND type = 'rarityOverride'`,
            [userId]
        );
        
        // Clean up if no uses left
        if (nullifiedUses.uses - 1 <= 0) {
            await run(
                `DELETE FROM activeBoosts 
                 WHERE userId = ? AND source = 'Nullified' AND type = 'rarityOverride'`,
                [userId]
            );
        }
        
        return { nullified: true, source: 'Nullified', remaining: nullifiedUses.uses - 1 };
    }
    
    return { nullified: false };
}

/**
 * Check if ASTRAL+ duplicates should be blocked (from S!gil)
 */
async function shouldBlockAstralDuplicate(userId) {
    const now = Date.now();
    
    const astralBlock = await get(
        `SELECT extra FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'astralBlock'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    if (astralBlock) {
        try {
            const extra = JSON.parse(astralBlock.extra || '{}');
            return extra.blocksAstralDuplicates === true;
        } catch {}
    }
    
    return false;
}

/**
 * Clean up expired S!gil and re-enable disabled boosts with restored timers
 * Also handles orphaned frozen boosts (frozen but no sigil exists)
 */
async function cleanupExpiredSigil(userId) {
    const now = Date.now();
    
    // Check if S!gil expired
    const expiredSigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND expiresAt IS NOT NULL AND expiresAt <= ?`,
        [userId, now]
    );
    
    if (expiredSigil) {
        // Delete all S!gil boosts
        await run(
            `DELETE FROM activeBoosts WHERE userId = ? AND source = 'S!gil'`,
            [userId]
        );
        console.log(`[cleanupExpiredSigil] Deleted expired S!gil for user ${userId}`);
    }
    
    // Check if there's an ACTIVE sigil
    const activeSigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    
    // If NO active sigil exists, unfreeze any orphaned frozen boosts
    if (!activeSigil) {
        const disabledBoosts = await all(
            `SELECT userId, type, source, extra FROM activeBoosts 
             WHERE userId = ? AND json_extract(extra, '$.sigilDisabled') = 1`,
            [userId]
        );
        
        if (disabledBoosts.length > 0) {
            console.log(`[cleanupExpiredSigil] Found ${disabledBoosts.length} orphaned frozen boosts for user ${userId}`);
            
            for (const boost of disabledBoosts) {
                let extra = {};
                try {
                    extra = JSON.parse(boost.extra || '{}');
                } catch {}
                
                // Restore the frozen timer if it was stored
                let newExpiresAt = null;
                if (extra.frozenTimeRemaining && extra.frozenTimeRemaining > 0) {
                    newExpiresAt = now + extra.frozenTimeRemaining;
                    console.log(`[cleanupExpiredSigil] Unfreezing ${boost.source}/${boost.type}, restoring ${Math.round(extra.frozenTimeRemaining / 60000)}m`);
                } else {
                    // No frozen time stored - keep current expiresAt but remove flag
                    console.log(`[cleanupExpiredSigil] Unfreezing ${boost.source}/${boost.type}, no frozen time stored`);
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
            
            debugLog(`[SIGIL] Unfroze ${disabledBoosts.length} orphaned boosts for user ${userId}`);
            return true;
        }
    }
    
    return !!expiredSigil;
}

module.exports = {
    getUserBoosts,
    calculateTotalLuckMultiplier,
    calculateCooldown,
    getSanaeBoostMultiplier,
    getSanaeLuckBoosts,
    consumeSanaeLuckRoll,
    consumeSanaeGuaranteedRoll,
    getMysteriousDiceMultiplier,
    getRollSpeedMultiplier,
    getSanaeBoostDisplay,
    getTraitBoostDisplay,
    isSigilActive,
    checkAndConsumeNullifiedRoll,
    shouldBlockAstralDuplicate,
    cleanupExpiredSigil
};