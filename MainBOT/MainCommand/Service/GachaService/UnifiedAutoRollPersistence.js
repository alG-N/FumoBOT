const fs = require('fs');
const path = require('path');
const { debugLog } = require('../../Core/logger');

const UNIFIED_AUTO_ROLL_STATE_FILE = path.join(__dirname, '../../Data/unifiedAutoRollState.json');

// In-memory cache and debounced save
let stateCache = null;
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 5000; // Save at most every 5 seconds

// Async debounced save - prevents blocking on every state change
function scheduleSave() {
    if (saveTimeout) return; // Already scheduled
    
    saveTimeout = setTimeout(async () => {
        saveTimeout = null;
        if (stateCache !== null) {
            try {
                await fs.promises.writeFile(
                    UNIFIED_AUTO_ROLL_STATE_FILE,
                    JSON.stringify(stateCache, null, 2),
                    'utf8'
                );
                debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Async saved state for ${Object.keys(stateCache).length} users`);
            } catch (error) {
                console.error('❌ Failed to async save unified auto-roll state:', error);
            }
        }
    }, SAVE_DEBOUNCE_MS);
}

// Force immediate save (for shutdown)
async function forceSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    if (stateCache !== null) {
        try {
            await fs.promises.writeFile(
                UNIFIED_AUTO_ROLL_STATE_FILE,
                JSON.stringify(stateCache, null, 2),
                'utf8'
            );
        } catch (error) {
            console.error('❌ Failed to force save:', error);
        }
    }
}

function saveUnifiedAutoRollState(normalAutoRollMap, eventAutoRollMap) {
    try {
        const existingState = loadUnifiedAutoRollState();
        const stateData = { ...existingState }; // Start with existing data
        
        const allUserIds = new Set([
            ...normalAutoRollMap.keys(),
            ...eventAutoRollMap.keys(),
            ...Object.keys(existingState)
        ]);
        
        for (const userId of allUserIds) {
            if (!stateData[userId]) stateData[userId] = {};
            
            if (normalAutoRollMap.has(userId)) {
                const state = normalAutoRollMap.get(userId);
                stateData[userId].normal = {
                    rollCount: state.rollCount || 0,
                    autoSell: state.autoSell || false,
                    startTime: state.startTime || Date.now(),
                    bestFumo: state.bestFumo ? {
                        name: state.bestFumo.name,
                        rarity: state.bestFumo.rarity,
                        picture: state.bestFumo.picture
                    } : null,
                    bestFumoAt: state.bestFumoAt || null,
                    bestFumoRoll: state.bestFumoRoll || null,
                    specialFumoCount: state.specialFumoCount || 0,
                    specialFumoFirstAt: state.specialFumoFirstAt || null,
                    specialFumoFirstRoll: state.specialFumoFirstRoll || null,
                    sanaeGuaranteedUsed: state.sanaeGuaranteedUsed || 0
                };
            }
            
            if (eventAutoRollMap.has(userId)) {
                const state = eventAutoRollMap.get(userId);
                stateData[userId].event = {
                    rollCount: state.rollCount || 0,
                    autoSell: state.autoSell || false,
                    startTime: state.startTime || Date.now(),
                    totalFumosRolled: state.totalFumosRolled || 0,
                    totalCoinsFromSales: state.totalCoinsFromSales || 0,
                    bestFumo: state.bestFumo ? {
                        name: state.bestFumo.name,
                        rarity: state.bestFumo.rarity,
                        picture: state.bestFumo.picture
                    } : null,
                    bestFumoAt: state.bestFumoAt || null,
                    bestFumoRoll: state.bestFumoRoll || null,
                    specialFumoCount: state.specialFumoCount || 0,
                    specialFumoFirstAt: state.specialFumoFirstAt || null,
                    specialFumoFirstRoll: state.specialFumoFirstRoll || null,
                    sanaeGuaranteedUsed: state.sanaeGuaranteedUsed || 0
                };
            }
            
            if (!stateData[userId].normal && !stateData[userId].event) {
                delete stateData[userId];
            }
        }

        const dir = path.dirname(UNIFIED_AUTO_ROLL_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Update cache and schedule async save
        stateCache = stateData;
        scheduleSave();

        debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Cached unified state for ${Object.keys(stateData).length} users`);
        return true;
    } catch (error) {
        console.error('❌ Failed to save unified auto-roll state:', error);
        return false;
    }
}

function loadUnifiedAutoRollState() {
    // Return cached version if available
    if (stateCache !== null) {
        return stateCache;
    }
    
    try {
        if (!fs.existsSync(UNIFIED_AUTO_ROLL_STATE_FILE)) {
            debugLog('UNIFIED_AUTO_ROLL_PERSIST', 'No saved state file found');
            stateCache = {};
            return stateCache;
        }

        const data = fs.readFileSync(UNIFIED_AUTO_ROLL_STATE_FILE, 'utf8');
        stateCache = JSON.parse(data);

        debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Loaded unified state for ${Object.keys(stateCache).length} users`);
        return stateCache;
    } catch (error) {
        console.error('❌ Failed to load unified auto-roll state:', error);
        stateCache = {};
        return stateCache;
    }
}

function loadNormalAutoRollState() {
    const unifiedState = loadUnifiedAutoRollState();
    const normalStates = {};
    
    for (const [userId, states] of Object.entries(unifiedState)) {
        if (states.normal) {
            normalStates[userId] = states.normal;
        }
    }
    
    return normalStates;
}

function loadEventAutoRollState() {
    const unifiedState = loadUnifiedAutoRollState();
    const eventStates = {};
    
    for (const [userId, states] of Object.entries(unifiedState)) {
        if (states.event) {
            eventStates[userId] = states.event;
        }
    }
    
    return eventStates;
}

function clearUnifiedAutoRollState() {
    try {
        if (fs.existsSync(UNIFIED_AUTO_ROLL_STATE_FILE)) {
            fs.unlinkSync(UNIFIED_AUTO_ROLL_STATE_FILE);
            debugLog('UNIFIED_AUTO_ROLL_PERSIST', 'Cleared unified saved state file');
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to clear unified auto-roll state:', error);
        return false;
    }
}

function removeUserState(userId) {
    try {
        const stateData = loadUnifiedAutoRollState();
        
        if (stateData[userId]) {
            delete stateData[userId];
            stateCache = stateData;
            scheduleSave();
            
            debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Removed unified state for user ${userId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Failed to remove user state:', error);
        return false;
    }
}

function removeNormalUserState(userId) {
    try {
        const stateData = loadUnifiedAutoRollState();
        
        if (stateData[userId]?.normal) {
            delete stateData[userId].normal;
            
            if (!stateData[userId].event) {
                delete stateData[userId];
            }
            
            stateCache = stateData;
            scheduleSave();
            
            debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Removed normal state for user ${userId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Failed to remove normal user state:', error);
        return false;
    }
}

function removeEventUserState(userId) {
    try {
        const stateData = loadUnifiedAutoRollState();
        
        if (stateData[userId]?.event) {
            delete stateData[userId].event;
            
            if (!stateData[userId].normal) {
                delete stateData[userId];
            }
            
            stateCache = stateData;
            scheduleSave();
            
            debugLog('UNIFIED_AUTO_ROLL_PERSIST', `Removed event state for user ${userId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Failed to remove event user state:', error);
        return false;
    }
}

function getUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return stateData[userId] || null;
}

function hasUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return !!stateData[userId];
}

function getNormalUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return stateData[userId]?.normal || null;
}

function getEventUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return stateData[userId]?.event || null;
}

function hasNormalUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return !!stateData[userId]?.normal;
}

function hasEventUserState(userId) {
    const stateData = loadUnifiedAutoRollState();
    return !!stateData[userId]?.event;
}

module.exports = {
    saveUnifiedAutoRollState,
    loadUnifiedAutoRollState,
    clearUnifiedAutoRollState,
    loadNormalAutoRollState,
    loadEventAutoRollState,
    removeUserState,
    removeNormalUserState,
    removeEventUserState,
    getUserState,
    hasUserState,
    getNormalUserState,
    getEventUserState,
    hasNormalUserState,
    hasEventUserState,
    forceSave,
    UNIFIED_AUTO_ROLL_STATE_FILE
};