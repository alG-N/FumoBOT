const { get, all } = require('../../../Core/database');
const { BOOST_TYPES, SPECIAL_SOURCES } = require('../../../Configuration/boostConfig');

/**
 * Check if S!gil is currently active for a user
 */
async function isSigilActive(userId) {
    const now = Date.now();
    const sigil = await get(
        `SELECT * FROM activeBoosts 
         WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
    return !!sigil;
}

async function getActiveBoosts(userId) {
    const now = Date.now();

    try {
        // Check if S!gil is active first
        const sigilActive = await isSigilActive(userId);
        
        let boostQuery;
        let disabledBoostsQuery = null;
        
        if (sigilActive) {
            // Get S!gil boosts when S!gil is active
            boostQuery = all(
                `SELECT type, source, multiplier, expiresAt, uses, stack, extra
                 FROM activeBoosts
                 WHERE userId = ? AND source = 'S!gil' AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            );
            
            // Get ALL non-S!gil boosts to show them as FROZEN (not just ones with sigilDisabled flag)
            disabledBoostsQuery = all(
                `SELECT type, source, multiplier, expiresAt, uses, stack, extra
                 FROM activeBoosts
                 WHERE userId = ? AND source != 'S!gil' AND (expiresAt IS NULL OR expiresAt > ?)`,
                [userId, now]
            );
        } else {
            // Get all non-sigilDisabled boosts
            boostQuery = all(
                `SELECT type, source, multiplier, expiresAt, uses, stack, extra
                 FROM activeBoosts
                 WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)
                 AND (extra IS NULL OR json_extract(extra, '$.sigilDisabled') IS NULL OR json_extract(extra, '$.sigilDisabled') != 1)`,
                [userId, now]
            );
        }
        
        const [boosts, disabledBoosts, userData, mysteriousDice, timeClock, sanaeBoosts] = await Promise.all([
            boostQuery,
            disabledBoostsQuery || Promise.resolve([]),
            get(`SELECT rollsLeft, luck FROM userCoins WHERE userId = ?`, [userId]),
            sigilActive ? null : getMysteriousDiceBoost(userId, now),
            sigilActive ? null : getTimeClockBoost(userId, now),
            sigilActive ? [] : getSanaeBoosts(userId, now)
        ]);

        const categorized = categorizeBoosts(boosts || []);
        
        // If S!gil is active, categorize disabled boosts separately (show ALL non-S!gil boosts as FROZEN)
        let categorizedDisabled = { coin: [], gem: [], luck: [], special: [], sanae: [], cooldown: [], debuff: [], yuyukoRolls: [] };
        if (sigilActive) {
            // Mark all non-S!gil boosts as disabled
            if (disabledBoosts && disabledBoosts.length > 0) {
                const markedDisabled = disabledBoosts.map(b => ({ ...b, sigilDisabled: true }));
                categorizedDisabled = categorizeBoosts(markedDisabled);
            }
            
            // Add permanent luck as a disabled boost (frozen)
            if (userData?.luck > 0) {
                const cappedLuck = Math.min(userData.luck, 5.0);
                categorizedDisabled.luck.push({
                    type: 'luck',
                    source: 'Permanent (Sanae Blessing)',
                    multiplier: 1 + cappedLuck,
                    expiresAt: null,
                    displayValue: `+${(cappedLuck * 100).toFixed(1)}% permanent luck`,
                    sigilDisabled: true
                });
            }
            
            // Get and add Sanae boosts as frozen
            const allSanaeBoosts = await getSanaeBoosts(userId, now);
            if (allSanaeBoosts && allSanaeBoosts.length > 0) {
                allSanaeBoosts.forEach(b => {
                    categorizedDisabled.sanae.push({ ...b, sigilDisabled: true });
                });
            }
            
            // Add Yuyuko rolls as frozen
            if (userData?.rollsLeft > 0) {
                categorizedDisabled.sanae.push({
                    type: BOOST_TYPES.YUYUKO_ROLLS,
                    source: 'Yuyuko Prayer',
                    multiplier: 1,
                    expiresAt: null,
                    uses: userData.rollsLeft,
                    displayValue: `${userData.rollsLeft.toLocaleString()} bonus rolls (2× luck)`,
                    sigilDisabled: true
                });
            }
            
            // Get and add MysteriousDice as frozen
            const mysteriousDiceFrozen = await getMysteriousDiceBoost(userId, now);
            if (mysteriousDiceFrozen) {
                categorizedDisabled.luck.push({ ...mysteriousDiceFrozen, sigilDisabled: true });
            }
            
            // Get and add TimeClock as frozen
            const timeClockFrozen = await getTimeClockBoost(userId, now);
            if (timeClockFrozen) {
                categorizedDisabled.cooldown.push({ ...timeClockFrozen, sigilDisabled: true });
            }
        } else {
            // When S!gil is not active, add boosts normally
            // Add permanent luck as a luck boost if > 0
            // Cap display at 500% (5.0)
            if (userData?.luck > 0) {
                const cappedLuck = Math.min(userData.luck, 5.0); // Cap at 500%
                categorized.luck.push({
                    type: 'luck',
                    source: 'Permanent (Sanae Blessing)',
                    multiplier: 1 + cappedLuck, // For calculation purposes
                    expiresAt: null,
                    displayValue: `+${(cappedLuck * 100).toFixed(1)}% permanent luck` // Display as percentage
                });
            }

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

            // Add Yuyuko rolls to Divine (sanae) category - pray boost
            if (userData?.rollsLeft > 0) {
                categorized.sanae.push({
                    type: BOOST_TYPES.YUYUKO_ROLLS,
                    source: 'Yuyuko Prayer',
                    multiplier: 1,
                    expiresAt: null,
                    uses: userData.rollsLeft,
                    displayValue: `${userData.rollsLeft.toLocaleString()} bonus rolls (2× luck)`
                });
            }
        }

        const hasBoosts = Object.values(categorized).some(arr => arr.length > 0);
        const hasDisabledBoosts = sigilActive && Object.values(categorizedDisabled).some(arr => arr.length > 0);

        return {
            hasBoosts,
            boosts: categorized,
            disabledBoosts: sigilActive ? categorizedDisabled : null,
            sigilActive,
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

        // Luck for Rolls - this is percentage based, display as percentage
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
            // Get the actual multiplier value from the database
            // If boostMultiplier column doesn't exist, check activeBoosts table
            const actualMultiplier = sanaeData.boostMultiplier || 2;
            
            boosts.push({
                type: 'boostMultiplier',
                source: 'Sanae Blessing',
                multiplier: actualMultiplier,
                expiresAt: sanaeData.boostMultiplierExpiry,
                displayValue: `x${actualMultiplier} all active boosts`
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
        sanae: [],
        special: [] // For Tier 6 special effects
    };

    for (const boost of boosts) {
        const type = boost.type.toLowerCase();

        if (boost.source === SPECIAL_SOURCES.MYSTERIOUS_DICE) continue;
        if (type === 'summonspeed' && boost.source === SPECIAL_SOURCES.TIME_CLOCK) continue;

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
        } else if (type === 'summoncooldown' || type === 'summonspeed') {
            categorized.cooldown.push(boost);
        } else if (type === 'rollspeed') {
            categorized.cooldown.push(boost);
        } else if (type === 'voidtrait' || type === 'glitchedtrait' || type === 'traitluck' || type === 'variantluck') {
            // Tier 6 special effects
            categorized.special.push(boost);
        } else if (type === 'sell' || type === 'sellvalue' || type === 'reimuluck' || type === 'astralblock' || type === 'nullifiedrolls') {
            // S!gil special effects
            categorized.special.push(boost);
        }
    }

    return categorized;
}

function calculateTotals(categorized) {
    // Boosts stack ADDITIVELY, not multiplicatively
    // Each boost's multiplier is like: 1.5 = +50%, 16 = +1500%, etc.
    // We sum up the bonus portions: (multiplier - 1) for each
    
    let coinTotal = 1;
    let gemTotal = 1;
    
    for (const boost of categorized.coin) {
        // Add the bonus portion (multiplier - 1) means +X%
        coinTotal += (boost.multiplier - 1);
    }
    
    for (const boost of categorized.gem) {
        gemTotal += (boost.multiplier - 1);
    }
    
    return {
        coin: coinTotal,
        gem: gemTotal,
        luck: Math.max(...categorized.luck.map(b => b.multiplier), 1)
    };
}

module.exports = {
    getActiveBoosts,
    getMysteriousDiceBoost,
    getTimeClockBoost,
    getSanaeBoosts
};