const { get, run } = require('../../../Core/database');
const { getUserBoosts, calculateTotalLuckMultiplier, consumeSanaeLuckRoll, consumeSanaeGuaranteedRoll } = require('./BoostService');
const { calculateRarity, updatePityCounters, updateBoostCharge, meetsMinimumRarity } = require('./RarityService');
const { selectAndAddFumo, selectAndAddMultipleFumos } = require('./InventoryService');
const { ASTRAL_PLUS_RARITIES, isRarer } = require('../../../Configuration/rarity');
const { incrementWeeklyAstral } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');

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
    const rollsLeftDeduction = updates.isAutoRoll ? 0 : updates.rollCount;
    
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
            rollsLeft = CASE 
                WHEN rollsLeft >= ? THEN rollsLeft - ?
                ELSE 0 
            END
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
            rollsLeftDeduction, 
            rollsLeftDeduction, 
            userId
        ]
    );
}

async function performSingleRoll(userId, fumos) {
    debugLog('ROLL', `Single roll for user ${userId}`);
    
    try {
        // OPTIMIZED: Fetch storage check, user data, and boosts in parallel
        const [storageCheck, row, boosts] = await Promise.all([
            StorageLimitService.canAddFumos(userId, 1),
            getUserRollData(userId),
            getUserBoosts(userId)
        ]);
        
        if (!storageCheck.canAdd) {
            return { 
                success: false, 
                error: 'STORAGE_FULL',
                storageStatus: storageCheck
            };
        }

        if (!row || row.coins < 100) {
            return { success: false, error: 'INSUFFICIENT_COINS' };
        }

        const hasFantasyBook = !!row.hasFantasyBook;

        // Check for Sanae guaranteed rarity
        let sanaeGuaranteedUsed = false;
        const sanaeGuaranteed = boosts.sanaeGuaranteedRolls || 0;
        const sanaeMinRarity = boosts.sanaeGuaranteedRarity || null;

        let { rarity } = await calculateRarity(userId, boosts, row, hasFantasyBook);

        // Apply Sanae guaranteed rarity if available
        if (sanaeGuaranteed > 0 && sanaeMinRarity) {
            if (!meetsMinimumRarity(rarity, sanaeMinRarity)) {
                rarity = sanaeMinRarity;
            }
            await consumeSanaeGuaranteedRoll(userId);
            sanaeGuaranteedUsed = true;
        }

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

        const fumoResult = await selectAndAddFumo(userId, rarity, fumos);
        if (!fumoResult || !fumoResult.success) {
            return { success: false, error: fumoResult?.reason || 'NO_FUMO_FOUND' };
        }
        const fumo = fumoResult.fumo;

        await updateUserAfterRoll(userId, {
            cost: 100,
            rollCount: 1,
            boostCharge: boostUpdates.boostCharge,
            boostActive: boostUpdates.boostActive,
            boostRollsRemaining: boostUpdates.boostRollsRemaining,
            ...updatedPities,
            isAutoRoll: false
        });

        await updateQuestsAndAchievements(userId, 1);

        return { success: true, fumo, rarity, sanaeGuaranteedUsed };
    } catch (error) {
        console.error('❌ Error in performSingleRoll:', error);
        debugLog('ROLL_ERROR', `Single roll failed for ${userId}: ${error.message}`);
        return { success: false, error: 'ROLL_FAILED', details: error.message };
    }
}

async function performMultiRoll(userId, fumos, rollCount, isAutoRoll = false) {
    debugLog('ROLL', `${rollCount}x roll for user ${userId} (autoRoll: ${isAutoRoll})`);
    
    try {
        const cost = rollCount * 100;
        
        // OPTIMIZED: Fetch user data and boosts in parallel
        const [row, boosts] = await Promise.all([
            getUserRollData(userId),
            getUserBoosts(userId)
        ]);
        
        if (!row || row.coins < cost) {
            return { success: false, error: 'INSUFFICIENT_COINS' };
        }

        const hasFantasyBook = !!row.hasFantasyBook;

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
        let sanaeGuaranteedUsed = 0;

        // Check how many guaranteed rolls we have
        let sanaeGuaranteedRemaining = boosts.sanaeGuaranteedRolls || 0;
        const sanaeMinRarity = boosts.sanaeGuaranteedRarity || null;

        for (let i = 0; i < rollCount; i++) {
            currentRolls++;

            const tempRow = {
                ...row,
                boostActive,
                boostRollsRemaining,
                totalRolls: currentRolls,
                ...pities
            };

            let { rarity } = await calculateRarity(userId, boosts, tempRow, hasFantasyBook);

            // Check if we should use Sanae guaranteed rarity
            if (sanaeGuaranteedRemaining > 0 && sanaeMinRarity) {
                if (!meetsMinimumRarity(rarity, sanaeMinRarity)) {
                    rarity = sanaeMinRarity;
                }
                sanaeGuaranteedRemaining--;
                sanaeGuaranteedUsed++;
                
                // Consume the guaranteed roll from database
                await consumeSanaeGuaranteedRoll(userId);
            }

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

        const fumoResults = await selectAndAddMultipleFumos(userId, rarities, fumos);
        
        // Check if we hit storage limit
        const storageError = fumoResults.find(r => !r.success && r.reason === 'storage_full');
        if (storageError) {
            return {
                success: false,
                error: 'STORAGE_FULL',
                storageStatus: storageError.storageCheck
            };
        }
        
        // Extract successful fumos
        const fumoArray = fumoResults.filter(r => r.success).map(r => r.fumo);
        
        let bestFumo = null;
        if (fumoArray.length > 0) {
            bestFumo = fumoArray[0];
            for (const fumo of fumoArray) {
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
            ...pities,
            isAutoRoll
        });

        await updateQuestsAndAchievements(userId, rollCount);

        const storageStatus = await StorageLimitService.getStorageStatus(userId);
        const storageWarning = storageStatus.status !== 'NORMAL' ? storageStatus : null;

        return { 
            success: true, 
            fumosBought: fumoArray, 
            bestFumo,
            storageWarning,
            sanaeGuaranteedUsed
        };
    } catch (error) {
        console.error(`❌ Error in performMultiRoll (${rollCount}x):`, error);
        debugLog('ROLL_ERROR', `Multi roll failed for ${userId}: ${error.message}`);
        return { success: false, error: 'ROLL_FAILED', details: error.message };
    }
}

async function performBatch100Roll(userId, fumos) {
    const result = await performMultiRoll(userId, fumos, 100, true);
    if (result.success) {
        return result.bestFumo;
    }
    return null;
}

module.exports = {
    performSingleRoll,
    performMultiRoll,
    performBatch100Roll,
    updateQuestsAndAchievements,
    getUserRollData,
    updateUserAfterRoll
};