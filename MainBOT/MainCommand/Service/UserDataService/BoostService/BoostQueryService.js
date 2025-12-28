const { get, all } = require('../../../Core/database');
const { BOOST_TYPES, SPECIAL_SOURCES } = require('../../../Configuration/boostConfig');

async function getActiveBoosts(userId) {
    const now = Date.now();

    try {
        const [boosts, userData, mysteriousDice, timeClock, sanaeBoosts] = await Promise.all([
            all(
                `SELECT type, source, multiplier, expiresAt, uses
                 FROM activeBoosts
                 WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            ),
            get(`SELECT rollsLeft FROM userCoins WHERE userId = ?`, [userId]),
            getMysteriousDiceBoost(userId, now),
            getTimeClockBoost(userId, now),
            getSanaeBoosts(userId, now)
        ]);

        const categorized = categorizeBoosts(boosts || []);

        if (mysteriousDice) {
            categorized.luck.push(mysteriousDice);
        }

        if (timeClock) {
            categorized.cooldown.push(timeClock);
        }

        // Add Sanae boosts
        if (sanaeBoosts && sanaeBoosts.length > 0) {
            categorized.sanae = sanaeBoosts;
        } else {
            categorized.sanae = [];
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

async function getSanaeBoosts(userId, now) {
    try {
        const sanaeData = await get(
            `SELECT * FROM sanaeBlessings WHERE userId = ?`,
            [userId]
        );

        if (!sanaeData) return [];

        const boosts = [];

        // Craft Discount
        if (sanaeData.craftDiscountExpiry > now && sanaeData.craftDiscount > 0) {
            boosts.push({
                type: 'craftDiscount',
                source: 'Sanae Blessing',
                multiplier: sanaeData.craftDiscount,
                expiresAt: sanaeData.craftDiscountExpiry,
                displayValue: `${sanaeData.craftDiscount}% off crafts`
            });
        }

        // Free Crafts
        if (sanaeData.freeCraftsExpiry > now) {
            boosts.push({
                type: 'freeCrafts',
                source: 'Sanae Blessing',
                multiplier: 1,
                expiresAt: sanaeData.freeCraftsExpiry,
                displayValue: 'Free crafts (no coin/gem cost)'
            });
        }

        // Craft Protection
        if (sanaeData.craftProtection > 0) {
            boosts.push({
                type: 'craftProtection',
                source: 'Sanae Blessing',
                multiplier: 1,
                expiresAt: null,
                uses: sanaeData.craftProtection,
                displayValue: `${sanaeData.craftProtection} craft fail protections`
            });
        }

        // Guaranteed Rarity Rolls
        if (sanaeData.guaranteedRarityRolls > 0 && sanaeData.guaranteedMinRarity) {
            boosts.push({
                type: 'guaranteedRarity',
                source: 'Sanae Blessing',
                multiplier: 1,
                expiresAt: null,
                uses: sanaeData.guaranteedRarityRolls,
                displayValue: `${sanaeData.guaranteedRarityRolls} guaranteed ${sanaeData.guaranteedMinRarity}+ rolls`
            });
        }

        // Luck for Rolls
        if (sanaeData.luckForRolls > 0 && sanaeData.luckForRollsAmount > 0) {
            boosts.push({
                type: 'luckForRolls',
                source: 'Sanae Blessing',
                multiplier: sanaeData.luckForRollsAmount,
                expiresAt: null,
                uses: sanaeData.luckForRolls,
                displayValue: `+${(sanaeData.luckForRollsAmount * 100).toFixed(0)}% luck (${sanaeData.luckForRolls} rolls left)`
            });
        }

        // Pray Immunity
        if (sanaeData.prayImmunityExpiry > now) {
            boosts.push({
                type: 'prayImmunity',
                source: 'Sanae Blessing',
                multiplier: 1,
                expiresAt: sanaeData.prayImmunityExpiry,
                displayValue: 'Pray penalty immunity'
            });
        }

        // Boost Multiplier
        if (sanaeData.boostMultiplierExpiry > now) {
            boosts.push({
                type: 'boostMultiplier',
                source: 'Sanae Blessing',
                multiplier: 2,
                expiresAt: sanaeData.boostMultiplierExpiry,
                displayValue: 'x2 all active boosts'
            });
        }

        // Faith Points (always show if > 0)
        if (sanaeData.faithPoints > 0) {
            boosts.push({
                type: 'faithPoints',
                source: 'Sanae',
                multiplier: 1,
                expiresAt: null,
                uses: sanaeData.faithPoints,
                displayValue: `${sanaeData.faithPoints}/20 Faith Points`
            });
        }

        return boosts;

    } catch (error) {
        console.error('[BOOST_QUERY] Sanae boosts error:', error);
        return [];
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
        yuyukoRolls: [],
        sanae: []
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
    getTimeClockBoost,
    getSanaeBoosts
};