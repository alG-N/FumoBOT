const { run } = require('../../../Core/database');
const { GACHA_THRESHOLDS, PITY_THRESHOLDS } = require('../../../Configuration/rarity');
const { calculateTotalLuckMultiplier } = require('./BoostService');

async function calculateRarity(userId, boosts, row, hasFantasyBook) {
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

        return { rarity, nullifiedUsed: true };
    }

    const totalLuck = calculateTotalLuckMultiplier(
        boosts, 
        row.boostActive && row.boostRollsRemaining > 0, 
        row.rollsLeft, 
        row.totalRolls
    );
    let rarityRoll = (Math.random() * 100) / totalLuck;

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

module.exports = {
    calculateRarity,
    updatePityCounters,
    updateBoostCharge
};