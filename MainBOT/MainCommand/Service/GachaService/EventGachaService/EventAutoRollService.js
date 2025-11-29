const { get, all, run } = require('../../../Core/database');
const { performEventSummon, getEventUserRollData } = require('./EventGachaService');
const { 
    EVENT_AUTO_ROLL_INTERVAL, 
    EVENT_AUTO_ROLL_INTERVAL_BOOSTED,
    EVENT_AUTO_ROLL_BATCH_SIZE,
    EVENT_ROLL_LIMIT,
    isWindowExpired
} = require('../../../Configuration/eventConfig');
const { SPECIAL_RARITIES, compareFumos, SELL_REWARDS, SHINY_CONFIG } = require('../../../Configuration/rarity');
const { debugLog } = require('../../../Core/logger');

const eventAutoRollMap = new Map();

async function calculateEventAutoRollInterval(userId) {
    const now = Date.now();
    
    const [timeBlessing, timeClock] = await Promise.all([
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now])
    ]);

    let interval = EVENT_AUTO_ROLL_INTERVAL;

    if (timeBlessing?.multiplier === 0.5) {
        interval = EVENT_AUTO_ROLL_INTERVAL_BOOSTED;
    }
    
    if (timeClock?.multiplier === 2) {
        interval = Math.floor(interval / 2);
    }

    return interval;
}

async function performEventAutoSell(userId) {
    const inventoryRows = await all(
        `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? ORDER BY id DESC LIMIT 100`,
        [userId]
    );

    let totalCoins = 0;
    const toDelete = [];
    const toUpdate = [];

    for (const row of inventoryRows) {
        let rarity = null;
        
        if (row.fumoName.includes('(EPIC)')) {
            rarity = 'EPIC';
        } else if (row.fumoName.includes('(LEGENDARY)')) {
            rarity = 'LEGENDARY';
        }

        if (rarity && ['EPIC', 'LEGENDARY'].includes(rarity)) {
            let value = SELL_REWARDS[rarity] || 0;
            
            if (row.fumoName.includes('[🌟alG]')) {
                value *= SHINY_CONFIG.ALG_MULTIPLIER;
            } else if (row.fumoName.includes('[✨SHINY]')) {
                value *= SHINY_CONFIG.SHINY_MULTIPLIER;
            }
            
            totalCoins += value * row.quantity;

            toDelete.push(row.id);
        }
    }

    if (toDelete.length > 0) {
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND id IN (${toDelete.map(() => '?').join(',')})`,
            [userId, ...toDelete]
        );
    }

    if (totalCoins > 0) {
        await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [totalCoins, userId]);
    }

    debugLog('EVENT_AUTO_SELL', `Sold ${toDelete.length} fumos for ${totalCoins} coins`);
    return totalCoins;
}

async function startEventAutoRoll(userId, autoSell = false) {
    debugLog('EVENT_AUTO_ROLL', `Starting event auto-roll for user ${userId}, autoSell: ${autoSell}`);

    if (eventAutoRollMap.has(userId)) {
        return { success: false, error: 'ALREADY_RUNNING' };
    }

    const userData = await getEventUserRollData(userId);
    if (!userData?.hasFantasyBook) {
        return { success: false, error: 'NO_FANTASY_BOOK' };
    }

    const initialInterval = await calculateEventAutoRollInterval(userId);

    let rollCount = 0;
    let totalCoinsFromSales = 0;
    let stopped = false;

    async function eventAutoRollLoop() {
        if (stopped) return;

        const newInterval = await calculateEventAutoRollInterval(userId);

        try {
            const currentData = await getEventUserRollData(userId);
            let { rollsInCurrentWindow, lastRollTime } = currentData;
            
            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
            }

            if (rollsInCurrentWindow >= EVENT_ROLL_LIMIT) {
                debugLog('EVENT_AUTO_ROLL', `User ${userId} reached roll limit, stopping auto-roll`);
                const auto = eventAutoRollMap.get(userId);
                if (auto) {
                    auto.stoppedReason = 'LIMIT_REACHED';
                }
                stopped = true;
                return;
            }

            const rollsRemaining = EVENT_ROLL_LIMIT - rollsInCurrentWindow;
            const batchSize = Math.min(EVENT_AUTO_ROLL_BATCH_SIZE, rollsRemaining);

            const result = await performEventSummon(userId, batchSize);

            if (!result.success) {
                debugLog('EVENT_AUTO_ROLL', `Roll failed for user ${userId}: ${result.error}`);
                stopped = true;
                
                const auto = eventAutoRollMap.get(userId);
                if (auto) {
                    auto.stoppedReason = result.error;
                }
                return;
            }

            rollCount++;

            if (autoSell) {
                const coinsEarned = await performEventAutoSell(userId);
                totalCoinsFromSales += coinsEarned;
            }

            const current = eventAutoRollMap.get(userId);
            if (current) {
                current.rollCount = rollCount;
                current.totalFumosRolled += batchSize;
                current.totalCoinsFromSales = totalCoinsFromSales;
                const timeStr = new Date().toLocaleString();

                if (result.fumoList && result.fumoList.length > 0) {
                    for (const fumo of result.fumoList) {
                        if (!current.bestFumo || compareFumos(fumo, current.bestFumo) > 0) {
                            current.bestFumo = fumo;
                            current.bestFumoAt = timeStr;
                            current.bestFumoRoll = rollCount;
                        }

                        if (SPECIAL_RARITIES.includes(fumo.rarity)) {
                            current.specialFumoCount++;
                            if (!current.specialFumoFirstAt) {
                                current.specialFumoFirstAt = timeStr;
                                current.specialFumoFirstRoll = rollCount;
                            }

                            current.specialFumos.push({
                                name: fumo.name,
                                rarity: fumo.rarity,
                                roll: rollCount,
                                time: timeStr
                            });
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`Event Auto Roll failed at batch #${rollCount}:`, error);
            stopped = true;
            
            const auto = eventAutoRollMap.get(userId);
            if (auto) {
                auto.stoppedReason = 'ERROR';
            }
        }

        if (!stopped) {
            const intervalId = setTimeout(eventAutoRollLoop, newInterval);
            const mapEntry = eventAutoRollMap.get(userId);
            if (mapEntry) mapEntry.intervalId = intervalId;
        } else {
            stopEventAutoRoll(userId);
        }
    }

    eventAutoRollMap.set(userId, {
        intervalId: null,
        bestFumo: null,
        rollCount: 0,
        totalFumosRolled: 0,
        totalCoinsFromSales: 0,
        bestFumoAt: null,
        bestFumoRoll: null,
        specialFumoCount: 0,
        specialFumoFirstAt: null,
        specialFumoFirstRoll: null,
        specialFumos: [],
        stoppedReason: null,
        autoSell
    });

    eventAutoRollLoop();

    return { success: true, interval: initialInterval };
}

function stopEventAutoRoll(userId) {
    const auto = eventAutoRollMap.get(userId);
    if (!auto) {
        return { success: false, error: 'NOT_RUNNING' };
    }

    if (auto.intervalId) clearTimeout(auto.intervalId);
    const summary = { ...auto };
    eventAutoRollMap.delete(userId);

    return { success: true, summary };
}

function isEventAutoRollActive(userId) {
    return eventAutoRollMap.has(userId);
}

function getEventAutoRollSummary(userId) {
    return eventAutoRollMap.get(userId) || null;
}

module.exports = {
    startEventAutoRoll,
    stopEventAutoRoll,
    isEventAutoRollActive,
    getEventAutoRollSummary,
    calculateEventAutoRollInterval,
    performEventAutoSell,
    eventAutoRollMap
};