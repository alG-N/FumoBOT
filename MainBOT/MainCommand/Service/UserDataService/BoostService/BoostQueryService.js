const { get, all } = require('../../../Core/database');
const { BOOST_TYPES, SPECIAL_SOURCES } = require('../../../Configuration/boostConfig');

async function getActiveBoosts(userId) {
    const now = Date.now();

    try {
        const [boosts, userData, mysteriousDice, timeClock] = await Promise.all([
            all(
                `SELECT type, source, multiplier, expiresAt, uses
                 FROM activeBoosts
                 WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            ),
            get(`SELECT rollsLeft FROM userCoins WHERE userId = ?`, [userId]),
            getMysteriousDiceBoost(userId, now),
            getTimeClockBoost(userId, now)
        ]);

        const categorized = categorizeBoosts(boosts || []);

        if (mysteriousDice) {
            categorized.luck.push(mysteriousDice);
        }

        if (timeClock) {
            categorized.cooldown.push(timeClock);
        }

        if (userData?.rollsLeft > 0) {
            categorized.yuyukoRolls.push({
                type: BOOST_TYPES.YUYUKO_ROLLS,
                source: 'Yuyuko',
                multiplier: 1,
                expiresAt: null,
                uses: userData.rollsLeft
            });
        }

        const hasBoosts = Object.values(categorized).some(arr => arr.length > 0);

        return {
            hasBoosts,
            boosts: categorized,
            totals: calculateTotals(categorized)
        };

    } catch (error) {
        console.error('[BOOST_QUERY] Error:', error);
        throw error;
    }
}

async function getMysteriousDiceBoost(userId, now) {
    try {
        const row = await get(
            `SELECT multiplier, expiresAt, extra FROM activeBoosts 
             WHERE userId = ? AND type = 'luck' AND source = ? AND expiresAt > ?`,
            [userId, SPECIAL_SOURCES.MYSTERIOUS_DICE, now]
        );

        if (!row) return null;

        let perHourArr = [];
        try {
            perHourArr = JSON.parse(row.extra || '[]');
        } catch {
            perHourArr = [];
        }

        const currentHourTimestamp = now - (now % (60 * 60 * 1000));
        let currentHour = perHourArr.find(e => e.at === currentHourTimestamp);

        if (!currentHour) {
            const newMultiplier = parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));
            currentHour = { multiplier: newMultiplier };
        }

        return {
            type: BOOST_TYPES.LUCK,
            source: SPECIAL_SOURCES.MYSTERIOUS_DICE,
            multiplier: currentHour.multiplier,
            expiresAt: row.expiresAt,
            isDynamic: true
        };

    } catch (error) {
        console.error('[BOOST_QUERY] MysteriousDice error:', error);
        return null;
    }
}

async function getTimeClockBoost(userId, now) {
    try {
        const row = await get(
            `SELECT multiplier, expiresAt FROM activeBoosts 
             WHERE userId = ? AND type = 'summonSpeed' AND source = ? AND expiresAt > ?`,
            [userId, SPECIAL_SOURCES.TIME_CLOCK, now]
        );

        if (!row) return null;

        return {
            type: BOOST_TYPES.SUMMON_COOLDOWN,
            source: SPECIAL_SOURCES.TIME_CLOCK,
            multiplier: 0.5,
            expiresAt: row.expiresAt
        };

    } catch (error) {
        console.error('[BOOST_QUERY] TimeClock error:', error);
        return null;
    }
}

function categorizeBoosts(boosts) {
    const categorized = {
        coin: [],
        gem: [],
        luck: [],
        cooldown: [],
        debuff: [],
        yuyukoRolls: []
    };

    for (const boost of boosts) {
        const type = boost.type.toLowerCase();

        if (boost.source === SPECIAL_SOURCES.MYSTERIOUS_DICE) continue;
        if (type === 'summonSpeed' && boost.source === SPECIAL_SOURCES.TIME_CLOCK) continue;

        if (type === 'coin') {
            categorized.coin.push(boost);
        } else if (type === 'gem') {
            categorized.gem.push(boost);
        } else if (type === 'luck' || type === 'luckevery10') {
            categorized.luck.push(boost);
        } else if (type === 'sellpenalty') {
            categorized.debuff.push(boost);
        } else if (type === 'rarityoverride') {
            categorized.luck.push(boost);
        } else if (type === 'summoncooldown') {
            categorized.cooldown.push(boost);
        }
    }

    return categorized;
}

function calculateTotals(categorized) {
    return {
        coin: categorized.coin.reduce((acc, b) => acc * b.multiplier, 1),
        gem: categorized.gem.reduce((acc, b) => acc * b.multiplier, 1),
        luck: Math.max(...categorized.luck.map(b => b.multiplier), 1)
    };
}

module.exports = {
    getActiveBoosts,
    getMysteriousDiceBoost,
    getTimeClockBoost
};