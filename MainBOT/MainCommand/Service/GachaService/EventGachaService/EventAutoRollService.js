const { get, all, run } = require('../../../Core/database');
const { performEventSummon, getEventUserRollData } = require('./EventGachaService');
const { 
    EVENT_AUTO_ROLL_INTERVAL, 
    EVENT_AUTO_ROLL_INTERVAL_BOOSTED,
    EVENT_AUTO_ROLL_BATCH_SIZE,
    isWindowExpired,
    isEventActive
} = require('../../../Configuration/eventConfig');
const { SPECIAL_RARITIES, compareFumos, SELL_REWARDS, SHINY_CONFIG } = require('../../../Configuration/rarity');

// Define special rarities for New Year event banner (UPPERCASE to match FumoPool)
const EVENT_SPECIAL_RARITIES = ['???', 'TRANSCENDENT'];

const { 
    saveUnifiedAutoRollState, 
    loadEventAutoRollState, 
    removeEventUserState 
} = require('../UnifiedAutoRollPersistence');

const eventAutoRollMap = new Map();
const EVENT_AUTO_SAVE_INTERVAL = 30000;
let eventAutoSaveTimer = null;

function getEventAutoRollMap() {
    return eventAutoRollMap;
}

function startEventAutoSave() {
    if (eventAutoSaveTimer) clearInterval(eventAutoSaveTimer);
    
    eventAutoSaveTimer = setInterval(() => {
        if (eventAutoRollMap.size > 0) {
            const { getAutoRollMap } = require('../NormalGachaService/CrateAutoRollService');
            const autoRollMap = getAutoRollMap();
            
            saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
        }
    }, EVENT_AUTO_SAVE_INTERVAL);
}

function stopEventAutoSave() {
    if (eventAutoSaveTimer) {
        clearInterval(eventAutoSaveTimer);
        eventAutoSaveTimer = null;
    }
}

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

async function performEventAutoSell(userId, rolledFumos = []) {
    let totalCoins = 0;
    const toSell = {}; // Map of fumoName -> count to sell

    // Rarities to auto-sell for New Year event banner (keep ??? and higher)
    const SELLABLE_EVENT_RARITIES = ['Common', 'UNCOMMON', 'RARE'];

    // Count how many of each sellable fumo was rolled
    for (const fumo of rolledFumos) {
        if (!fumo || !fumo.name) continue;
        
        const rarity = fumo.rarity;
        if (rarity && SELLABLE_EVENT_RARITIES.includes(rarity)) {
            const key = fumo.name; // Full name like "NewYearReimu(UNCOMMON)"
            toSell[key] = (toSell[key] || 0) + 1;
            
            let value = SELL_REWARDS[rarity] || 0;
            if (fumo.name.includes('[🌟alG]')) value *= SHINY_CONFIG.ALG_MULTIPLIER;
            else if (fumo.name.includes('[✨SHINY]')) value *= SHINY_CONFIG.SHINY_MULTIPLIER;
            
            totalCoins += value;
        }
    }
    
    // Now remove the sold fumos from inventory
    for (const [fumoName, count] of Object.entries(toSell)) {
        // Get current inventory entry
        const row = await get(
            `SELECT id, quantity FROM userInventory WHERE userId = ? AND fumoName = ?`,
            [userId, fumoName]
        );
        
        if (row) {
            const newQuantity = (row.quantity || 1) - count;
            if (newQuantity <= 0) {
                await run(`DELETE FROM userInventory WHERE userId = ? AND id = ?`, [userId, row.id]);
            } else {
                await run(`UPDATE userInventory SET quantity = ? WHERE userId = ? AND id = ?`, [newQuantity, userId, row.id]);
            }
        }
    }
    
    if (totalCoins > 0) {
        await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [totalCoins, userId]);
    }

    return totalCoins;
}

async function startEventAutoRoll(userId, autoSell = false, skipSave = false) {
    if (eventAutoRollMap.has(userId)) {
        return { success: false, error: 'ALREADY_RUNNING' };
    }

    if (!isEventActive()) {
        return { success: false, error: 'EVENT_INACTIVE' };
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

        if (!isEventActive()) {
            const auto = eventAutoRollMap.get(userId);
            if (auto) {
                auto.stoppedReason = 'EVENT_ENDED';
            }
            stopped = true;
            stopEventAutoRoll(userId);
            return;
        }

        const newInterval = await calculateEventAutoRollInterval(userId);

        try {
            const currentData = await getEventUserRollData(userId);
            let { rollsInCurrentWindow, lastRollTime } = currentData;
            
            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
            }

            // No roll limit - use full batch size
            const batchSize = EVENT_AUTO_ROLL_BATCH_SIZE;

            const result = await performEventSummon(userId, batchSize);

            if (!result.success) {
                stopped = true;
                
                const auto = eventAutoRollMap.get(userId);
                if (auto) {
                    auto.stoppedReason = result.error;
                }
                stopEventAutoRoll(userId);
                return;
            }

            rollCount++;

            if (autoSell) {
                const coinsEarned = await performEventAutoSell(userId, result.fumoList || []);
                totalCoinsFromSales += coinsEarned;
            }

            const current = eventAutoRollMap.get(userId);
            if (current) {
                current.rollCount = rollCount;
                current.totalFumosRolled += batchSize;
                current.totalCoinsFromSales = totalCoinsFromSales;
                
                // Track Sanae guaranteed rolls used
                if (result.sanaeGuaranteedUsed > 0) {
                    current.sanaeGuaranteedUsed = (current.sanaeGuaranteedUsed || 0) + result.sanaeGuaranteedUsed;
                }
                
                const timeStr = new Date().toLocaleString();

                if (result.fumoList && result.fumoList.length > 0) {
                    for (const fumo of result.fumoList) {
                        if (!current.bestFumo || compareEventFumos(fumo, current.bestFumo) > 0) {
                            current.bestFumo = fumo;
                            current.bestFumoAt = timeStr;
                            current.bestFumoRoll = rollCount;
                        }

                        // Use event-specific special rarities
                        if (EVENT_SPECIAL_RARITIES.includes(fumo.rarity)) {
                            current.specialFumoCount++;
                            if (!current.specialFumos) current.specialFumos = [];
                            current.specialFumos.push({
                                ...fumo,
                                roll: rollCount,
                                at: timeStr
                            });
                            if (!current.specialFumoFirstAt) {
                                current.specialFumoFirstAt = timeStr;
                                current.specialFumoFirstRoll = rollCount;
                            }
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
        autoSell,
        startTime: Date.now(),
        sanaeGuaranteedUsed: 0
    });

    eventAutoRollLoop();

    // Only save if not restoring (to avoid overwriting restored values)
    if (!skipSave) {
        const { getAutoRollMap } = require('../NormalGachaService/CrateAutoRollService');
        const autoRollMap = getAutoRollMap();
        saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
    }

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

    removeEventUserState(userId);

    return { success: true, summary };
}

function isEventAutoRollActive(userId) {
    return eventAutoRollMap.has(userId);
}

function getEventAutoRollSummary(userId) {
    return eventAutoRollMap.get(userId) || null;
}

async function restoreEventAutoRolls(client, options = {}) {
    const { notifyUsers = false, logChannelId = null } = options;
    const savedStates = loadEventAutoRollState();
    const userIds = Object.keys(savedStates);

    if (userIds.length === 0) {
        return { restored: 0, failed: 0, reasons: {} };
    }

    console.log(`🔄 Restoring ${userIds.length} event auto-rolls...`);

    const AUTO_ROLL_LEVEL_REQUIREMENT = 10;
    let restored = 0;
    let failed = 0;
    const failureReasons = {};

    for (const userId of userIds) {
        try {
            const saved = savedStates[userId];

            // Check level requirement first
            const levelRow = await get(
                `SELECT level FROM userLevelProgress WHERE userId = ?`,
                [userId]
            );
            const userLevel = levelRow?.level || 1;
            
            if (userLevel < AUTO_ROLL_LEVEL_REQUIREMENT) {
                console.log(`⚠️ User ${userId} is level ${userLevel} (requires ${AUTO_ROLL_LEVEL_REQUIREMENT}) - removing event auto-roll state`);
                removeEventUserState(userId);
                failureReasons[userId] = 'LEVEL_NOT_REACHED';
                failed++;
                continue;
            }

            const data = await getEventUserRollData(userId);
            
            if (!data) {
                failureReasons[userId] = 'USER_NOT_FOUND';
                failed++;
                removeEventUserState(userId);
                continue;
            }

            if (!data.hasFantasyBook) {
                failureReasons[userId] = 'NO_FANTASY_BOOK';
                failed++;
                continue;
            }

            if (data.gems < 100) {
                failureReasons[userId] = 'INSUFFICIENT_GEMS';
                failed++;
                continue;
            }

            // No longer checking roll limits - unlimited rolling allowed

            if (!isEventActive()) {
                failureReasons[userId] = 'EVENT_INACTIVE';
                failed++;
                continue;
            }

            // Pass skipSave=true to prevent overwriting saved state before restoration
            const result = await startEventAutoRoll(userId, saved.autoSell, true);

            if (result.success) {
                const current = eventAutoRollMap.get(userId);
                if (current) {
                    current.rollCount = saved.rollCount || 0;
                    current.totalFumosRolled = saved.totalFumosRolled || 0;
                    current.totalCoinsFromSales = saved.totalCoinsFromSales || 0;
                    current.bestFumo = saved.bestFumo || null;
                    current.bestFumoAt = saved.bestFumoAt || null;
                    current.bestFumoRoll = saved.bestFumoRoll || null;
                    current.specialFumoCount = saved.specialFumoCount || 0;
                    current.specialFumoFirstAt = saved.specialFumoFirstAt || null;
                    current.specialFumoFirstRoll = saved.specialFumoFirstRoll || null;
                    current.specialFumos = saved.specialFumos || [];
                    current.startTime = saved.startTime || Date.now();
                    current.sanaeGuaranteedUsed = saved.sanaeGuaranteedUsed || 0;
                }

                restored++;
            } else {
                failed++;
                failureReasons[userId] = result.error;
            }
        } catch (err) {
            failed++;
            failureReasons[userId] = `EXCEPTION: ${err.message}`;
            console.error(`❌ Error restoring event auto-roll for user ${userId}:`, err);
        }
    }

    console.log(`📊 Event auto-roll restoration complete: ${restored} restored, ${failed} failed`);

    startEventAutoSave();

    return { restored, failed, reasons: failureReasons };
}

function shutdownEventAutoRolls() {
    console.log('🛑 Shutting down event auto-rolls...');
    
    const { getAutoRollMap } = require('../NormalGachaService/CrateAutoRollService');
    const autoRollMap = getAutoRollMap();
    
    saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
    stopEventAutoSave();
    
    for (const [userId, state] of eventAutoRollMap.entries()) {
        if (state.intervalId) {
            clearTimeout(state.intervalId);
        }
    }

    console.log(`💾 Saved ${eventAutoRollMap.size} active event auto-rolls to unified file`);
}

/**
 * Compare fumos for New Year event banner
 * Uses UPPERCASE rarities to match FumoPool data
 */
function compareEventFumos(fumo1, fumo2) {
    const rarityOrder = ['Common', 'UNCOMMON', 'RARE', '???', 'TRANSCENDENT'];
    const idx1 = rarityOrder.indexOf(fumo1.rarity);
    const idx2 = rarityOrder.indexOf(fumo2.rarity);
    return idx1 - idx2;
}

module.exports = {
    startEventAutoRoll,
    stopEventAutoRoll,
    isEventAutoRollActive,
    getEventAutoRollSummary,
    calculateEventAutoRollInterval,
    performEventAutoSell,
    eventAutoRollMap,
    getEventAutoRollMap,
    restoreEventAutoRolls,
    shutdownEventAutoRolls,
    startEventAutoSave,
    stopEventAutoSave,
    compareEventFumos,
    EVENT_SPECIAL_RARITIES
};