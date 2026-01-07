const { get, run, withUserLock, atomicDeductCoins } = require('../../../Core/database');
const { getUserBoosts, calculateTotalLuckMultiplier, consumeSanaeLuckRoll, consumeSanaeGuaranteedRoll } = require('./BoostService');
const { calculateRarity, calculateRarityBatched, applyBatchedUpdates, updatePityCounters, updateBoostCharge, meetsMinimumRarity } = require('./RarityService');
const { selectAndAddFumo, selectAndAddMultipleFumos } = require('./InventoryService');
const { ASTRAL_PLUS_RARITIES, isRarer } = require('../../../Configuration/rarity');
const { incrementWeeklyAstral } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

// Lazy-load level service to avoid circular dependencies
let LevelDatabaseService = null;
let levelServiceLoadFailed = false;

function getLevelService() {
    if (levelServiceLoadFailed) return null; // Don't keep retrying if it failed
    
    if (!LevelDatabaseService) {
        try {
            LevelDatabaseService = require('../../UserDataService/LevelService/LevelDatabaseService');
        } catch (e) {
            levelServiceLoadFailed = true;
            console.error('[CrateGachaRollService] Could not load LevelDatabaseService:', e.message);
            return null;
        }
    }
    return LevelDatabaseService;
}

// Maximum pity counter value to prevent integer overflow
const MAX_PITY = 2147483647;

/**
 * Award EXP based on number of fumos rolled
 * 1 fumo = 1 EXP, 10 fumos = 10 EXP, etc.
 * @param {string} userId 
 * @param {number} rollCount - Number of fumos rolled
 */
async function awardRollExp(userId, rollCount) {
    if (!rollCount || rollCount <= 0) return;
    
    const levelService = getLevelService();
    if (!levelService) {
        console.warn('[CrateGachaRollService] LevelDatabaseService not available, skipping EXP award');
        return;
    }
    
    if (typeof levelService.addExp !== 'function') {
        console.error('[CrateGachaRollService] addExp is not a function on LevelDatabaseService');
        return;
    }
    
    try {
        const result = await levelService.addExp(userId, rollCount, 'crate_gacha');
        if (result && result.levelUps && result.levelUps.length > 0) {
            debugLog('LEVEL', `User ${userId} leveled up to ${result.newLevel} from gacha rolls!`);
        }
    } catch (error) {
        // Log the full error for debugging
        console.error('[CrateGachaRollService] Failed to award EXP:', error);
    }
}

async function updateQuestsAndAchievements(userId, rollCount) {
    // Use the new QuestMiddleware for tracking
    await QuestMiddleware.trackRoll(userId, rollCount);
    
    // Award EXP for rolling (1 fumo = 1 EXP)
    await awardRollExp(userId, rollCount);
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
    
    // STEP 1: Quick precondition checks OUTSIDE the lock
    const [storageCheck, initialRow] = await Promise.all([
        StorageLimitService.canAddFumos(userId, 1),
        getUserRollData(userId)
    ]);
    
    if (!storageCheck.canAdd) {
        return { 
            success: false, 
            error: 'STORAGE_FULL',
            storageStatus: storageCheck
        };
    }

    if (!initialRow || initialRow.coins < 100) {
        return { success: false, error: 'INSUFFICIENT_COINS' };
    }
    
    // STEP 2: Use lock ONLY for atomic coin deduction and state capture
    const lockResult = await withUserLock(userId, 'singleRoll', async () => {
        try {
            // Re-fetch inside lock to ensure consistency
            const [row, boosts] = await Promise.all([
                getUserRollData(userId),
                getUserBoosts(userId)
            ]);
            
            if (!row || row.coins < 100) {
                return { success: false, error: 'INSUFFICIENT_COINS' };
            }

            // ATOMIC: Deduct coins first to prevent negative balance
            const deductResult = await atomicDeductCoins(userId, 100);
            if (!deductResult.success) {
                return { success: false, error: 'INSUFFICIENT_COINS' };
            }
            
            // Return the data needed for processing
            return {
                success: true,
                row,
                boosts,
                hasFantasyBook: !!row.hasFantasyBook
            };
        } catch (error) {
            console.error('❌ Error in performSingleRoll lock phase:', error);
            return { success: false, error: 'LOCK_FAILED', details: error.message };
        }
    });
    
    // If lock phase failed, return the error
    if (!lockResult.success) {
        return lockResult;
    }
    
    // STEP 3: Do heavy computation OUTSIDE the lock (coins already deducted)
    const { row, boosts, hasFantasyBook } = lockResult;
    
    try {
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
                pityTranscendent: Math.min(row.pityTranscendent, MAX_PITY),
                pityEternal: Math.min(row.pityEternal, MAX_PITY),
                pityInfinite: Math.min(row.pityInfinite, MAX_PITY),
                pityCelestial: Math.min(row.pityCelestial, MAX_PITY),
                pityAstral: Math.min(row.pityAstral, MAX_PITY)
            },
            rarity,
            hasFantasyBook
        );

        // Cap pity values to prevent overflow
        for (const key of Object.keys(updatedPities)) {
            if (typeof updatedPities[key] === 'number') {
                updatedPities[key] = Math.min(updatedPities[key], MAX_PITY);
            }
        }

        const fumoResult = await selectAndAddFumo(userId, rarity, fumos);
        if (!fumoResult || !fumoResult.success) {
            // Refund coins if fumo selection failed
            await run(`UPDATE userCoins SET coins = coins + 100 WHERE userId = ?`, [userId]);
            return { success: false, error: fumoResult?.reason || 'NO_FUMO_FOUND' };
        }
        const fumo = fumoResult.fumo;

        // Update user data (coins already deducted atomically)
        await run(
            `UPDATE userCoins SET
                totalRolls = totalRolls + 1,
                boostCharge = ?,
                boostActive = ?,
                boostRollsRemaining = ?,
                pityTranscendent = ?,
                pityEternal = ?,
                pityInfinite = ?,
                pityCelestial = ?,
                pityAstral = ?,
                rollsLeft = CASE 
                    WHEN rollsLeft >= 1 THEN rollsLeft - 1
                    ELSE 0 
                END
            WHERE userId = ?`,
            [
                boostUpdates.boostCharge,
                boostUpdates.boostActive,
                boostUpdates.boostRollsRemaining,
                updatedPities.pityTranscendent,
                updatedPities.pityEternal,
                updatedPities.pityInfinite,
                updatedPities.pityCelestial,
                updatedPities.pityAstral,
                userId
            ]
        );

        await updateQuestsAndAchievements(userId, 1);

        return { success: true, fumo, rarity, sanaeGuaranteedUsed };
    } catch (error) {
        console.error('❌ Error in performSingleRoll:', error);
        debugLog('ROLL_ERROR', `Single roll failed for ${userId}: ${error.message}`);
        // Refund coins on error
        try {
            await run(`UPDATE userCoins SET coins = coins + 100 WHERE userId = ?`, [userId]);
        } catch (refundError) {
            console.error('❌ Failed to refund coins:', refundError);
        }
        return { success: false, error: 'ROLL_FAILED', details: error.message };
    }
}

async function performMultiRoll(userId, fumos, rollCount, isAutoRoll = false) {
    debugLog('ROLL', `${rollCount}x roll for user ${userId} (autoRoll: ${isAutoRoll})`);
    
    const cost = rollCount * 100;
    
    // STEP 1: Quick precondition checks OUTSIDE the lock
    const [storageCheck, initialRow] = await Promise.all([
        StorageLimitService.canAddFumos(userId, rollCount),
        getUserRollData(userId)
    ]);
    
    if (!storageCheck.canAdd) {
        return { 
            success: false, 
            error: 'STORAGE_FULL',
            storageStatus: storageCheck
        };
    }
    
    if (!initialRow || initialRow.coins < cost) {
        return { success: false, error: 'INSUFFICIENT_COINS' };
    }
    
    // STEP 2: Use lock ONLY for atomic coin deduction and state capture
    const lockResult = await withUserLock(userId, `multiRoll_${rollCount}`, async () => {
        try {
            // Re-fetch inside lock to ensure consistency
            const [row, boosts] = await Promise.all([
                getUserRollData(userId),
                getUserBoosts(userId)
            ]);
            
            if (!row || row.coins < cost) {
                return { success: false, error: 'INSUFFICIENT_COINS' };
            }

            // ATOMIC: Deduct all coins upfront to prevent negative balance
            const deductResult = await atomicDeductCoins(userId, cost);
            if (!deductResult.success) {
                return { success: false, error: 'INSUFFICIENT_COINS' };
            }
            
            // Return the data needed for processing
            return {
                success: true,
                row,
                boosts,
                hasFantasyBook: !!row.hasFantasyBook
            };
        } catch (error) {
            console.error('❌ Error in performMultiRoll lock phase:', error);
            return { success: false, error: 'LOCK_FAILED', details: error.message };
        }
    });
    
    // If lock phase failed, return the error
    if (!lockResult.success) {
        return lockResult;
    }
    
    // STEP 3: Do heavy computation OUTSIDE the lock (coins already deducted)
    const { row, boosts, hasFantasyBook } = lockResult;
    
    try {
        let { boostCharge, boostActive, boostRollsRemaining } = row;
        let pities = {
                pityTranscendent: Math.min(row.pityTranscendent, MAX_PITY),
                pityEternal: Math.min(row.pityEternal, MAX_PITY),
                pityInfinite: Math.min(row.pityInfinite, MAX_PITY),
                pityCelestial: Math.min(row.pityCelestial, MAX_PITY),
                pityAstral: Math.min(row.pityAstral, MAX_PITY)
            };

            const rarities = [];
            let currentRolls = row.totalRolls;
            let sanaeGuaranteedUsed = 0;
            let sigilNullifiedUsedInBatch = false; // Track if any S!gil nullified rolls were used

            // Check how many guaranteed rolls we have
            let sanaeGuaranteedRemaining = boosts.sanaeGuaranteedRolls || 0;
            const sanaeMinRarity = boosts.sanaeGuaranteedRarity || null;
            
            // Create mutable boosts copy for batched calculation
            const batchBoosts = { 
                ...boosts, 
                sigilNullifiedRolls: boosts.sigilNullifiedRolls || 0,
                nullifiedUses: boosts.nullifiedUses || 0
            };
            
            // Track batched updates to apply after loop
            const batchedUpdates = {
                sigilNullifiedUsed: 0,
                nullifiedUsed: 0,
                sanaeGuaranteedUsed: 0
            };

            // OPTIMIZED: No awaits inside the loop - all synchronous
            for (let i = 0; i < rollCount; i++) {
                currentRolls++;

                const tempRow = {
                    ...row,
                    boostActive,
                    boostRollsRemaining,
                    totalRolls: currentRolls,
                    ...pities
                };

                // Use batched version - no database writes
                const result = calculateRarityBatched(batchBoosts, tempRow, hasFantasyBook);
                let rarity = result.rarity;

                // Track if S!gil nullified was used this roll
                if (result.sigilNullified) {
                    sigilNullifiedUsedInBatch = true;
                    batchedUpdates.sigilNullifiedUsed++;
                }
                if (result.nullifiedUsed && !result.sigilNullified) {
                    batchedUpdates.nullifiedUsed++;
                }

                // Check if we should use Sanae guaranteed rarity
                if (sanaeGuaranteedRemaining > 0 && sanaeMinRarity) {
                    if (!meetsMinimumRarity(rarity, sanaeMinRarity)) {
                        rarity = sanaeMinRarity;
                    }
                    sanaeGuaranteedRemaining--;
                    sanaeGuaranteedUsed++;
                    batchedUpdates.sanaeGuaranteedUsed++;
                }

                rarities.push(rarity);

                // incrementWeeklyAstral uses callback-style, not blocking
                if (ASTRAL_PLUS_RARITIES.includes(rarity)) {
                    incrementWeeklyAstral(userId);
                }

                pities = updatePityCounters(pities, rarity, hasFantasyBook);
                
                // Cap pity values to prevent overflow
                for (const key of Object.keys(pities)) {
                    if (typeof pities[key] === 'number') {
                        pities[key] = Math.min(pities[key], MAX_PITY);
                    }
                }

                const boostUpdate = updateBoostCharge(boostCharge, boostActive, boostRollsRemaining);
                boostCharge = boostUpdate.boostCharge;
                boostActive = boostUpdate.boostActive;
                boostRollsRemaining = boostUpdate.boostRollsRemaining;
            }
            
            // Apply all batched database updates at once
            await applyBatchedUpdates(userId, batchedUpdates);

            // Pass S!gil astral blocking flag if any nullified rolls used S!gil
            const fumoResults = await selectAndAddMultipleFumos(userId, rarities, fumos, {
                sigilAstralBlock: sigilNullifiedUsedInBatch
            });
            
            // Check if we hit storage limit - refund remaining cost
            const storageError = fumoResults.find(r => !r.success && r.reason === 'storage_full');
            if (storageError) {
                // Calculate how many fumos were NOT added and refund
                const failedCount = fumoResults.filter(r => !r.success).length;
                if (failedCount > 0) {
                    const refund = failedCount * 100;
                    await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [refund, userId]);
                    // Track refund as coins earned for quest progress
                    await QuestMiddleware.trackCoinsEarned(userId, refund);
                }
                return {
                    success: false,
                    error: 'STORAGE_FULL',
                    storageStatus: storageError.storageCheck
                };
            }
            
            // Extract successful fumos
            const fumoArray = fumoResults.filter(r => r.success).map(r => r.fumo);
            
            // Track ASTRAL+ duplicates that were blocked by S!gil
            const blockedAstralDuplicates = fumoResults
                .filter(r => !r.success && r.reason === 'astral_duplicate_blocked')
                .map(r => ({ blockedFumo: r.blockedFumo, rarity: r.rarity }));
            
            let bestFumo = null;
            if (fumoArray.length > 0) {
                bestFumo = fumoArray[0];
                for (const fumo of fumoArray) {
                    if (isRarer(fumo.rarity, bestFumo.rarity)) {
                        bestFumo = fumo;
                    }
                }
            }

            // Update user data (coins already deducted atomically)
            const rollsLeftDeduction = isAutoRoll ? 0 : rollCount;
            await run(
                `UPDATE userCoins SET
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
                    rollCount,
                    boostCharge,
                    boostActive,
                    boostRollsRemaining,
                    pities.pityTranscendent,
                    pities.pityEternal,
                    pities.pityInfinite,
                    pities.pityCelestial,
                    pities.pityAstral,
                    rollsLeftDeduction,
                    rollsLeftDeduction,
                    userId
                ]
            );

            await updateQuestsAndAchievements(userId, rollCount);

            const storageStatus = await StorageLimitService.getStorageStatus(userId);
            const storageWarning = storageStatus.status !== 'NORMAL' ? storageStatus : null;

            return { 
                success: true, 
                fumosBought: fumoArray, 
                bestFumo,
                storageWarning,
                sanaeGuaranteedUsed,
                blockedAstralDuplicates: blockedAstralDuplicates.length > 0 ? blockedAstralDuplicates : null,
                sigilNullifiedUsed: sigilNullifiedUsedInBatch
            };
        } catch (error) {
            // Refund coins on error
            try {
                await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [cost, userId]);
                // Track refund as coins earned for quest progress
                await QuestMiddleware.trackCoinsEarned(userId, cost);
            } catch (refundError) {
                console.error('❌ Failed to refund coins:', refundError);
            }
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