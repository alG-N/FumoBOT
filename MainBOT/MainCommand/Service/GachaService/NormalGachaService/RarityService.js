const { run } = require('../../../Core/database');
const { GACHA_THRESHOLDS, PITY_THRESHOLDS } = require('../../../Configuration/rarity');
const { calculateTotalLuckMultiplier } = require('./BoostService');
const { 
    checkGuaranteedRarity, 
    consumeGuaranteedRoll,
    checkLuckForRolls,
    consumeLuckRoll 
} = require('../../PrayService/CharacterHandlers/SanaeHandler/SanaeBlessingService');

const RARITY_ORDER = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

/**
 * Get the index of a rarity in the order (higher = rarer)
 */
function getRarityIndex(rarity) {
    const index = RARITY_ORDER.indexOf(rarity);
    return index === -1 ? 0 : index;
}

/**
 * Check if rarity1 is rarer than or equal to rarity2
 */
function isRarerOrEqual(rarity1, rarity2) {
    return getRarityIndex(rarity1) >= getRarityIndex(rarity2);
}

/**
 * Check if a rarity meets minimum requirement
 */
function meetsMinimumRarity(rarity, minRarity) {
    // Handle event rarities mapping
    const eventRarityMap = {
        'EPIC': 'EPIC',
        'LEGENDARY': 'LEGENDARY', 
        'MYTHICAL': 'MYTHICAL',
        '???': '???',
        'TRANSCENDENT': 'TRANSCENDENT'
    };
    
    const normalizedRarity = eventRarityMap[rarity] || rarity;
    const normalizedMin = eventRarityMap[minRarity] || minRarity;
    
    return getRarityIndex(normalizedRarity) >= getRarityIndex(normalizedMin);
}

/**
 * Get all rarities at or above a minimum rarity
 */
function getRaritiesAbove(minRarity) {
    const minIndex = getRarityIndex(minRarity);
    return RARITY_ORDER.filter((_, index) => index >= minIndex);
}

/**
 * Get all rarities below a maximum rarity
 */
function getRaritiesBelow(maxRarity) {
    const maxIndex = getRarityIndex(maxRarity);
    return RARITY_ORDER.filter((_, index) => index <= maxIndex);
}

/**
 * Compare two rarities
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
function compareRarities(rarityA, rarityB) {
    return getRarityIndex(rarityA) - getRarityIndex(rarityB);
}

/**
 * Get the next higher rarity
 */
function getNextRarity(rarity) {
    const index = getRarityIndex(rarity);
    if (index >= RARITY_ORDER.length - 1) return rarity;
    return RARITY_ORDER[index + 1];
}

/**
 * Get the next lower rarity
 */
function getPreviousRarity(rarity) {
    const index = getRarityIndex(rarity);
    if (index <= 0) return rarity;
    return RARITY_ORDER[index - 1];
}

/**
 * Calculate rarity WITHOUT database writes - for use in batched multi-roll
 * Returns the rarity and any pending updates to be applied after all rolls
 * @param {Object} boosts - Local boost state (mutable for tracking)
 * @param {Object} row - User data
 * @param {boolean} hasFantasyBook - Whether user has Fantasy Book
 * @returns {{rarity: string, pendingUpdates: Object}}
 */
function calculateRarityBatched(boosts, row, hasFantasyBook) {
    const pendingUpdates = {};
    
    // Check pity thresholds first (highest priority)
    if (hasFantasyBook) {
        if (row.pityTranscendent >= PITY_THRESHOLDS.TRANSCENDENT) {
            return { rarity: 'TRANSCENDENT', resetPity: 'pityTranscendent', pendingUpdates };
        }
        if (row.pityEternal >= PITY_THRESHOLDS.ETERNAL) {
            return { rarity: 'ETERNAL', resetPity: 'pityEternal', pendingUpdates };
        }
        if (row.pityInfinite >= PITY_THRESHOLDS.INFINITE) {
            return { rarity: 'INFINITE', resetPity: 'pityInfinite', pendingUpdates };
        }
        if (row.pityCelestial >= PITY_THRESHOLDS.CELESTIAL) {
            return { rarity: 'CELESTIAL', resetPity: 'pityCelestial', pendingUpdates };
        }
        if (row.pityAstral >= PITY_THRESHOLDS.ASTRAL) {
            return { rarity: 'ASTRAL', resetPity: 'pityAstral', pendingUpdates };
        }
    }

    // Check S!gil nullified rolls first (has ASTRAL+ duplicate blocking)
    if (boosts.sigilNullifiedRolls > 0) {
        const rarities = hasFantasyBook
            ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
            : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        // Track usage locally instead of DB write
        boosts.sigilNullifiedRolls--;
        pendingUpdates.sigilNullifiedUsed = (pendingUpdates.sigilNullifiedUsed || 0) + 1;

        return { rarity, nullifiedUsed: true, sigilNullified: true, pendingUpdates };
    }

    // Check regular Nullified item override
    if (boosts.nullifiedUses > 0) {
        const rarities = hasFantasyBook
            ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
            : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];
        
        // Track usage locally instead of DB write
        boosts.nullifiedUses--;
        pendingUpdates.nullifiedUsed = (pendingUpdates.nullifiedUsed || 0) + 1;

        return { rarity, nullifiedUsed: true, sigilNullified: false, pendingUpdates };
    }

    // Calculate total luck multiplier
    const totalLuck = calculateTotalLuckMultiplier(
        boosts, 
        row.boostActive && row.boostRollsRemaining > 0, 
        row.rollsLeft, 
        row.totalRolls,
        row.luck
    );
    
    // Roll for rarity with luck applied
    let rarityRoll = (Math.random() * 100) / totalLuck;

    // Check thresholds from rarest to common
    if (rarityRoll < GACHA_THRESHOLDS.TRANSCENDENT && hasFantasyBook) return { rarity: 'TRANSCENDENT', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.ETERNAL && hasFantasyBook) return { rarity: 'ETERNAL', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.INFINITE && hasFantasyBook) return { rarity: 'INFINITE', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.CELESTIAL && hasFantasyBook) return { rarity: 'CELESTIAL', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.ASTRAL && hasFantasyBook) return { rarity: 'ASTRAL', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.QUESTION && hasFantasyBook) return { rarity: '???', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.EXCLUSIVE) return { rarity: 'EXCLUSIVE', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.MYTHICAL) return { rarity: 'MYTHICAL', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.LEGENDARY) return { rarity: 'LEGENDARY', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.OTHERWORLDLY && hasFantasyBook) return { rarity: 'OTHERWORLDLY', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.EPIC) return { rarity: 'EPIC', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.RARE) return { rarity: 'RARE', pendingUpdates };
    if (rarityRoll < GACHA_THRESHOLDS.UNCOMMON) return { rarity: 'UNCOMMON', pendingUpdates };
    return { rarity: 'Common', pendingUpdates };
}

/**
 * Apply batched updates after multi-roll completes
 * @param {string} userId 
 * @param {Object} updates - Accumulated updates from batched rolls
 */
async function applyBatchedUpdates(userId, updates) {
    const promises = [];
    
    if (updates.sigilNullifiedUsed > 0) {
        promises.push(run(
            `UPDATE activeBoosts SET extra = json_set(COALESCE(extra, '{}'), '$.remaining', 
                COALESCE(json_extract(extra, '$.remaining'), 0) - ?) 
             WHERE userId = ? AND type = 'nullifiedRolls' AND source = 'S!gil'`,
            [updates.sigilNullifiedUsed, userId]
        ));
    }
    
    if (updates.nullifiedUsed > 0) {
        // Get current uses and update/delete accordingly
        promises.push((async () => {
            const current = await require('../../../Core/database').get(
                `SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                [userId]
            );
            if (current) {
                const newUses = (current.uses || 0) - updates.nullifiedUsed;
                if (newUses <= 0) {
                    await run(`DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]);
                } else {
                    await run(`UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [newUses, userId]);
                }
            }
        })());
    }
    
    if (updates.sanaeGuaranteedUsed > 0) {
        promises.push(run(
            `UPDATE sanaeBlessings SET guaranteedRarityRolls = MAX(0, guaranteedRarityRolls - ?), lastUpdated = ? WHERE userId = ?`,
            [updates.sanaeGuaranteedUsed, Date.now(), userId]
        ));
    }
    
    await Promise.all(promises);
}

/**
 * Main rarity calculation function with pity system and boosts
 */
async function calculateRarity(userId, boosts, row, hasFantasyBook) {
    // Check pity thresholds first (highest priority)
    if (hasFantasyBook) {
        if (row.pityTranscendent >= PITY_THRESHOLDS.TRANSCENDENT) {
            return { rarity: 'TRANSCENDENT', resetPity: 'pityTranscendent' };
        }
        if (row.pityEternal >= PITY_THRESHOLDS.ETERNAL) {
            return { rarity: 'ETERNAL', resetPity: 'pityEternal' };
        }
        if (row.pityInfinite >= PITY_THRESHOLDS.INFINITE) {
            return { rarity: 'INFINITE', resetPity: 'pityInfinite' };
        }
        if (row.pityCelestial >= PITY_THRESHOLDS.CELESTIAL) {
            return { rarity: 'CELESTIAL', resetPity: 'pityCelestial' };
        }
        if (row.pityAstral >= PITY_THRESHOLDS.ASTRAL) {
            return { rarity: 'ASTRAL', resetPity: 'pityAstral' };
        }
    }

    // Check S!gil nullified rolls first (has ASTRAL+ duplicate blocking)
    if (boosts.sigilNullifiedRolls > 0) {
        const rarities = hasFantasyBook
            ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
            : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];

        // Consume S!gil nullified roll (stored in extra.remaining)
        const newRemaining = boosts.sigilNullifiedRolls - 1;
        await run(
            `UPDATE activeBoosts SET extra = json_set(COALESCE(extra, '{}'), '$.remaining', ?) 
             WHERE userId = ? AND type = 'nullifiedRolls' AND source = 'S!gil'`,
            [newRemaining, userId]
        );

        // Return with sigilNullified flag for ASTRAL+ duplicate blocking
        return { rarity, nullifiedUsed: true, sigilNullified: true };
    }

    // Check regular Nullified item override (equal chance for all rarities, no ASTRAL+ blocking)
    if (boosts.nullifiedUses > 0) {
        const rarities = hasFantasyBook
            ? ['TRANSCENDENT', 'ETERNAL', 'INFINITE', 'CELESTIAL', 'ASTRAL', '???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'OTHERWORLDLY', 'EPIC', 'RARE', 'UNCOMMON', 'Common']
            : ['???', 'EXCLUSIVE', 'MYTHICAL', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'Common'];

        const rarity = rarities[Math.floor(Math.random() * rarities.length)];

        const remainingUses = boosts.nullifiedUses - 1;
        if (remainingUses > 0) {
            await run(`UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [remainingUses, userId]);
        } else {
            await run(`DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]);
        }

        return { rarity, nullifiedUsed: true, sigilNullified: false };
    }

    // Calculate total luck multiplier - now including base luck from row
    const totalLuck = calculateTotalLuckMultiplier(
        boosts, 
        row.boostActive && row.boostRollsRemaining > 0, 
        row.rollsLeft, 
        row.totalRolls,
        row.luck  // Pass the user's base luck stat
    );
    
    // Roll for rarity with luck applied
    let rarityRoll = (Math.random() * 100) / totalLuck;

    // Check thresholds from rarest to common
    if (rarityRoll < GACHA_THRESHOLDS.TRANSCENDENT && hasFantasyBook) return { rarity: 'TRANSCENDENT' };
    if (rarityRoll < GACHA_THRESHOLDS.ETERNAL && hasFantasyBook) return { rarity: 'ETERNAL' };
    if (rarityRoll < GACHA_THRESHOLDS.INFINITE && hasFantasyBook) return { rarity: 'INFINITE' };
    if (rarityRoll < GACHA_THRESHOLDS.CELESTIAL && hasFantasyBook) return { rarity: 'CELESTIAL' };
    if (rarityRoll < GACHA_THRESHOLDS.ASTRAL && hasFantasyBook) return { rarity: 'ASTRAL' };
    if (rarityRoll < GACHA_THRESHOLDS.QUESTION && hasFantasyBook) return { rarity: '???' };
    if (rarityRoll < GACHA_THRESHOLDS.EXCLUSIVE) return { rarity: 'EXCLUSIVE' };
    if (rarityRoll < GACHA_THRESHOLDS.MYTHICAL) return { rarity: 'MYTHICAL' };
    if (rarityRoll < GACHA_THRESHOLDS.LEGENDARY) return { rarity: 'LEGENDARY' };
    if (rarityRoll < GACHA_THRESHOLDS.OTHERWORLDLY && hasFantasyBook) return { rarity: 'OTHERWORLDLY' };
    if (rarityRoll < GACHA_THRESHOLDS.EPIC) return { rarity: 'EPIC' };
    if (rarityRoll < GACHA_THRESHOLDS.RARE) return { rarity: 'RARE' };
    if (rarityRoll < GACHA_THRESHOLDS.UNCOMMON) return { rarity: 'UNCOMMON' };
    return { rarity: 'Common' };
}

/**
 * Update pity counters after a roll
 */
function updatePityCounters(pities, rarity, hasFantasyBook) {
    if (!hasFantasyBook) return pities;

    return {
        pityTranscendent: rarity === 'TRANSCENDENT' ? 0 : pities.pityTranscendent + 1,
        pityEternal: rarity === 'ETERNAL' ? 0 : pities.pityEternal + 1,
        pityInfinite: rarity === 'INFINITE' ? 0 : pities.pityInfinite + 1,
        pityCelestial: rarity === 'CELESTIAL' ? 0 : pities.pityCelestial + 1,
        pityAstral: rarity === 'ASTRAL' ? 0 : pities.pityAstral + 1
    };
}

/**
 * Update boost charge system
 */
function updateBoostCharge(boostCharge, boostActive, boostRollsRemaining) {
    if (!boostActive) {
        boostCharge++;
        if (boostCharge >= 1000) {
            return { boostCharge: 0, boostActive: 1, boostRollsRemaining: 250 };
        }
        return { boostCharge, boostActive: 0, boostRollsRemaining: 0 };
    } else {
        boostRollsRemaining--;
        if (boostRollsRemaining <= 0) {
            return { boostCharge, boostActive: 0, boostRollsRemaining: 0 };
        }
        return { boostCharge, boostActive, boostRollsRemaining };
    }
}

/**
 * Apply Sanae guaranteed rarity blessing
 * Upgrades the selected rarity if it's below the guaranteed minimum
 */
async function applySanaeBlessings(userId, selectedRarity) {
    try {
        const guaranteedRarity = await checkGuaranteedRarity(userId);
        
        if (guaranteedRarity.active) {
            const minIndex = getRarityIndex(guaranteedRarity.minRarity);
            const currentIndex = getRarityIndex(selectedRarity);
            
            if (currentIndex < minIndex) {
                selectedRarity = guaranteedRarity.minRarity;
            }
            
            // Consume the guaranteed roll
            await consumeGuaranteedRoll(userId);
        }
        
        return selectedRarity;
    } catch (error) {
        console.error('[RarityService] Error applying Sanae blessings:', error);
        return selectedRarity;
    }
}

/**
 * Get Sanae luck bonus for current roll
 */
async function getSanaeLuckBonus(userId) {
    try {
        const luckBonus = await checkLuckForRolls(userId);
        
        if (luckBonus.active) {
            await consumeLuckRoll(userId);
            return luckBonus.luckBonus;
        }
        
        return 0;
    } catch (error) {
        console.error('[RarityService] Error getting Sanae luck bonus:', error);
        return 0;
    }
}

/**
 * Calculate total luck including Sanae blessing bonus
 */
async function calculateTotalLuck(userId, baseLuck) {
    const sanaeBonus = await getSanaeLuckBonus(userId);
    return baseLuck + sanaeBonus;
}

/**
 * Check if rarity is considered "ultra rare"
 */
function isUltraRare(rarity) {
    const ultraRares = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
    return ultraRares.includes(rarity);
}

/**
 * Check if rarity is considered "high tier"
 */
function isHighTier(rarity) {
    const highTiers = ['LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
    return highTiers.includes(rarity);
}

/**
 * Get rarity display info (color, emoji)
 */
function getRarityInfo(rarity) {
    const colors = {
        Common: 0x808080,
        UNCOMMON: 0x1ABC9C,
        RARE: 0x3498DB,
        EPIC: 0x9B59B6,
        OTHERWORLDLY: 0xE91E63,
        LEGENDARY: 0xF39C12,
        MYTHICAL: 0xE74C3C,
        EXCLUSIVE: 0xFF69B4,
        '???': 0x2C3E50,
        ASTRAL: 0x00CED1,
        CELESTIAL: 0xFFD700,
        INFINITE: 0x8B00FF,
        ETERNAL: 0x00FF00,
        TRANSCENDENT: 0xFFFFFF
    };
    
    const emojis = {
        Common: '⚪',
        UNCOMMON: '🟢',
        RARE: '🔵',
        EPIC: '🟣',
        OTHERWORLDLY: '🌸',
        LEGENDARY: '🟠',
        MYTHICAL: '🔴',
        EXCLUSIVE: '💗',
        '???': '❓',
        ASTRAL: '🌟',
        CELESTIAL: '✨',
        INFINITE: '💜',
        ETERNAL: '💚',
        TRANSCENDENT: '🌈'
    };
    
    return {
        color: colors[rarity] || 0x808080,
        emoji: emojis[rarity] || '⚪',
        index: getRarityIndex(rarity)
    };
}

/**
 * Select rarity with pity system consideration (simplified version for standalone use)
 */
function selectRarityWithPity(luckMultiplier, pityCounters, guaranteedMinRarity = null) {
    // Check pity thresholds first
    if (pityCounters.transcendent >= PITY_THRESHOLDS.TRANSCENDENT) return 'TRANSCENDENT';
    if (pityCounters.eternal >= PITY_THRESHOLDS.ETERNAL) return 'ETERNAL';
    if (pityCounters.infinite >= PITY_THRESHOLDS.INFINITE) return 'INFINITE';
    if (pityCounters.celestial >= PITY_THRESHOLDS.CELESTIAL) return 'CELESTIAL';
    if (pityCounters.astral >= PITY_THRESHOLDS.ASTRAL) return 'ASTRAL';
    if (pityCounters.mythical >= PITY_THRESHOLDS.MYTHICAL) return 'MYTHICAL';
    
    // Roll with luck
    let rarityRoll = (Math.random() * 100) / luckMultiplier;
    let selectedRarity = 'Common';
    
    if (rarityRoll < GACHA_THRESHOLDS.TRANSCENDENT) selectedRarity = 'TRANSCENDENT';
    else if (rarityRoll < GACHA_THRESHOLDS.ETERNAL) selectedRarity = 'ETERNAL';
    else if (rarityRoll < GACHA_THRESHOLDS.INFINITE) selectedRarity = 'INFINITE';
    else if (rarityRoll < GACHA_THRESHOLDS.CELESTIAL) selectedRarity = 'CELESTIAL';
    else if (rarityRoll < GACHA_THRESHOLDS.ASTRAL) selectedRarity = 'ASTRAL';
    else if (rarityRoll < GACHA_THRESHOLDS.QUESTION) selectedRarity = '???';
    else if (rarityRoll < GACHA_THRESHOLDS.EXCLUSIVE) selectedRarity = 'EXCLUSIVE';
    else if (rarityRoll < GACHA_THRESHOLDS.MYTHICAL) selectedRarity = 'MYTHICAL';
    else if (rarityRoll < GACHA_THRESHOLDS.LEGENDARY) selectedRarity = 'LEGENDARY';
    else if (rarityRoll < GACHA_THRESHOLDS.OTHERWORLDLY) selectedRarity = 'OTHERWORLDLY';
    else if (rarityRoll < GACHA_THRESHOLDS.EPIC) selectedRarity = 'EPIC';
    else if (rarityRoll < GACHA_THRESHOLDS.RARE) selectedRarity = 'RARE';
    else if (rarityRoll < GACHA_THRESHOLDS.UNCOMMON) selectedRarity = 'UNCOMMON';
    
    // Apply guaranteed minimum rarity if specified
    if (guaranteedMinRarity && !meetsMinimumRarity(selectedRarity, guaranteedMinRarity)) {
        selectedRarity = guaranteedMinRarity;
    }
    
    return selectedRarity;
}

module.exports = {
    // Core rarity functions
    RARITY_ORDER,
    getRarityIndex,
    isRarerOrEqual,
    meetsMinimumRarity,
    getRaritiesAbove,
    getRaritiesBelow,
    compareRarities,
    getNextRarity,
    getPreviousRarity,
    
    // Main gacha functions
    calculateRarity,
    calculateRarityBatched,
    applyBatchedUpdates,
    updatePityCounters,
    updateBoostCharge,
    selectRarityWithPity,
    
    // Sanae blessing integration
    applySanaeBlessings,
    getSanaeLuckBonus,
    calculateTotalLuck,
    
    // Utility functions
    isUltraRare,
    isHighTier,
    getRarityInfo
};