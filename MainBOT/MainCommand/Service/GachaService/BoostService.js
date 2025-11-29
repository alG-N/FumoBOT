const { get, run } = require('../../Core/database');
const { debugLog } = require('../../Core/logger');

async function getUserBoosts(userId) {
    debugLog('BOOST', `Fetching boosts for user ${userId}`);
    const startTime = Date.now();

    const now = Date.now();
    
    const [ancientRelic, mysteriousCube, mysteriousDice, lumina, timeBlessing, timeClock, petBoosts, nullified] = await Promise.all([
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'AncientRelic'`, [userId]),
        get(`SELECT multiplier, expiresAt FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousCube'`, [userId]),
        get(`SELECT multiplier, expiresAt, extra FROM activeBoosts WHERE userId = ? AND type = 'luck' AND source = 'MysteriousDice'`, [userId]),
        get(`SELECT 1 FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10'`, [userId]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'luck'`, [userId]).then(rows => rows || []),
        get(`SELECT uses FROM activeBoosts WHERE userId = ? AND type = 'rarityOverride' AND source = 'Nullified'`, [userId])
    ]);

    const ancientLuckMultiplier = (ancientRelic && ancientRelic.expiresAt > now) ? ancientRelic.multiplier : 1;
    const mysteriousLuckMultiplier = (mysteriousCube && mysteriousCube.expiresAt > now) ? mysteriousCube.multiplier : 1;

    let mysteriousDiceMultiplier = 1;
    if (mysteriousDice && mysteriousDice.expiresAt > now) {
        mysteriousDiceMultiplier = await calculateDiceMultiplier(userId, mysteriousDice);
    }

    const petBoost = Array.isArray(petBoosts) 
        ? petBoosts.reduce((acc, row) => acc * row.multiplier, 1) 
        : 1;

    const elapsed = Date.now() - startTime;
    debugLog('BOOST', `Boosts fetched in ${elapsed}ms`, {
        ancient: ancientLuckMultiplier,
        cube: mysteriousLuckMultiplier,
        dice: mysteriousDiceMultiplier,
        pet: petBoost
    });

    return {
        ancientLuckMultiplier,
        mysteriousLuckMultiplier,
        mysteriousDiceMultiplier,
        petBoost,
        luminaActive: !!lumina,
        timeBlessingMultiplier: timeBlessing?.multiplier || 1,
        timeClockMultiplier: timeClock?.multiplier || 1,
        nullifiedUses: nullified?.uses || 0
    };
}

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

function calculateTotalLuckMultiplier(boosts, isBoostActive, rollsLeft, totalRolls) {
    let multiplier = boosts.ancientLuckMultiplier *
        boosts.mysteriousLuckMultiplier *
        boosts.mysteriousDiceMultiplier *
        boosts.petBoost;

    if (boosts.luminaActive && totalRolls % 10 === 0) {
        multiplier *= 5;
    }

    if (isBoostActive) {
        multiplier *= 25;
    } else if (rollsLeft > 0) {
        multiplier *= 2;
    }

    return multiplier;
}

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

module.exports = {
    getUserBoosts,
    calculateTotalLuckMultiplier,
    calculateCooldown,
    calculateDiceMultiplier
};