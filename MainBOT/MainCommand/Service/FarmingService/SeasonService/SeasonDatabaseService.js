const { get, all, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

async function initializeSeasonTables() {
    await run(`
        CREATE TABLE IF NOT EXISTS activeSeasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            seasonType TEXT NOT NULL,
            startedAt INTEGER NOT NULL,
            expiresAt INTEGER,
            isActive INTEGER DEFAULT 1
        )
    `);
    
    debugLog('SEASONS', 'Season tables initialized');
}

async function getActiveSeasons() {
    const now = Date.now();
    return await all(
        `SELECT * FROM activeSeasons 
         WHERE isActive = 1 AND (expiresAt IS NULL OR expiresAt > ?)`,
        [now]
    );
}

async function startSeason(seasonType, duration = null) {
    const now = Date.now();
    const expiresAt = duration ? now + duration : null;
    
    await run(
        `INSERT INTO activeSeasons (seasonType, startedAt, expiresAt, isActive)
         VALUES (?, ?, ?, 1)`,
        [seasonType, now, expiresAt]
    );
    
    debugLog('SEASONS', `Started season: ${seasonType}${duration ? ` (expires in ${duration}ms)` : ''}`);
}

async function endSeason(seasonType) {
    await run(
        `UPDATE activeSeasons 
         SET isActive = 0 
         WHERE seasonType = ? AND isActive = 1`,
        [seasonType]
    );
    
    debugLog('SEASONS', `Ended season: ${seasonType}`);
}

async function cleanExpiredSeasons() {
    const now = Date.now();
    const result = await run(
        `UPDATE activeSeasons 
         SET isActive = 0 
         WHERE expiresAt IS NOT NULL AND expiresAt <= ? AND isActive = 1`,
        [now]
    );
    
    if (result.changes > 0) {
        debugLog('SEASONS', `Cleaned ${result.changes} expired seasons`);
    }
    
    return result.changes;
}

async function isSeasonActive(seasonType) {
    const now = Date.now();
    const row = await get(
        `SELECT 1 FROM activeSeasons 
         WHERE seasonType = ? AND isActive = 1 
         AND (expiresAt IS NULL OR expiresAt > ?)`,
        [seasonType, now]
    );
    
    return !!row;
}

async function getSeasonTimeRemaining(seasonType) {
    const now = Date.now();
    const row = await get(
        `SELECT expiresAt FROM activeSeasons 
         WHERE seasonType = ? AND isActive = 1`,
        [seasonType]
    );
    
    if (!row || !row.expiresAt) return null;
    
    const remaining = row.expiresAt - now;
    return remaining > 0 ? remaining : 0;
}

async function getActiveSeasonTypes() {
    const seasons = await getActiveSeasons();
    return seasons.map(s => s.seasonType);
}

async function endAllSeasons() {
    await run(`UPDATE activeSeasons SET isActive = 0 WHERE isActive = 1`);
    debugLog('SEASONS', 'Ended all active seasons');
}

module.exports = {
    initializeSeasonTables,
    getActiveSeasons,
    startSeason,
    endSeason,
    cleanExpiredSeasons,
    isSeasonActive,
    getSeasonTimeRemaining,
    getActiveSeasonTypes,
    endAllSeasons
};