const { get, all, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

/**
 * Get Sanae boost multiplier (x2, x5, etc.) that applies to all other boosts
 */
async function getSanaeBoostMultiplier(userId) {
    try {
        const now = Date.now();
        const sanaeMultiplier = await get(
            `SELECT multiplier, expiresAt FROM activeBoosts 
             WHERE userId = ? AND type = 'boostMultiplier' AND source = 'SanaeBlessing' AND expiresAt > ?`,
            [userId, now]
        );
        
        return sanaeMultiplier?.multiplier || 1;
    } catch (error) {
        console.error('[BOOST] Sanae multiplier fetch error:', error);
        return 1;
    }
}

/**
 * Get all active boosts for a user including Sanae blessings
 */
async function getUserBoosts(userId) {
    debugLog('BOOST', `Fetching boosts for user ${userId}`);
    const startTime = Date.now();

    const now = Date.now();
    
    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, timeBlessing, timeClock, petBoosts, nullified, sanaeBoosts, sanaeBoostMultiplier] = await Promise.all([
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        get(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now]),
        all(`SELECT multiplier, source FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source NOT IN ('SanaeBlessing') AND expiresAt > ?`, [userId, now]),
        get(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]),
        getSanaeLuckBoosts(userId, now),
        getSanaeBoostMultiplier(userId)
    ]);

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
        baseDice = await calculateDiceMultiplier(userId, mysteriousDice);
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
        // For multipliers > 1, multiply by globalMultiplier
        // For multipliers = 1 (inactive), keep as 1
        if (baseAncient > 1) {
            ancientLuckMultiplier = baseAncient * globalMultiplier;
        }
        if (baseMysterious > 1) {
            mysteriousLuckMultiplier = baseMysterious * globalMultiplier;
        }
        if (baseDice > 1) {
            mysteriousDiceMultiplier = baseDice * globalMultiplier;
        }
        if (basePet > 1) {
            petBoost = basePet * globalMultiplier;
        }
    }

    // Sanae direct luck multiplier (x10 luck from SanaeBlessing) - also affected by global multiplier
    let sanaeLuckMultiplier = sanaeTempLuck?.multiplier || 1;
    if (globalMultiplier > 1 && sanaeLuckMultiplier > 1) {
        sanaeLuckMultiplier = sanaeLuckMultiplier * globalMultiplier;
    }

    const elapsed = Date.now() - startTime;
    debugLog('BOOST', `Boosts fetched in ${elapsed}ms`, {
        ancient: ancientLuckMultiplier,
        cube: mysteriousLuckMultiplier,
        dice: mysteriousDiceMultiplier,
        pet: petBoost,
        sanae: sanaeBoosts,
        sanaeTempLuck: sanaeLuckMultiplier,
        globalMultiplier
    });

    return {
        ancientLuckMultiplier,
        mysteriousLuckMultiplier,
        mysteriousDiceMultiplier,
        petBoost,
        luminaActive: !!lumina,
        timeBlessingMultiplier: timeBlessing?.multiplier || 1,
        timeClockMultiplier: timeClock?.multiplier || 1,
        nullifiedUses: nullified?.uses || 0,
        // Sanae-specific boosts
        sanaeLuckBoost: sanaeBoosts.luckBoost,
        sanaeLuckRollsRemaining: sanaeBoosts.luckRollsRemaining,
        sanaeGuaranteedRarity: sanaeBoosts.guaranteedRarity,
        sanaeGuaranteedRolls: sanaeBoosts.guaranteedRolls,
        sanaeTempLuckMultiplier: sanaeLuckMultiplier,
        sanaeGlobalMultiplier: globalMultiplier
    };
}

/**
 * Get Sanae-specific luck boosts from sanaeBlessings table
 */
async function getSanaeLuckBoosts(userId, now) {
    try {
        const sanaeData = await get(
            `SELECT luckForRolls, luckForRollsAmount, guaranteedRarityRolls, guaranteedMinRarity
             FROM sanaeBlessings WHERE userId = ?`,
            [userId]
        );

        if (!sanaeData) {
            return { 
                luckBoost: 0, 
                luckRollsRemaining: 0,
                guaranteedRarity: null, 
                guaranteedRolls: 0,
                permanentLuck: 0
            };
        }

        return {
            luckBoost: sanaeData.luckForRolls > 0 ? (sanaeData.luckForRollsAmount || 0) : 0,
            luckRollsRemaining: sanaeData.luckForRolls || 0,
            guaranteedRarity: sanaeData.guaranteedRarityRolls > 0 ? sanaeData.guaranteedMinRarity : null,
            guaranteedRolls: sanaeData.guaranteedRarityRolls || 0,
            permanentLuck: 0
        };
    } catch (error) {
        console.error('[BOOST] Sanae luck fetch error:', error);
        return { 
            luckBoost: 0, 
            luckRollsRemaining: 0,
            guaranteedRarity: null, 
            guaranteedRolls: 0,
            permanentLuck: 0
        };
    }
}

/**
 * Consume one Sanae luck roll and return the bonus
 */
async function consumeSanaeLuckRoll(userId) {
    try {
        const sanaeData = await get(
            `SELECT luckForRolls, luckForRollsAmount FROM sanaeBlessings WHERE userId = ?`,
            [userId]
        );

        if (!sanaeData || sanaeData.luckForRolls <= 0) {
            return { consumed: false, luckBonus: 0, remaining: 0 };
        }

        await run(
            `UPDATE sanaeBlessings SET luckForRolls = luckForRolls - 1, lastUpdated = ? WHERE userId = ?`,
            [Date.now(), userId]
        );

        return {
            consumed: true,
            luckBonus: sanaeData.luckForRollsAmount || 0,
            remaining: sanaeData.luckForRolls - 1
        };
    } catch (error) {
        console.error('[BOOST] Sanae luck consume error:', error);
        return { consumed: false, luckBonus: 0, remaining: 0 };
    }
}

/**
 * Consume one Sanae guaranteed rarity roll
 */
async function consumeSanaeGuaranteedRoll(userId) {
    try {
        const sanaeData = await get(
            `SELECT guaranteedRarityRolls, guaranteedMinRarity FROM sanaeBlessings WHERE userId = ?`,
            [userId]
        );

        if (!sanaeData || sanaeData.guaranteedRarityRolls <= 0) {
            return { consumed: false, minRarity: null, remaining: 0 };
        }

        await run(
            `UPDATE sanaeBlessings SET guaranteedRarityRolls = guaranteedRarityRolls - 1, lastUpdated = ? WHERE userId = ?`,
            [Date.now(), userId]
        );

        return {
            consumed: true,
            minRarity: sanaeData.guaranteedMinRarity,
            remaining: sanaeData.guaranteedRarityRolls - 1
        };
    } catch (error) {
        console.error('[BOOST] Sanae guaranteed consume error:', error);
        return { consumed: false, minRarity: null, remaining: 0 };
    }
}

/**
 * Calculate the mysterious dice multiplier for current hour
 */
async function calculateDiceMultiplier(userId, diceBoost) {
    let perHourArr = [];
    try {
        perHourArr = JSON.parse(diceBoost.extra || '[]');
    } catch {
        perHourArr = [];
    }

    const now = Date.now();
    const currentHourTimestamp = now - (now % (60 * 60 * 1000));
    let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

    if (!currentHour) {
        const newMultiplier = parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
        const newEntry = { at: currentHourTimestamp, multiplier: newMultiplier };

        perHourArr.push(newEntry);
        if (perHourArr.length > 12) perHourArr = perHourArr.slice(-12);

        await run(
            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
            [newMultiplier, JSON.stringify(perHourArr), userId]
        );

        return newMultiplier;
    }

    return currentHour.multiplier;
}

/**
 * Build boost display lines for UI
 */
function buildBoostLines(ancient, mysterious, dice, pet, lumina, sanaeBoosts = {}, sanaeLuckMultiplier = 1, globalMultiplier = 1) {
    const lines = [];
    
    if (ancient > 1) lines.push(`🎇 AncientRelic x${ancient.toFixed(2)}`);
    if (mysterious > 1) lines.push(`🧊 MysteriousCube x${mysterious.toFixed(2)}`);
    if (dice !== 1) lines.push(`🎲 MysteriousDice x${dice.toFixed(4)}`);
    if (pet > 1) lines.push(`🐰 Pet x${pet.toFixed(4)}`);
    if (lumina) lines.push('🌟 Lumina (Every 10th roll x5)');
    
    // Sanae direct luck multiplier (x10 from blessing)
    if (sanaeLuckMultiplier > 1) {
        lines.push(`⛩️ SanaeBlessing x${sanaeLuckMultiplier} Luck`);
    }
    
    // Sanae roll-based luck boosts
    if (sanaeBoosts.luckRolls > 0 && sanaeBoosts.luckBoost > 0) {
        lines.push(`⛩️ Sanae Luck +${(sanaeBoosts.luckBoost * 100).toFixed(0)}% (${sanaeBoosts.luckRolls} rolls)`);
    }
    if (sanaeBoosts.guaranteedRolls > 0 && sanaeBoosts.guaranteedRarity) {
        lines.push(`🎲 Guaranteed ${sanaeBoosts.guaranteedRarity}+ (${sanaeBoosts.guaranteedRolls} rolls)`);
    }
    
    // Global boost multiplier
    if (globalMultiplier > 1) {
        lines.push(`✨ All Boosts x${globalMultiplier} (Sanae Blessing)`);
    }
    
    return lines;
}

/**
 * Get Sanae boost display lines for gacha UI
 */
function getSanaeBoostDisplay(boosts) {
    const display = [];
    
    if (boosts.sanaeGuaranteedRolls > 0 && boosts.sanaeGuaranteedRarity) {
        display.push(`🎲 ${boosts.sanaeGuaranteedRolls} guaranteed ${boosts.sanaeGuaranteedRarity}+`);
    }
    
    if (boosts.sanaeLuckRollsRemaining > 0 && boosts.sanaeLuckBoost > 0) {
        display.push(`🍀 +${(boosts.sanaeLuckBoost * 100).toFixed(0)}% luck (${boosts.sanaeLuckRollsRemaining} rolls)`);
    }
    
    if (boosts.sanaeTempLuckMultiplier > 1) {
        display.push(`⛩️ x${boosts.sanaeTempLuckMultiplier} luck from Sanae`);
    }
    
    if (boosts.sanaeGlobalMultiplier > 1) {
        display.push(`✨ x${boosts.sanaeGlobalMultiplier} all boosts from Sanae`);
    }
    
    return display;
}

/**
 * Calculate total luck multiplier including all sources
 */
function calculateTotalLuckMultiplier(boosts, isBoostActive, rollsLeft, totalRolls, baseLuck = 0) {
    const bonusRollMultiplier = (rollsLeft > 0 && !isBoostActive) ? 2 : 1;
    
    // Start with base luck (permanent luck from Sanae, etc.) - minimum of 1 for multiplication
    const baseLuckMultiplier = Math.max(1, 1 + baseLuck);
    
    let totalLuck = baseLuckMultiplier * boosts.ancientLuckMultiplier * 
                    boosts.mysteriousLuckMultiplier * boosts.mysteriousDiceMultiplier * 
                    boosts.petBoost * bonusRollMultiplier;
    
    // Apply Sanae direct luck multiplier (x10, etc.)
    if (boosts.sanaeTempLuckMultiplier > 1) {
        totalLuck *= boosts.sanaeTempLuckMultiplier;
    }
    
    // Add Sanae luck boost (percentage based, for rolls)
    if (boosts.sanaeLuckBoost > 0 && boosts.sanaeLuckRollsRemaining > 0) {
        totalLuck *= (1 + boosts.sanaeLuckBoost);
    }
    
    // Lumina boost every 10th roll
    if (boosts.luminaActive && totalRolls % 10 === 0) {
        totalLuck *= 5;
    }
    
    return totalLuck;
}

/**
 * Calculate summon cooldown with boosts
 */
async function calculateCooldown(userId) {
    const COOLDOWN_DURATION = 4000;
    const now = Date.now();
    let cooldown = COOLDOWN_DURATION;

    const [timeBlessing, timeClock] = await Promise.all([
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now])
    ]);

    if (timeBlessing?.multiplier) cooldown *= timeBlessing.multiplier;
    if (timeClock?.multiplier === 2) cooldown = Math.floor(cooldown / 2);

    return cooldown;
}

/**
 * Check if user should get guaranteed rarity from Sanae blessing
 */
async function checkSanaeGuaranteedRarity(userId) {
    const sanaeData = await get(
        `SELECT guaranteedRarityRolls, guaranteedMinRarity FROM sanaeBlessings WHERE userId = ?`,
        [userId]
    );
    
    if (!sanaeData || sanaeData.guaranteedRarityRolls <= 0) {
        return { active: false, minRarity: null };
    }
    
    return {
        active: true,
        minRarity: sanaeData.guaranteedMinRarity,
        remaining: sanaeData.guaranteedRarityRolls
    };
}

module.exports = {
    getUserBoosts,
    getSanaeLuckBoosts,
    getSanaeBoostMultiplier,
    calculateDiceMultiplier,
    buildBoostLines,
    calculateTotalLuckMultiplier,
    consumeSanaeGuaranteedRoll,
    consumeSanaeLuckRoll,
    getSanaeBoostDisplay,
    calculateCooldown,
    checkSanaeGuaranteedRarity
};