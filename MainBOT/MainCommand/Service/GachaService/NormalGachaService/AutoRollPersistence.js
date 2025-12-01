const fs = require('fs');
const path = require('path');
const { debugLog } = require('../../../Core/logger');

const AUTO_ROLL_STATE_FILE = path.join(__dirname, '../../../Data/autoRollState.json');


function saveAutoRollState(normalAutoRollMap, eventAutoRollMap = null) {
    try {
        const stateData = {};
        
        for (const [userId, state] of normalAutoRollMap.entries()) {
            if (!stateData[userId]) stateData[userId] = {};
            
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
                specialFumoFirstRoll: state.specialFumoFirstRoll || null
            };
        }
        
        if (eventAutoRollMap) {
            for (const [userId, state] of eventAutoRollMap.entries()) {
                if (!stateData[userId]) stateData[userId] = {};
                
                stateData[userId].event = {
                    rollCount: state.rollCount || 0,
                    autoSell: state.autoSell || false,
                    startTime: state.startTime || Date.now(),
                    totalFumosRolled: state.totalFumosRolled || 0,
                    bestFumo: state.bestFumo ? {
                        name: state.bestFumo.name,
                        rarity: state.bestFumo.rarity,
                        picture: state.bestFumo.picture
                    } : null,
                    bestFumoAt: state.bestFumoAt || null,
                    bestFumoRoll: state.bestFumoRoll || null,
                    specialFumoCount: state.specialFumoCount || 0,
                    specialFumoFirstAt: state.specialFumoFirstAt || null,
                    specialFumoFirstRoll: state.specialFumoFirstRoll || null
                };
            }
        }

        const dir = path.dirname(AUTO_ROLL_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            AUTO_ROLL_STATE_FILE, 
            JSON.stringify(stateData, null, 2),
            'utf8'
        );

        debugLog('AUTO_ROLL_PERSIST', `Saved unified state for ${Object.keys(stateData).length} users`);
        return true;
    } catch (error) {
        console.error('❌ Failed to save auto-roll state:', error);
        return false;
    }
}

function loadAutoRollState() {
    try {
        if (!fs.existsSync(AUTO_ROLL_STATE_FILE)) {
            debugLog('AUTO_ROLL_PERSIST', 'No saved state file found');
            return {};
        }

        const data = fs.readFileSync(AUTO_ROLL_STATE_FILE, 'utf8');
        const stateData = JSON.parse(data);

        debugLog('AUTO_ROLL_PERSIST', `Loaded state for ${Object.keys(stateData).length} users`);
        return stateData;
    } catch (error) {
        console.error('❌ Failed to load auto-roll state:', error);
        return {};
    }
}

function clearAutoRollState() {
    try {
        if (fs.existsSync(AUTO_ROLL_STATE_FILE)) {
            fs.unlinkSync(AUTO_ROLL_STATE_FILE);
            debugLog('AUTO_ROLL_PERSIST', 'Cleared saved state file');
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to clear auto-roll state:', error);
        return false;
    }
}

function removeUserState(userId) {
    try {
        const stateData = loadAutoRollState();
        
        if (stateData[userId]) {
            delete stateData[userId];
            
            fs.writeFileSync(
                AUTO_ROLL_STATE_FILE,
                JSON.stringify(stateData, null, 2),
                'utf8'
            );
            
            debugLog('AUTO_ROLL_PERSIST', `Removed state for user ${userId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Failed to remove user state:', error);
        return false;
    }
}

function getUserState(userId) {
    const stateData = loadAutoRollState();
    return stateData[userId] || null;
}

function hasUserState(userId) {
    const stateData = loadAutoRollState();
    return !!stateData[userId];
}

module.exports = {
    saveAutoRollState,
    loadAutoRollState,
    clearAutoRollState,
    removeUserState,
    getUserState,
    hasUserState,
    AUTO_ROLL_STATE_FILE
};