const { get, run, all } = require('../../../Core/database');
const { performBatch100Roll } = require('./CrateGachaRollService');
const { calculateCooldown } = require('./BoostService');
const { SELL_REWARDS, SHINY_CONFIG, SPECIAL_RARITIES, compareFumos } = require('../../../Configuration/rarity');
const { debugLog } = require('../../../Core/logger');
const { 
    saveUnifiedAutoRollState, 
    loadNormalAutoRollState, 
    removeNormalUserState 
} = require('../UnifiedAutoRollPersistence');

const autoRollMap = new Map();
const AUTO_SAVE_INTERVAL = 30000;
let autoSaveTimer = null;

function getAutoRollMap() {
    return autoRollMap;
}

function startAutoSave() {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    
    autoSaveTimer = setInterval(() => {
        if (autoRollMap.size > 0) {
            const { getEventAutoRollMap } = require('../EventGachaService/EventAutoRollService');
            const eventAutoRollMap = getEventAutoRollMap();
            
            saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
            debugLog('AUTO_ROLL', `Auto-saved ${autoRollMap.size} normal + ${eventAutoRollMap.size} event auto-rolls`);
        }
    }, AUTO_SAVE_INTERVAL);
    
    console.log('✅ Auto-roll auto-save started (every 30s)');
}

function stopAutoSave() {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null;
        console.log('🛑 Auto-roll auto-save stopped');
    }
}

async function calculateAutoRollInterval(userId) {
    let interval = 60000;
    const now = Date.now();

    const [timeBlessing, timeClock] = await Promise.all([
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonCooldown' AND source = 'TimeBlessing' AND expiresAt > ?`, [userId, now]),
        get(`SELECT multiplier FROM activeBoosts WHERE userId = ? AND type = 'summonSpeed' AND source = 'TimeClock' AND expiresAt > ?`, [userId, now])
    ]);

    if (timeBlessing?.multiplier === 0.5) interval = 30000;
    if (timeClock?.multiplier === 2) interval = Math.floor(interval / 2);

    return interval;
}

async function performAutoSell(userId) {
    const inventoryRows = await all(
        `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? ORDER BY id DESC LIMIT 100`,
        [userId]
    );

    let totalSell = 0;
    const toDelete = [];
    const toUpdate = [];

    for (const row of inventoryRows) {
        let rarity = null;
        for (const r of Object.keys(SELL_REWARDS)) {
            const regex = new RegExp(`\\b${r}\\b`, 'i');
            if (regex.test(row.fumoName)) {
                rarity = r;
                break;
            }
        }

        if (rarity && ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'].includes(rarity)) {
            let value = SELL_REWARDS[rarity] || 0;
            if (row.fumoName.includes('[🌟alG]')) value *= SHINY_CONFIG.ALG_MULTIPLIER;
            else if (row.fumoName.includes('[✨SHINY]')) value *= SHINY_CONFIG.SHINY_MULTIPLIER;
            totalSell += value;

            if (row.quantity > 1) {
                toUpdate.push({ id: row.id, quantity: row.quantity - 1 });
            } else {
                toDelete.push(row.id);
            }
        }
    }

    for (const upd of toUpdate) {
        await run(`UPDATE userInventory SET quantity = ? WHERE userId = ? AND id = ?`, [upd.quantity, userId, upd.id]);
    }

    if (toDelete.length > 0) {
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND id IN (${toDelete.map(() => '?').join(',')})`,
            [userId, ...toDelete]
        );
    }

    if (totalSell > 0) {
        await run(`UPDATE userCoins SET coins = coins + ? WHERE userId = ?`, [totalSell, userId]);
    }

    return totalSell;
}

async function startAutoRoll(userId, fumos, autoSell = false) {
    debugLog('AUTO_ROLL', `Starting auto-roll for user ${userId}, autoSell: ${autoSell}`);

    if (autoRollMap.has(userId)) {
        return { success: false, error: 'ALREADY_RUNNING' };
    }

    const initialInterval = await calculateAutoRollInterval(userId);

    let rollCount = 0;
    let stopped = false;

    const state = {
        intervalId: null,
        autoSell,
        startTime: Date.now(),
        bestFumo: null,
        rollCount: 0,
        bestFumoAt: null,
        bestFumoRoll: null,
        specialFumoCount: 0,
        specialFumoFirstAt: null,
        specialFumoFirstRoll: null,
        lowerSpecialFumos: []
    };

    async function autoRollLoop() {
        if (stopped) return;
        rollCount++;

        const newInterval = await calculateAutoRollInterval(userId);

        try {
            const result = await performBatch100Roll(userId, fumos);

            const current = autoRollMap.get(userId);
            if (current) {
                current.rollCount = rollCount;
                const timeStr = new Date().toLocaleString();

                if (!current.bestFumo || (result && compareFumos(result, current.bestFumo) > 0)) {
                    current.bestFumo = result;
                    current.bestFumoAt = timeStr;
                    current.bestFumoRoll = rollCount;
                }

                if (result && SPECIAL_RARITIES.includes(result.rarity)) {
                    current.specialFumoCount++;
                    if (!current.specialFumoFirstAt) {
                        current.specialFumoFirstAt = timeStr;
                        current.specialFumoFirstRoll = rollCount;
                    }

                    if (current.bestFumo && compareFumos(result, current.bestFumo) < 0) {
                        current.lowerSpecialFumos.push({
                            name: result.name,
                            rarity: result.rarity,
                            roll: rollCount,
                            time: timeStr
                        });
                    }
                }
            }

            if (autoSell) {
                await performAutoSell(userId);
            }

        } catch (error) {
            console.error(`Auto Roll failed at roll #${rollCount}:`, error);
        }

        if (!stopped) {
            const intervalId = setTimeout(autoRollLoop, newInterval);
            const mapEntry = autoRollMap.get(userId);
            if (mapEntry) mapEntry.intervalId = intervalId;
        }
    }

    autoRollMap.set(userId, state);
    autoRollLoop();

    const { getEventAutoRollMap } = require('../EventGachaService/EventAutoRollService');
    const eventAutoRollMap = getEventAutoRollMap();
    saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);

    return { success: true, interval: initialInterval };
}

function stopAutoRoll(userId) {
    const auto = autoRollMap.get(userId);
    if (!auto) {
        return { success: false, error: 'NOT_RUNNING' };
    }

    if (auto.intervalId) clearTimeout(auto.intervalId);
    const summary = { ...auto };
    autoRollMap.delete(userId);

    removeNormalUserState(userId);

    return { success: true, summary };
}

function isAutoRollActive(userId) {
    return autoRollMap.has(userId);
}

function getAutoRollSummary(userId) {
    return autoRollMap.get(userId) || null;
}

async function restoreAutoRolls(client, fumoPool, options = {}) {
    const { notifyUsers = false, logChannelId = null } = options;
    const savedStates = loadNormalAutoRollState();
    const userIds = Object.keys(savedStates);

    if (userIds.length === 0) {
        console.log('ℹ️ No normal auto-rolls to restore');
        return { restored: 0, failed: 0, reasons: {} };
    }

    console.log(`🔄 Restoring ${userIds.length} normal auto-rolls...`);
    
    let restored = 0;
    let failed = 0;
    const failureReasons = {};

    for (const userId of userIds) {
        try {
            const savedState = savedStates[userId];
            const autoSell = savedState.autoSell || false;

            const userRow = await get(
                `SELECT coins FROM userCoins WHERE userId = ?`,
                [userId]
            );

            if (!userRow) {
                console.log(`⚠️ User ${userId} not found in database - removing state`);
                removeNormalUserState(userId);
                failureReasons[userId] = 'USER_NOT_FOUND';
                failed++;
                continue;
            }

            if (userRow.coins < 10000) {
                console.log(`⚠️ User ${userId} has insufficient coins - keeping state for later restoration`);
                failureReasons[userId] = 'INSUFFICIENT_COINS';
                failed++;
                continue;
            }

            const result = await startAutoRoll(userId, fumoPool, autoSell);
            
            if (result.success) {
                const current = autoRollMap.get(userId);
                if (current) {
                    current.rollCount = savedState.rollCount || 0;
                    current.startTime = savedState.startTime || Date.now();
                    current.bestFumo = savedState.bestFumo || null;
                    current.bestFumoAt = savedState.bestFumoAt || null;
                    current.bestFumoRoll = savedState.bestFumoRoll || null;
                    current.specialFumoCount = savedState.specialFumoCount || 0;
                    current.specialFumoFirstAt = savedState.specialFumoFirstAt || null;
                    current.specialFumoFirstRoll = savedState.specialFumoFirstRoll || null;
                    current.lowerSpecialFumos = savedState.lowerSpecialFumos || [];
                }

                restored++;
                console.log(`✅ Restored normal auto-roll for user ${userId}`);
            } else {
                failed++;
                failureReasons[userId] = result.error;
                console.log(`❌ Failed to restore normal auto-roll for user ${userId}: ${result.error}`);
            }

        } catch (error) {
            failed++;
            failureReasons[userId] = 'UNKNOWN_ERROR';
            console.error(`❌ Error restoring normal auto-roll for user ${userId}:`, error);
        }
    }
    
    if (Object.keys(failureReasons).length > 0) {
        console.log('📋 Failure reasons:', failureReasons);
    }
    
    startAutoSave();

    return { restored, failed, reasons: failureReasons };
}

function shutdownAutoRolls() {
    console.log('🛑 Shutting down normal auto-rolls...');
    
    const { getEventAutoRollMap } = require('../EventGachaService/EventAutoRollService');
    const eventAutoRollMap = getEventAutoRollMap();
    
    saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
    stopAutoSave();
    
    for (const [userId, state] of autoRollMap.entries()) {
        if (state.intervalId) {
            clearTimeout(state.intervalId);
        }
    }
    
    console.log(`💾 Saved ${autoRollMap.size} active normal auto-rolls to unified file`);
}

module.exports = {
    startAutoRoll,
    stopAutoRoll,
    isAutoRollActive,
    getAutoRollSummary,
    calculateAutoRollInterval,
    performAutoSell,
    autoRollMap,
    getAutoRollMap,
    restoreAutoRolls,
    shutdownAutoRolls,
    startAutoSave,
    stopAutoSave
};