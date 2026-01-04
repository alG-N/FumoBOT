const { get, run } = require('../../../Core/database');
const { EVENT_BASE_CHANCES, PITY_THRESHOLDS } = require('../../../Configuration/rarity');
const { selectAndAddFumo, rollBaseVariant, rollSpecialVariant, applyVariantToName } = require('../NormalGachaService/InventoryService');
const { updateQuestsAndAchievements } = require('../NormalGachaService/CrateGachaRollService');
const { incrementWeeklyShiny } = require('../../../Ultility/weekly');
const FumoPool = require('../../../Data/FumoPool');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');
const { getUserBoosts, consumeSanaeLuckRoll, consumeSanaeGuaranteedRoll, getSanaeBoostMultiplier, getTraitBoostDisplay } = require('../NormalGachaService/BoostService');
const { meetsMinimumRarity, getRaritiesAbove } = require('../NormalGachaService/RarityService');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

async function getEventUserBoosts(userId) {
    const now = Date.now();

    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, petBoosts, nullified, sanaeBoostMultiplier, sanaeTempLuck, sanaeData, userData] = await Promise.all([
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        get(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        get(`SELECT multiplier, source FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source NOT IN ('SanaeBlessing') AND expiresAt > ?`, [userId, now]).then(rows => rows || []),
        get(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId]),
        getSanaeBoostMultiplier(userId),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'SanaeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT luckForRolls, luckForRollsAmount, guaranteedRarityRolls, guaranteedMinRarity FROM sanaeBlessings WHERE userId = ?`, [userId]),
        get(`SELECT luck FROM userCoins WHERE userId = ?`, [userId])
    ]);

    // Get permanent luck value
    const permanentLuck = userData?.luck || 0;

    const globalMultiplier = sanaeBoostMultiplier || 1;

    let ancientLuckMultiplier = (ancientRelic && ancientRelic.expiresAt > now) ? ancientRelic.multiplier : 1;
    let mysteriousLuckMultiplier = (mysteriousCube && mysteriousCube.expiresAt > now) ? mysteriousCube.multiplier : 1;

    let mysteriousDiceMultiplier = 1;
    if (mysteriousDice && mysteriousDice.expiresAt > now) {
        mysteriousDiceMultiplier = await calculateEventDiceMultiplier(userId, mysteriousDice);
    }

    let petBoost = 1;
    if (Array.isArray(petBoosts)) {
        for (const row of petBoosts) {
            if (row.source !== 'SanaeBlessing') {
                petBoost *= (row.multiplier || 1);
            }
        }
    }

    // Apply global multiplier from Sanae blessing (x2, x5, etc.)
    if (globalMultiplier > 1) {
        if (ancientLuckMultiplier > 1) ancientLuckMultiplier *= globalMultiplier;
        if (mysteriousLuckMultiplier > 1) mysteriousLuckMultiplier *= globalMultiplier;
        if (mysteriousDiceMultiplier > 1) mysteriousDiceMultiplier *= globalMultiplier;
        if (petBoost > 1) petBoost *= globalMultiplier;
    }

    const sanaeTempLuckMultiplier = sanaeTempLuck?.multiplier || 1;

    // Sanae roll-based boosts
    const sanaeGuaranteedRolls = sanaeData?.guaranteedRarityRolls || 0;
    const sanaeGuaranteedRarity = sanaeData?.guaranteedMinRarity || null;
    const sanaeLuckRollsRemaining = sanaeData?.luckForRolls || 0;
    const sanaeLuckBoost = sanaeData?.luckForRollsAmount || 0;

    // Build base boost lines
    const baseLines = buildBoostLines(ancientLuckMultiplier, mysteriousLuckMultiplier, mysteriousDiceMultiplier, petBoost, !!lumina, sanaeTempLuckMultiplier, globalMultiplier, sanaeGuaranteedRolls, sanaeGuaranteedRarity, sanaeLuckRollsRemaining, sanaeLuckBoost, permanentLuck);
    
    // Fetch and add trait boost lines (VOID/GLITCHED)
    const traitLines = await getTraitBoostDisplay(userId);
    if (traitLines.length > 0) {
        baseLines.push(''); // Empty line separator
        baseLines.push('🌌 Special Traits:');
        traitLines.forEach(line => baseLines.push(`  ${line}`));
    }

    return {
        ancient: ancientLuckMultiplier,
        mysterious: mysteriousLuckMultiplier,
        mysteriousDice: mysteriousDiceMultiplier,
        pet: petBoost,
        lumina: !!lumina,
        nullified: nullified || null,
        sanaeTempLuckMultiplier,
        sanaeGlobalMultiplier: globalMultiplier,
        sanaeGuaranteedRolls,
        sanaeGuaranteedRarity,
        sanaeLuckRollsRemaining,
        sanaeLuckBoost,
        permanentLuck,
        lines: baseLines
    };
}

async function calculateEventDiceMultiplier(userId, diceBoost) {
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
        currentHour = { at: currentHourTimestamp, multiplier: newMultiplier };
        perHourArr.push(currentHour);
        perHourArr = perHourArr.slice(-12);

        await run(
            `UPDATE activeBoosts SET multiplier = ?, extra = ? WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`,
            [newMultiplier, JSON.stringify(perHourArr), userId]
        );
    }

    return currentHour.multiplier;
}

function buildBoostLines(ancient, mysterious, dice, pet, lumina, sanaeTempLuck = 1, globalMultiplier = 1, sanaeGuaranteedRolls = 0, sanaeGuaranteedRarity = null, sanaeLuckRolls = 0, sanaeLuckBoost = 0, permanentLuck = 0) {
    const lines = [];
    if (ancient > 1) lines.push(`🎇 AncientRelic x${ancient.toFixed(2)}`);
    if (mysterious > 1) lines.push(`🧊 MysteriousCube x${mysterious.toFixed(2)}`);
    if (dice !== 1) lines.push(`🎲 MysteriousDice x${dice.toFixed(4)}`);
    if (pet > 1) lines.push(`🐰 Pet x${pet.toFixed(4)}`);
    if (lumina) lines.push('🌟 Lumina (Every 10th roll x5)');
    
    // Permanent luck from Sanae Blessing
    if (permanentLuck > 0) {
        const cappedLuck = Math.min(permanentLuck, 5.0); // Cap at 500%
        lines.push(`🍀 Base Luck: +${(cappedLuck * 100).toFixed(1)}% (permanent)`);
    }
    
    // Sanae boosts
    if (sanaeTempLuck > 1) {
        lines.push(`⛩️ SanaeBlessing x${sanaeTempLuck} Luck`);
    }
    if (globalMultiplier > 1) {
        lines.push(`✨ All Boosts x${globalMultiplier} (Sanae)`);
    }
    if (sanaeGuaranteedRolls > 0 && sanaeGuaranteedRarity) {
        lines.push(`🎲 ${sanaeGuaranteedRolls} guaranteed ${sanaeGuaranteedRarity}+`);
    }
    if (sanaeLuckRolls > 0 && sanaeLuckBoost > 0) {
        lines.push(`🍀 +${(sanaeLuckBoost * 100).toFixed(0)}% luck (${sanaeLuckRolls} rolls)`);
    }
    
    return lines;
}

function calculateEventLuckMultiplier(boosts, luck, rollsLeft, isBoostActive) {
    const bonusRollMultiplier = (rollsLeft > 0 && !isBoostActive) ? 2 : 1;
    let total = boosts.ancient * boosts.mysterious * boosts.mysteriousDice * boosts.pet * Math.max(1, luck) * bonusRollMultiplier;
    
    // Apply Sanae direct luck multiplier
    if (boosts.sanaeTempLuckMultiplier > 1) {
        total *= boosts.sanaeTempLuckMultiplier;
    }
    
    // Apply Sanae roll-based luck boost
    if (boosts.sanaeLuckBoost > 0 && boosts.sanaeLuckRollsRemaining > 0) {
        total *= (1 + boosts.sanaeLuckBoost);
    }
    
    return total;
}

function calculateEventChances(totalLuckMultiplier) {
    // New Year banner uses different rarities
    const transcendent = EVENT_BASE_CHANCES.TRANSCENDENT; // 1 in 1 billion base
    const question = Math.min(EVENT_BASE_CHANCES.QUESTION * totalLuckMultiplier, 10); // ??? caps at 10%
    const rare = Math.min(EVENT_BASE_CHANCES.RARE * totalLuckMultiplier, 40); // Rare caps at 40%
    const uncommon = Math.min(EVENT_BASE_CHANCES.UNCOMMON * totalLuckMultiplier, 50); // Uncommon caps at 50%
    const common = Math.max(100 - (uncommon + rare + question + transcendent), 1); // Common is remainder

    return { common, uncommon, rare, question, transcendent };
}

async function getEventUserRollData(userId) {
    return await get(
        `SELECT gems, lastRollTime, rollsInCurrentWindow, rollsSinceLastMythical, rollsSinceLastQuestionMark, 
         luck, rollsLeft, totalRolls, hasFantasyBook FROM userCoins WHERE userId = ?`,
        [userId]
    );
}

async function updateEventUserAfterRoll(userId, updates) {
    await run(
        `UPDATE userCoins SET
            gems = gems - ?,
            totalRolls = totalRolls + ?,
            rollsInCurrentWindow = rollsInCurrentWindow + ?,
            lastRollTime = ?,
            rollsLeft = CASE WHEN rollsLeft > 0 THEN rollsLeft - ? ELSE 0 END,
            rollsSinceLastMythical = ?,
            rollsSinceLastQuestionMark = ?
        WHERE userId = ?`,
        [
            updates.cost,
            updates.rollCount,
            updates.rollCount,
            Date.now(),
            updates.rollCount,
            updates.rollsSinceLastMythical,
            updates.rollsSinceLastQuestionMark,
            userId
        ]
    );
}

async function selectEventRarity(userId, boosts, rollsSinceLastMythical, rollsSinceLastQuestionMark, totalRolls, luck, rollsLeft, consumeSanae = false) {
    // Pity system for ??? rarity (using existing pity counter)
    if (rollsSinceLastQuestionMark >= PITY_THRESHOLDS.EVENT_QUESTION) {
        return { rarity: '???', sanaeUsed: false };
    }
    // Note: No mythical pity for New Year banner since there's no MYTHICAL rarity
    // We can repurpose the mythical pity for RARE if desired, or remove it

    if (boosts.nullified?.uses > 0) {
        const rarities = ['Common', 'UNCOMMON', 'RARE', '???', 'TRANSCENDENT'];
        const rarity = rarities[Math.floor(Math.random() * rarities.length)];

        if (boosts.nullified.uses > 1) {
            await run(
                `UPDATE activeBoosts SET uses = ? WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                [boosts.nullified.uses - 1, userId]
            );
        } else {
            await run(
                `DELETE FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`,
                [userId]
            );
        }

        return { rarity, sanaeUsed: false };
    }

    const totalLuck = calculateEventLuckMultiplier(
        boosts,
        luck,
        rollsLeft,
        false
    );
    const chances = calculateEventChances(totalLuck);

    let roll = Math.random() * 100;

    if (boosts.lumina && totalRolls % 10 === 0) {
        roll /= 5;
    }

    // Use UPPERCASE for rarities to match FumoPool data
    let selectedRarity;
    if (roll < chances.transcendent) selectedRarity = 'TRANSCENDENT';
    else if (roll < chances.question + chances.transcendent) selectedRarity = '???';
    else if (roll < chances.rare + chances.question + chances.transcendent) selectedRarity = 'RARE';
    else if (roll < chances.uncommon + chances.rare + chances.question + chances.transcendent) selectedRarity = 'UNCOMMON';
    else selectedRarity = 'Common';

    // Apply Sanae guaranteed rarity if available and consumeSanae is true
    let sanaeUsed = false;
    if (consumeSanae && boosts.sanaeGuaranteedRolls > 0 && boosts.sanaeGuaranteedRarity) {
        // Map event rarities for comparison (use UPPERCASE to match FumoPool)
        const eventRarityOrder = ['Common', 'UNCOMMON', 'RARE', '???', 'TRANSCENDENT'];
        
        // Normalize the guaranteed rarity from DB to UPPERCASE
        const dbRarity = boosts.sanaeGuaranteedRarity.toUpperCase();
        const rarityMap = {
            'COMMON': 'Common',
            'UNCOMMON': 'UNCOMMON', 
            'RARE': 'RARE',
            '???': '???',
            'TRANSCENDENT': 'TRANSCENDENT'
        };
        const normalizedGuaranteed = rarityMap[dbRarity] || dbRarity;
        
        const minIndex = eventRarityOrder.indexOf(normalizedGuaranteed);
        const currentIndex = eventRarityOrder.indexOf(selectedRarity);
        
        // Only upgrade if both indices are valid and current is below minimum
        if (minIndex !== -1 && currentIndex !== -1 && currentIndex < minIndex) {
            selectedRarity = eventRarityOrder[minIndex];
        }
        
        await consumeSanaeGuaranteedRoll(userId);
        sanaeUsed = true;
    }

    return { rarity: selectedRarity, sanaeUsed };
}

/**
 * Perform event roll with Sanae boost integration
 */
async function performEventRollWithSanae(userId, eventPool, boosts) {
    const sanaeInfo = {
        guaranteedUsed: false,
        luckBoostUsed: false,
        guaranteedMinRarity: null,
        extraLuck: 0
    };
    
    // Check for guaranteed rarity
    if (boosts.sanaeGuaranteedRolls > 0 && boosts.sanaeGuaranteedRarity) {
        const consumed = await consumeSanaeGuaranteedRoll(userId);
        if (consumed.consumed) {
            sanaeInfo.guaranteedUsed = true;
            sanaeInfo.guaranteedMinRarity = consumed.minRarity;
            sanaeInfo.remainingGuaranteed = consumed.remaining;
        }
    }
    
    // Check for luck boost
    if (!sanaeInfo.guaranteedUsed && boosts.sanaeLuckBoost > 0 && boosts.sanaeLuckRollsRemaining > 0) {
        const consumed = await consumeSanaeLuckRoll(userId);
        if (consumed.consumed) {
            sanaeInfo.luckBoostUsed = true;
            sanaeInfo.extraLuck = consumed.luckBonus;
            sanaeInfo.remainingLuckRolls = consumed.remaining;
        }
    }
    
    return sanaeInfo;
}

/**
 * Get Sanae boost display for event gacha UI
 */
function getEventSanaeBoostDisplay(boosts) {
    const display = [];
    
    if (boosts.sanaeGuaranteedRolls > 0 && boosts.sanaeGuaranteedRarity) {
        display.push(`🎲 **${boosts.sanaeGuaranteedRolls}** guaranteed ${boosts.sanaeGuaranteedRarity}+`);
    }
    
    if (boosts.sanaeLuckRollsRemaining > 0 && boosts.sanaeLuckBoost > 0) {
        display.push(`🍀 **+${(boosts.sanaeLuckBoost * 100).toFixed(0)}%** luck (${boosts.sanaeLuckRollsRemaining} rolls)`);
    }
    
    return display;
}

/**
 * Select and add multiple event fumos - OPTIMIZED for batch operations
 */
async function selectAndAddMultipleEventFumos(userId, rarities, fumoPool) {
    const { all, run, get } = require('../../../Core/database');
    
    const results = [];
    const fumoUpdates = new Map(); // Track fumo name -> {count, rarity, fumoData}
    let shinyCount = 0;
    
    // First pass: determine all fumos and variants without DB writes
    for (const rarity of rarities) {
        let rarityPool;
        if (Array.isArray(fumoPool)) {
            rarityPool = fumoPool.filter(f => f.rarity === rarity);
        } else {
            rarityPool = fumoPool[rarity];
        }
        
        if (!rarityPool || rarityPool.length === 0) {
            results.push({ success: false, reason: 'no_fumos' });
            continue;
        }
        
        // Select base fumo
        const baseFumo = rarityPool[Math.floor(Math.random() * rarityPool.length)];
        let finalName = baseFumo.name;
        
        // Roll for base variant (SHINY or alG)
        const baseVariant = await rollBaseVariant(userId);
        
        // Roll for special variant (GLITCHED or VOID)
        const specialVariant = await rollSpecialVariant(userId, finalName);
        
        // Apply variants to name
        finalName = applyVariantToName(finalName, baseVariant, specialVariant);
        
        // Track for batch update
        if (fumoUpdates.has(finalName)) {
            const existing = fumoUpdates.get(finalName);
            existing.count++;
        } else {
            fumoUpdates.set(finalName, { count: 1, rarity, baseFumo });
        }
        
        // Track shiny count
        if (baseVariant?.type === 'SHINY') {
            shinyCount++;
        }
        
        results.push({
            success: true,
            fumo: {
                name: finalName,
                baseName: baseFumo.name,
                rarity,
                picture: baseFumo.picture,
                baseVariant: baseVariant?.type || null,
                specialVariant: specialVariant?.type || null,
                isShiny: baseVariant?.type === 'SHINY',
                isAlG: baseVariant?.type === 'alG',
                isGlitched: specialVariant?.type === 'GLITCHED',
                isVoid: specialVariant?.type === 'VOID'
            }
        });
    }
    
    // Second pass: batch update database
    const fumoNames = Array.from(fumoUpdates.keys());
    if (fumoNames.length > 0) {
        const placeholders = fumoNames.map(() => '?').join(',');
        const existingFumos = await all(
            `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? AND fumoName IN (${placeholders})`,
            [userId, ...fumoNames]
        );
        
        const existingMap = new Map();
        for (const row of existingFumos) {
            existingMap.set(row.fumoName, row);
        }
        
        // Batch updates and inserts
        for (const [fumoName, data] of fumoUpdates) {
            const existing = existingMap.get(fumoName);
            if (existing) {
                await run(
                    `UPDATE userInventory SET quantity = quantity + ? WHERE id = ?`,
                    [data.count, existing.id]
                );
            } else {
                await run(
                    `INSERT INTO userInventory (userId, fumoName, quantity, rarity) VALUES (?, ?, ?, ?)`,
                    [userId, fumoName, data.count, data.rarity]
                );
            }
        }
    }
    
    // Track weekly shiny count and quest progress
    if (shinyCount > 0) {
        for (let i = 0; i < shinyCount; i++) {
            await incrementWeeklyShiny(userId);
            await QuestMiddleware.trackShiny(userId);
        }
    }
    
    return results;
}

async function performEventSummon(userId, numSummons) {
    const eventFumos = FumoPool.getForEvent();

    try {
        const userData = await getEventUserRollData(userId);
        if (!userData || userData.gems < 100 * numSummons) {
            return { success: false, error: 'INSUFFICIENT_GEMS' };
        }

        if (!userData.hasFantasyBook) {
            return { success: false, error: 'NO_FANTASY_BOOK' };
        }

        // Check storage capacity
        const storageCheck = await StorageLimitService.canAddFumos(userId, numSummons);
        let actualSummons = numSummons;
        
        if (!storageCheck.canAdd) {
            if (storageCheck.maxAllowed === 0) {
                return { 
                    success: false, 
                    error: 'STORAGE_FULL',
                    storageStatus: storageCheck
                };
            }
            actualSummons = storageCheck.maxAllowed;
        }

        const boosts = await getEventUserBoosts(userId);
        const fumoList = [];

        // For New Year banner, we don't track mythical pity (no MYTHICAL rarity)
        // We only track ??? pity
        let currentQuestion = userData.rollsSinceLastQuestionMark || 0;
        let currentTotalRolls = userData.totalRolls || 0;
        let currentRollsLeft = userData.rollsLeft || 0;
        let sanaeGuaranteedRemaining = boosts.sanaeGuaranteedRolls || 0;
        let totalSanaeUsed = 0;

        // OPTIMIZED: Pre-calculate all rarities first, then batch add to inventory
        const selectedRarities = [];
        
        for (let i = 0; i < actualSummons; i++) {
            currentTotalRolls++;

            // Determine if we should use Sanae guaranteed for this roll
            const useSanae = sanaeGuaranteedRemaining > 0;
            
            const { rarity, sanaeUsed } = await selectEventRarity(
                userId, 
                { ...boosts, sanaeGuaranteedRolls: sanaeGuaranteedRemaining }, 
                0, // No mythical pity for New Year banner
                currentQuestion,
                currentTotalRolls, 
                userData.luck,
                currentRollsLeft,
                useSanae
            );

            if (sanaeUsed) {
                sanaeGuaranteedRemaining--;
                totalSanaeUsed++;
            }

            // Update ??? pity counter
            if (rarity === '???') {
                currentQuestion = 0;
            } else {
                currentQuestion++;
            }

            if (currentRollsLeft > 0) {
                currentRollsLeft--;
            }

            selectedRarities.push(rarity);
        }

        // OPTIMIZED: Batch add all fumos at once
        if (actualSummons === 1) {
            // Single roll - use original method for animation compatibility
            const fumoResult = await selectAndAddFumo(userId, selectedRarities[0], eventFumos);
            if (fumoResult && fumoResult.success && fumoResult.fumo) {
                fumoList.push({ name: fumoResult.fumo.name, rarity: selectedRarities[0], picture: fumoResult.fumo.picture });
            }
        } else {
            // Multi-roll - use batch optimized method
            const results = await selectAndAddMultipleEventFumos(userId, selectedRarities, eventFumos);
            for (const result of results) {
                if (result.success && result.fumo) {
                    fumoList.push({ name: result.fumo.name, rarity: result.fumo.rarity, picture: result.fumo.picture });
                }
            }
        }

        await updateEventUserAfterRoll(userId, {
            cost: 100 * numSummons,
            rollCount: numSummons,
            rollsSinceLastMythical: 0, // Not used for New Year banner
            rollsSinceLastQuestionMark: currentQuestion
        });

        await updateQuestsAndAchievements(userId, numSummons);

        return {
            success: true,
            fumoList,
            rollsSinceLastMythical: 0, // Not applicable
            rollsSinceLastQuestionMark: currentQuestion,
            boostText: boosts.lines.join('\n') || 'No luck boost applied...',
            partialSummon: actualSummons < numSummons,
            requestedCount: numSummons,
            actualCount: actualSummons,
            storageWarning: actualSummons < numSummons ? storageCheck : null,
            sanaeGuaranteedUsed: totalSanaeUsed
        };
    } catch (error) {
        console.error(`❌ Error in performEventSummon for user ${userId}:`, error);
        return { success: false, error: 'ROLL_FAILED', details: error.message };
    }
}

module.exports = {
    getEventUserBoosts,
    calculateEventLuckMultiplier,
    calculateEventChances,
    performEventSummon,
    getEventUserRollData,
    updateEventUserAfterRoll,
    selectEventRarity,
    performEventRollWithSanae,
    getEventSanaeBoostDisplay,
    selectAndAddMultipleEventFumos
};