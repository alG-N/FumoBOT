const { get, run } = require('../../../Core/database');
const { EVENT_BASE_CHANCES, PITY_THRESHOLDS } = require('../../../Configuration/rarity');
const { selectAndAddFumo } = require('../NormalGachaService/InventoryService');
const { updateQuestsAndAchievements } = require('../NormalGachaService/CrateGachaRollService');
const { incrementWeeklyShiny } = require('../../../Ultility/weekly');
const FumoPool = require('../../../Data/FumoPool');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');
const { getUserBoosts, consumeSanaeLuckRoll, consumeSanaeGuaranteedRoll } = require('../NormalGachaService/BoostService');
const { meetsMinimumRarity, getRaritiesAbove } = require('../NormalGachaService/RarityService');

async function getEventUserBoosts(userId) {
    const now = Date.now();

    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, petBoosts, nullified] = await Promise.all([
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        get(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`, [userId]).then(rows => rows || []),
        get(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId])
    ]);

    const ancientLuckMultiplier = (ancientRelic && ancientRelic.expiresAt > now) ? ancientRelic.multiplier : 1;
    const mysteriousLuckMultiplier = (mysteriousCube && mysteriousCube.expiresAt > now) ? mysteriousCube.multiplier : 1;

    let mysteriousDiceMultiplier = 1;
    if (mysteriousDice && mysteriousDice.expiresAt > now) {
        mysteriousDiceMultiplier = await calculateEventDiceMultiplier(userId, mysteriousDice);
    }

    const petBoost = Array.isArray(petBoosts) 
        ? petBoosts.reduce((acc, row) => acc * row.multiplier, 1) 
        : 1;

    return {
        ancient: ancientLuckMultiplier,
        mysterious: mysteriousLuckMultiplier,
        mysteriousDice: mysteriousDiceMultiplier,
        pet: petBoost,
        lumina: !!lumina,
        nullified: nullified || null,
        lines: buildBoostLines(ancientLuckMultiplier, mysteriousLuckMultiplier, mysteriousDiceMultiplier, petBoost, !!lumina)
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

function buildBoostLines(ancient, mysterious, dice, pet, lumina) {
    const lines = [];
    if (ancient > 1) lines.push(`🎇 AncientRelic x${ancient}`);
    if (mysterious > 1) lines.push(`🧊 MysteriousCube x${mysterious.toFixed(2)}`);
    if (dice !== 1) lines.push(`🎲 MysteriousDice x${dice.toFixed(4)}`);
    if (pet > 1) lines.push(`🐰 Pet x${pet.toFixed(4)}`);
    if (lumina) lines.push('🌟 Lumina (Every 10th roll x5)');
    return lines;
}

function calculateEventLuckMultiplier(boosts, luck, rollsLeft, isBoostActive) {
    const bonusRollMultiplier = (rollsLeft > 0 && !isBoostActive) ? 2 : 1;
    return boosts.ancient * boosts.mysterious * boosts.mysteriousDice * boosts.pet * Math.max(1, luck) * bonusRollMultiplier;
}

function calculateEventChances(totalLuckMultiplier) {
    const mythical = Math.min(EVENT_BASE_CHANCES.MYTHICAL * totalLuckMultiplier, 5);
    const question = Math.min(EVENT_BASE_CHANCES.QUESTION * totalLuckMultiplier, 0.5);
    const transcendent = EVENT_BASE_CHANCES.TRANSCENDENT;
    const legendary = Math.max(EVENT_BASE_CHANCES.LEGENDARY - (mythical + question + transcendent), 0.01);
    const epic = 100 - (legendary + mythical + question + transcendent);

    return { epic, legendary, mythical, question, transcendent };
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

async function selectEventRarity(userId, boosts, rollsSinceLastMythical, rollsSinceLastQuestionMark, totalRolls, luck, rollsLeft) {
    if (rollsSinceLastQuestionMark >= PITY_THRESHOLDS.EVENT_QUESTION) {
        return '???';
    }
    if (rollsSinceLastMythical >= PITY_THRESHOLDS.EVENT_MYTHICAL) {
        return 'MYTHICAL';
    }

    if (boosts.nullified?.uses > 0) {
        const rarities = ['EPIC', 'LEGENDARY', 'MYTHICAL', '???', 'TRANSCENDENT'];
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

        return rarity;
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

    if (roll < chances.transcendent) return 'TRANSCENDENT';
    if (roll < chances.question + chances.transcendent) return '???';
    if (roll < chances.mythical + chances.question + chances.transcendent) return 'MYTHICAL';
    if (roll < chances.legendary + chances.mythical + chances.question + chances.transcendent) return 'LEGENDARY';
    return 'EPIC';
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

        let currentMythical = userData.rollsSinceLastMythical || 0;
        let currentQuestion = userData.rollsSinceLastQuestionMark || 0;
        let currentTotalRolls = userData.totalRolls || 0;
        let currentRollsLeft = userData.rollsLeft || 0;

        for (let i = 0; i < actualSummons; i++) {
            currentTotalRolls++;

            const rarity = await selectEventRarity(
                userId, 
                boosts, 
                currentMythical, 
                currentQuestion,
                currentTotalRolls, 
                userData.luck,
                currentRollsLeft
            );

            if (rarity === '???') {
                currentMythical++;
                currentQuestion = 0;
            } else if (rarity === 'MYTHICAL') {
                currentMythical = 0;
                currentQuestion++;
            } else {
                currentMythical++;
                currentQuestion++;
            }

            if (currentRollsLeft > 0) {
                currentRollsLeft--;
            }

            const fumo = await selectAndAddFumo(userId, rarity, eventFumos, userData.luck);
            if (fumo) {
                fumoList.push({ name: fumo.name, rarity, picture: fumo.picture });
            }
        }

        await updateEventUserAfterRoll(userId, {
            cost: 100 * numSummons,
            rollCount: numSummons,
            rollsSinceLastMythical: currentMythical,
            rollsSinceLastQuestionMark: currentQuestion
        });

        await updateQuestsAndAchievements(userId, numSummons);

        return {
            success: true,
            fumoList,
            rollsSinceLastMythical: currentMythical,
            rollsSinceLastQuestionMark: currentQuestion,
            boostText: boosts.lines.join('\n') || 'No luck boost applied...',
            partialSummon: actualSummons < numSummons,
            requestedCount: numSummons,
            actualCount: actualSummons,
            storageWarning: actualSummons < numSummons ? storageCheck : null
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
    getEventSanaeBoostDisplay
};