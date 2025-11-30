const { get, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

async function initializeBuildingTables() {
    await run(`
        CREATE TABLE IF NOT EXISTS userBuildings (
            userId TEXT PRIMARY KEY,
            coinBoostLevel INTEGER DEFAULT 0,
            gemBoostLevel INTEGER DEFAULT 0,
            criticalFarmingLevel INTEGER DEFAULT 0,
            eventBoostLevel INTEGER DEFAULT 0
        )
    `);
    
    debugLog('BUILDINGS', 'Building tables initialized');
}

async function getUserBuildings(userId) {
    const row = await get(
        `SELECT * FROM userBuildings WHERE userId = ?`,
        [userId]
    );
    
    if (!row) {
        await run(
            `INSERT INTO userBuildings (userId, coinBoostLevel, gemBoostLevel, criticalFarmingLevel, eventBoostLevel)
             VALUES (?, 0, 0, 0, 0)`,
            [userId]
        );
        
        return {
            userId,
            coinBoostLevel: 0,
            gemBoostLevel: 0,
            criticalFarmingLevel: 0,
            eventBoostLevel: 0
        };
    }
    
    return row;
}

async function getBuildingLevel(userId, buildingType) {
    const buildings = await getUserBuildings(userId);
    
    const columnMap = {
        COIN_BOOST: 'coinBoostLevel',
        GEM_BOOST: 'gemBoostLevel',
        CRITICAL_FARMING: 'criticalFarmingLevel',
        EVENT_BOOST: 'eventBoostLevel'
    };
    
    const column = columnMap[buildingType];
    return column ? buildings[column] : 0;
}

async function upgradeBuilding(userId, buildingType) {
    const columnMap = {
        COIN_BOOST: 'coinBoostLevel',
        GEM_BOOST: 'gemBoostLevel',
        CRITICAL_FARMING: 'criticalFarmingLevel',
        EVENT_BOOST: 'eventBoostLevel'
    };
    
    const column = columnMap[buildingType];
    if (!column) {
        throw new Error('Invalid building type');
    }
    
    await getUserBuildings(userId);
    
    const result = await run(
        `UPDATE userBuildings SET ${column} = ${column} + 1 WHERE userId = ?`,
        [userId]
    );
    
    debugLog('BUILDINGS', `Upgraded ${buildingType} for user ${userId}`);
    return result;
}

async function getBuildingLevels(userId) {
    const buildings = await getUserBuildings(userId);
    
    return {
        COIN_BOOST: buildings.coinBoostLevel,
        GEM_BOOST: buildings.gemBoostLevel,
        CRITICAL_FARMING: buildings.criticalFarmingLevel,
        EVENT_BOOST: buildings.eventBoostLevel
    };
}

async function resetAllBuildings(userId) {
    await run(
        `UPDATE userBuildings 
         SET coinBoostLevel = 0, gemBoostLevel = 0, criticalFarmingLevel = 0, eventBoostLevel = 0
         WHERE userId = ?`,
        [userId]
    );
    
    debugLog('BUILDINGS', `Reset all buildings for user ${userId}`);
}

async function setBuildingLevel(userId, buildingType, level) {
    const columnMap = {
        COIN_BOOST: 'coinBoostLevel',
        GEM_BOOST: 'gemBoostLevel',
        CRITICAL_FARMING: 'criticalFarmingLevel',
        EVENT_BOOST: 'eventBoostLevel'
    };
    
    const column = columnMap[buildingType];
    if (!column) {
        throw new Error('Invalid building type');
    }
    
    await getUserBuildings(userId);
    
    await run(
        `UPDATE userBuildings SET ${column} = ? WHERE userId = ?`,
        [level, userId]
    );
    
    debugLog('BUILDINGS', `Set ${buildingType} to level ${level} for user ${userId}`);
}

module.exports = {
    initializeBuildingTables,
    getUserBuildings,
    getBuildingLevel,
    upgradeBuilding,
    getBuildingLevels,
    resetAllBuildings,
    setBuildingLevel
};