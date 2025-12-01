const fs = require('fs');
const path = require('path');
const { debugLog } = require('../../../Core/logger');

const EVENT_AUTO_ROLL_STATE_FILE = path.join(__dirname, '../../../Data/eventAutoRollState.json');

function saveEventAutoRollState(eventAutoRollMap) {
    try {
        const stateData = {};
        
        for (const [userId, state] of eventAutoRollMap.entries()) {
            stateData[userId] = {
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
                specialFumos: state.specialFumos || []
            };
        }

        const dir = path.dirname(EVENT_AUTO_ROLL_STATE_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(
            EVENT_AUTO_ROLL_STATE_FILE,
            JSON.stringify(stateData, null, 2),
            'utf8'
        );

        debugLog('EVENT_AUTO_ROLL_PERSIST', `Saved state for ${Object.keys(stateData).length} users`);
        return true;
    } catch (error) {
        console.error('❌ Failed to save event auto-roll state:', error);
        return false;
    }
}

function loadEventAutoRollState() {
    try {
        if (!fs.existsSync(EVENT_AUTO_ROLL_STATE_FILE)) {
            debugLog('EVENT_AUTO_ROLL_PERSIST', 'No saved state file found');
            return {};
        }

        const data = fs.readFileSync(EVENT_AUTO_ROLL_STATE_FILE, 'utf8');
        const stateData = JSON.parse(data);

        debugLog('EVENT_AUTO_ROLL_PERSIST', `Loaded state for ${Object.keys(stateData).length} users`);
        return stateData;
    } catch (error) {
        console.error('❌ Failed to load event auto-roll state:', error);
        return {};
    }
}

function clearEventAutoRollState() {
    try {
        if (fs.existsSync(EVENT_AUTO_ROLL_STATE_FILE)) {
            fs.unlinkSync(EVENT_AUTO_ROLL_STATE_FILE);
            debugLog('EVENT_AUTO_ROLL_PERSIST', 'Cleared saved state file');
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to clear event auto-roll state:', error);
        return false;
    }
}

function removeEventUserState(userId) {
    try {
        const stateData = loadEventAutoRollState();
        
        if (stateData[userId]) {
            delete stateData[userId];
            
            fs.writeFileSync(
                EVENT_AUTO_ROLL_STATE_FILE,
                JSON.stringify(stateData, null, 2),
                'utf8'
            );
            
            debugLog('EVENT_AUTO_ROLL_PERSIST', `Removed state for user ${userId}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Failed to remove event user state:', error);
        return false;
    }
}

function getEventUserState(userId) {
    const stateData = loadEventAutoRollState();
    return stateData[userId] || null;
}

function hasEventUserState(userId) {
    const stateData = loadEventAutoRollState();
    return !!stateData[userId];
}

module.exports = {
    saveEventAutoRollState,
    loadEventAutoRollState,
    clearEventAutoRollState,
    removeEventUserState,
    getEventUserState,
    hasEventUserState,
    EVENT_AUTO_ROLL_STATE_FILE
};