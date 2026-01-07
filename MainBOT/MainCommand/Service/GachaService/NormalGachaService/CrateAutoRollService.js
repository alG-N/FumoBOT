const { get, run, all, transaction } = require('../../../Core/database');
const { performMultiRoll } = require('./CrateGachaRollService');
const { calculateCooldown } = require('./BoostService');
const { SELL_REWARDS, SHINY_CONFIG, SPECIAL_RARITIES, compareFumos } = require('../../../Configuration/rarity');
const { STORAGE_CONFIG } = require('../../../Configuration/storageConfig');
const { debugLog } = require('../../../Core/logger');
const { 
    saveUnifiedAutoRollState, 
    loadNormalAutoRollState, 
    removeNormalUserState 
} = require('../UnifiedAutoRollPersistence');
const StorageLimitService = require('../../UserDataService/StorageService/StorageLimitService');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

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

async function performAutoSell(userId, rolledFumos = []) {
    // Sellable rarities for auto-sell (below EXCLUSIVE)
    const SELLABLE_RARITIES = ['Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY', 'MYTHICAL'];
    
    let totalSell = 0;
    const toSell = {}; // Map of fumoName -> count to sell
    
    // Count how many of each sellable fumo was rolled
    for (const fumo of rolledFumos) {
        if (!fumo || !fumo.name) continue;
        
        const rarity = fumo.rarity;
        if (rarity && SELLABLE_RARITIES.includes(rarity)) {
            const key = fumo.name; // Full name like "Reimu(UNCOMMON)"
            toSell[key] = (toSell[key] || 0) + 1;
            
            let value = SELL_REWARDS[rarity] || 0;
            if (fumo.name.includes('[🌟alG]')) value *= SHINY_CONFIG.ALG_MULTIPLIER;
            else if (fumo.name.includes('[✨SHINY]')) value *= SHINY_CONFIG.SHINY_MULTIPLIER;
            
            totalSell += value;
        }
    }
    
    const fumoNames = Object.keys(toSell);
    if (fumoNames.length === 0) return totalSell;
    
    // OPTIMIZED: Single query to get all inventory rows for fumos to sell
    const placeholders = fumoNames.map(() => '?').join(',');
    const inventoryRows = await all(
        `SELECT id, fumoName, quantity FROM userInventory WHERE userId = ? AND fumoName IN (${placeholders})`,
        [userId, ...fumoNames]
    );
    
    // Build a map of fumoName -> row data
    const inventoryMap = new Map();
    for (const row of inventoryRows) {
        inventoryMap.set(row.fumoName, row);
    }
    
    // OPTIMIZED: Build all operations and execute in single transaction
    const operations = [];
    
    for (const [fumoName, count] of Object.entries(toSell)) {
        const row = inventoryMap.get(fumoName);
        if (row) {
            const newQuantity = (row.quantity || 1) - count;
            if (newQuantity <= 0) {
                operations.push({
                    sql: `DELETE FROM userInventory WHERE userId = ? AND id = ?`,
                    params: [userId, row.id]
                });
            } else {
                operations.push({
                    sql: `UPDATE userInventory SET quantity = ? WHERE userId = ? AND id = ?`,
                    params: [newQuantity, userId, row.id]
                });
            }
        }
    }
    
    // Add coin update to transaction
    if (totalSell > 0) {
        operations.push({
            sql: `UPDATE userCoins SET coins = coins + ? WHERE userId = ?`,
            params: [totalSell, userId]
        });
    }
    
    // Execute all operations in single transaction
    if (operations.length > 0) {
        await transaction(operations);
    }
    
    // Track coins earned from auto-sell for quest progress
    if (totalSell > 0) {
        await QuestMiddleware.trackCoinsEarned(userId, totalSell);
    }

    return totalSell;
}

async function startAutoRoll(userId, fumos, autoSell = false, skipSave = false) {
    debugLog('AUTO_ROLL', `Starting auto-roll for user ${userId}, autoSell: ${autoSell}, skipSave: ${skipSave}`);

    if (autoRollMap.has(userId)) {
        return { success: false, error: 'ALREADY_RUNNING' };
    }

    // Check storage - if full and no auto-sell, reject
    const storageStatus = await StorageLimitService.getStorageStatus(userId);
    if (storageStatus.current >= STORAGE_CONFIG.MAX_STORAGE && !autoSell) {
        return { 
            success: false, 
            error: 'STORAGE_FULL',
            message: 'Your storage is full! Enable auto-sell or free up space to continue.'
        };
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
        stoppedReason: null,
        sanaeGuaranteedUsed: 0
    };

    async function autoRollLoop() {
        if (stopped) return;
        rollCount++;

        // Check global storage limit
        const currentStorage = await StorageLimitService.getCurrentStorage(userId);
        if (currentStorage >= STORAGE_CONFIG.MAX_STORAGE) {
            console.log(`🛑 Auto-roll STOPPED for user ${userId}: Storage limit reached (${currentStorage.toLocaleString()}/${STORAGE_CONFIG.MAX_STORAGE.toLocaleString()})`);
            stopped = true;
            const auto = autoRollMap.get(userId);
            if (auto) auto.stoppedReason = 'STORAGE_LIMIT_REACHED';
            stopAutoRoll(userId);
            return;
        }

        // Check if enough space for next batch
        const storageStatus = await StorageLimitService.getStorageStatus(userId);
        if (storageStatus.remaining < 100 && !autoSell) {
            console.log(`⚠️ Auto-roll stopped for user ${userId}: Not enough storage space`);
            stopped = true;
            const auto = autoRollMap.get(userId);
            if (auto) auto.stoppedReason = 'STORAGE_FULL';
            stopAutoRoll(userId);
            return;
        }

        const newInterval = await calculateAutoRollInterval(userId);

        try {
            // Use performMultiRoll to get full result including Sanae tracking
            const result = await performMultiRoll(userId, fumos, 100, true);

            if (!result.success) {
                console.log(`⚠️ Auto-roll batch failed for user ${userId}: ${result.error}`);
                stopped = true;
                const auto = autoRollMap.get(userId);
                if (auto) auto.stoppedReason = result.error;
                stopAutoRoll(userId);
                return;
            }

            const current = autoRollMap.get(userId);
            if (current) {
                current.rollCount = rollCount;
                const timeStr = new Date().toLocaleString();

                // Track Sanae guaranteed rolls used
                if (result.sanaeGuaranteedUsed > 0) {
                    current.sanaeGuaranteedUsed = (current.sanaeGuaranteedUsed || 0) + result.sanaeGuaranteedUsed;
                }

                // Update best fumo if this batch has a better one
                if (result.bestFumo && (!current.bestFumo || compareFumos(result.bestFumo, current.bestFumo) > 0)) {
                    current.bestFumo = result.bestFumo;
                    current.bestFumoAt = timeStr;
                    current.bestFumoRoll = rollCount;
                }

                // Track special fumos
                if (result.bestFumo && SPECIAL_RARITIES.includes(result.bestFumo.rarity)) {
                    current.specialFumoCount++;
                    if (!current.specialFumoFirstAt) {
                        current.specialFumoFirstAt = timeStr;
                        current.specialFumoFirstRoll = rollCount;
                    }
                }
            }

            if (autoSell) {
                await performAutoSell(userId, result.fumosBought || []);
            }

        } catch (error) {
            console.error(`Auto Roll failed at roll #${rollCount}:`, error);
            stopped = true;
            const auto = autoRollMap.get(userId);
            if (auto) auto.stoppedReason = 'ERROR';
        }

        if (!stopped) {
            const intervalId = setTimeout(autoRollLoop, newInterval);
            const mapEntry = autoRollMap.get(userId);
            if (mapEntry) mapEntry.intervalId = intervalId;
        } else {
            stopAutoRoll(userId);
        }
    }

    autoRollMap.set(userId, state);
    autoRollLoop();

    // Only save state if not restoring (skipSave prevents overwriting loaded state)
    if (!skipSave) {
        const { getEventAutoRollMap } = require('../EventGachaService/EventAutoRollService');
        const eventAutoRollMap = getEventAutoRollMap();
        saveUnifiedAutoRollState(autoRollMap, eventAutoRollMap);
    }

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
    
    const AUTO_ROLL_LEVEL_REQUIREMENT = 10;
    let restored = 0;
    let failed = 0;
    const failureReasons = {};

    for (const userId of userIds) {
        try {
            const savedState = savedStates[userId];
            const autoSell = savedState.autoSell || false;

            // Check level requirement first
            const levelRow = await get(
                `SELECT level FROM userLevelProgress WHERE userId = ?`,
                [userId]
            );
            const userLevel = levelRow?.level || 1;
            
            if (userLevel < AUTO_ROLL_LEVEL_REQUIREMENT) {
                console.log(`⚠️ User ${userId} is level ${userLevel} (requires ${AUTO_ROLL_LEVEL_REQUIREMENT}) - removing auto-roll state`);
                removeNormalUserState(userId);
                failureReasons[userId] = 'LEVEL_NOT_REACHED';
                failed++;
                continue;
            }

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

            const result = await startAutoRoll(userId, fumoPool, autoSell, true);
            
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
                    current.sanaeGuaranteedUsed = savedState.sanaeGuaranteedUsed || 0;
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