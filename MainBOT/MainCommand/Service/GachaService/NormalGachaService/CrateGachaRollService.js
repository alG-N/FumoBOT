const { get, run } = require('../../../Core/database');
const { getUserBoosts } = require('./BoostService');
const { calculateRarity, updatePityCounters, updateBoostCharge } = require('./RarityService');
const { selectAndAddFumo, selectAndAddMultipleFumos } = require('./InventoryService');
const { ASTRAL_PLUS_RARITIES, isRarer } = require('../../../Configuration/rarity');
const { incrementWeeklyAstral } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');

async function updateQuestsAndAchievements(userId, rollCount) {
    const { getWeekIdentifier } = require('../../../Ultility/weekly');
    const weekId = getWeekIdentifier();

    await Promise.all([
        run(
            `INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date) 
             VALUES (?, 'roll_1000', ?, 0, DATE('now')) 
             ON CONFLICT(userId, questId, date) DO UPDATE SET 
             progress = MIN(progress + ?, 1000), 
             completed = CASE WHEN progress + ? >= 1000 THEN 1 ELSE completed END`,
            [userId, rollCount, rollCount, rollCount]
        ),
        run(
            `INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week) 
             VALUES (?, 'roll_15000', ?, 0, ?) 
             ON CONFLICT(userId, questId, week) DO UPDATE SET 
             progress = MIN(progress + ?, 15000), 
             completed = CASE WHEN progress + ? >= 15000 THEN 1 ELSE completed END`,
            [userId, rollCount, weekId, rollCount, rollCount]
        ),
        run(
            `INSERT INTO achievementProgress (userId, achievementId, progress, claimed) 
             VALUES (?, 'total_rolls', ?, 0) 
             ON CONFLICT(userId, achievementId) DO UPDATE SET progress = progress + ?`,
            [userId, rollCount, rollCount]
        )
    ]);
}

async function getUserRollData(userId) {
    return await get(
        `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
         pityInfinite, pityCelestial, pityAstral, rollsLeft, totalRolls, hasFantasyBook, luck 
         FROM userCoins WHERE userId = ?`,
        [userId]
    );
}

async function updateUserAfterRoll(userId, updates) {
    await run(
        `UPDATE userCoins SET
            coins = coins - ?,
            totalRolls = totalRolls + ?,
            boostCharge = ?,
            boostActive = ?,
            boostRollsRemaining = ?,
            pityTranscendent = ?,
            pityEternal = ?,
            pityInfinite = ?,
            pityCelestial = ?,
            pityAstral = ?,
            rollsLeft = CASE WHEN rollsLeft >= ? THEN rollsLeft - ? ELSE 0 END
        WHERE userId = ?`,
        [
            updates.cost,
            updates.rollCount,
            updates.boostCharge,
            updates.boostActive,
            updates.boostRollsRemaining,
            updates.pityTranscendent,
            updates.pityEternal,
            updates.pityInfinite,
            updates.pityCelestial,
            updates.pityAstral,
            updates.rollCount,
            updates.rollCount,
            userId
        ]
    );
}

async function performSingleRoll(userId, fumos) {
    debugLog('ROLL', `Single roll for user ${userId}`);
    
    const row = await getUserRollData(userId);
    if (!row || row.coins < 100) {
        return { success: false, error: 'INSUFFICIENT_COINS' };
    }

    const hasFantasyBook = !!row.hasFantasyBook;
    const boosts = await getUserBoosts(userId);

    const { rarity } = await calculateRarity(userId, boosts, row, hasFantasyBook);

    if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
        await incrementWeeklyAstral(userId);
    }

    const boostUpdates = updateBoostCharge(row.boostCharge, row.boostActive, row.boostRollsRemaining);
    const updatedPities = updatePityCounters(
        {
            pityTranscendent: row.pityTranscendent,
            pityEternal: row.pityEternal,
            pityInfinite: row.pityInfinite,
            pityCelestial: row.pityCelestial,
            pityAstral: row.pityAstral
        },
        rarity,
        hasFantasyBook
    );

    const fumo = await selectAndAddFumo(userId, rarity, fumos, row.luck);
    if (!fumo) {
        return { success: false, error: 'NO_FUMO_FOUND' };
    }

    await updateUserAfterRoll(userId, {
        cost: 100,
        rollCount: 1,
        boostCharge: boostUpdates.boostCharge,
        boostActive: boostUpdates.boostActive,
        boostRollsRemaining: boostUpdates.boostRollsRemaining,
        ...updatedPities
    });

    await updateQuestsAndAchievements(userId, 1);

    return { success: true, fumo, rarity };
}

async function performMultiRoll(userId, fumos, rollCount) {
    debugLog('ROLL', `${rollCount}x roll for user ${userId}`);
    
    const cost = rollCount * 100;
    const row = await getUserRollData(userId);
    
    if (!row || row.coins < cost) {
        return { success: false, error: 'INSUFFICIENT_COINS' };
    }

    const hasFantasyBook = !!row.hasFantasyBook;
    const boosts = await getUserBoosts(userId);

    let { boostCharge, boostActive, boostRollsRemaining } = row;
    let pities = {
        pityTranscendent: row.pityTranscendent,
        pityEternal: row.pityEternal,
        pityInfinite: row.pityInfinite,
        pityCelestial: row.pityCelestial,
        pityAstral: row.pityAstral
    };

    const rarities = [];
    let currentRolls = row.totalRolls;

    for (let i = 0; i < rollCount; i++) {
        currentRolls++;

        const tempRow = {
            ...row,
            boostActive,
            boostRollsRemaining,
            totalRolls: currentRolls,
            ...pities
        };

        const { rarity } = await calculateRarity(userId, boosts, tempRow, hasFantasyBook);
        rarities.push(rarity);

        if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
            await incrementWeeklyAstral(userId);
        }

        pities = updatePityCounters(pities, rarity, hasFantasyBook);

        const boostUpdate = updateBoostCharge(boostCharge, boostActive, boostRollsRemaining);
        boostCharge = boostUpdate.boostCharge;
        boostActive = boostUpdate.boostActive;
        boostRollsRemaining = boostUpdate.boostRollsRemaining;
    }

    const fumosBought = await selectAndAddMultipleFumos(userId, rarities, fumos, row.luck);
    
    let bestFumo = null;
    if (fumosBought.length > 0) {
        bestFumo = fumosBought[0];
        for (const fumo of fumosBought) {
            if (isRarer(fumo.rarity, bestFumo.rarity)) {
                bestFumo = fumo;
            }
        }
    }

    await updateUserAfterRoll(userId, {
        cost,
        rollCount,
        boostCharge,
        boostActive,
        boostRollsRemaining,
        ...pities
    });

    await updateQuestsAndAchievements(userId, rollCount);

    return { success: true, fumosBought, bestFumo };
}

async function performBatch100Roll(userId, fumos) {
    const result = await performMultiRoll(userId, fumos, 100);
    return result.success ? result.bestFumo : null;
}

module.exports = {
    performSingleRoll,
    performMultiRoll,
    performBatch100Roll,
    updateQuestsAndAchievements,
    getUserRollData,
    updateUserAfterRoll
};