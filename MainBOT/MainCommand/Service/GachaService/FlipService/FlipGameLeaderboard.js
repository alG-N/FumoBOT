const { all, get } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');
const { debugLog } = require('../../../Core/logger');

async function getTopPlayersByCurrency(currency, limit = 10) {
    debugLog('FLIP_LEADERBOARD', `Fetching top ${limit} players by ${currency}`);
    
    const rows = await all(
        `SELECT userId, ${currency}, wins, losses FROM userCoins 
         WHERE ${currency} > 0
         ORDER BY ${currency} DESC 
         LIMIT ?`,
        [limit]
    );
    
    return rows;
}

async function getTopPlayersByWins(limit = 10) {
    debugLog('FLIP_LEADERBOARD', `Fetching top ${limit} players by wins`);
    
    const rows = await all(
        `SELECT userId, wins, losses, coins, gems FROM userCoins 
         WHERE wins > 0
         ORDER BY wins DESC 
         LIMIT ?`,
        [limit]
    );
    
    return rows;
}

async function getTopPlayersByWinRate(limit = 10, minGames = 50) {
    debugLog('FLIP_LEADERBOARD', `Fetching top ${limit} players by win rate (min ${minGames} games)`);
    
    const rows = await all(
        `SELECT 
            userId, 
            wins, 
            losses,
            coins,
            gems,
            (wins + losses) as totalGames,
            CAST(wins AS FLOAT) / (wins + losses) * 100 as winRate
         FROM userCoins 
         WHERE (wins + losses) >= ?
         ORDER BY winRate DESC 
         LIMIT ?`,
        [minGames, limit]
    );
    
    return rows;
}

async function getTopPlayersByGames(limit = 10) {
    debugLog('FLIP_LEADERBOARD', `Fetching top ${limit} players by total games`);
    
    const rows = await all(
        `SELECT 
            userId, 
            wins, 
            losses,
            coins,
            gems,
            (wins + losses) as totalGames
         FROM userCoins 
         WHERE (wins + losses) > 0
         ORDER BY totalGames DESC 
         LIMIT ?`,
        [limit]
    );
    
    return rows;
}

async function getUserRank(userId, category = 'coins') {
    debugLog('FLIP_LEADERBOARD', `Getting rank for user ${userId} in ${category}`);
    
    // First check if user exists and has the required data
    const userCheck = await get(
        `SELECT userId, coins, gems, wins, losses FROM userCoins WHERE userId = ?`,
        [userId]
    );
    
    if (!userCheck) {
        return null;
    }
    
    let query;
    let params;
    
    switch (category) {
        case 'coins':
        case 'gems':
            // Check if user has any of this currency
            if (userCheck[category] <= 0) {
                return null;
            }
            
            query = `
                SELECT COUNT(*) + 1 as rank
                FROM userCoins
                WHERE ${category} > (
                    SELECT ${category} FROM userCoins WHERE userId = ?
                )
            `;
            params = [userId];
            break;
            
        case 'wins':
            // Check if user has any wins
            if (userCheck.wins <= 0) {
                return null;
            }
            
            query = `
                SELECT COUNT(*) + 1 as rank
                FROM userCoins
                WHERE wins > (
                    SELECT wins FROM userCoins WHERE userId = ?
                )
            `;
            params = [userId];
            break;
            
        case 'winrate':
            // Check if user has enough games
            const totalGamesWinrate = userCheck.wins + userCheck.losses;
            if (totalGamesWinrate < 50) {
                return null;
            }
            
            query = `
                SELECT COUNT(*) + 1 as rank
                FROM userCoins
                WHERE (wins + losses) >= 50
                AND CAST(wins AS FLOAT) / (wins + losses) > (
                    SELECT CAST(wins AS FLOAT) / (wins + losses)
                    FROM userCoins 
                    WHERE userId = ?
                )
            `;
            params = [userId];
            break;
            
        case 'games':
            // Check if user has any games
            const totalGamesPlayed = userCheck.wins + userCheck.losses;
            if (totalGamesPlayed <= 0) {
                return null;
            }
            
            query = `
                SELECT COUNT(*) + 1 as rank
                FROM userCoins
                WHERE (wins + losses) > (
                    SELECT (wins + losses) FROM userCoins WHERE userId = ?
                )
            `;
            params = [userId];
            break;
            
        default:
            return null;
    }
    
    const result = await all(query, params);
    return result[0]?.rank || null;
}

async function formatLeaderboardData(client, rows, category) {
    const entries = [];
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rank = i + 1;
        
        let userTag = 'Unknown User';
        try {
            const user = await client.users.fetch(row.userId);
            userTag = user.tag;
        } catch (err) {
            userTag = `User ${row.userId.slice(0, 8)}`;
        }
        
        let value;
        switch (category) {
            case 'coins':
            case 'gems':
                value = `${formatNumber(row[category])} ${category}`;
                break;
            case 'wins':
                value = `${formatNumber(row.wins)} wins (${formatNumber(row.losses)} losses)`;
                break;
            case 'winrate':
                value = `${row.winRate.toFixed(2)}% (${row.totalGames} games)`;
                break;
            case 'games':
                value = `${formatNumber(row.totalGames)} games (W: ${formatNumber(row.wins)} / L: ${formatNumber(row.losses)})`;
                break;
            default:
                value = 'N/A';
        }
        
        entries.push({
            rank,
            userTag,
            userId: row.userId,
            value,
            rawData: row
        });
    }
    
    return entries;
}

module.exports = {
    getTopPlayersByCurrency,
    getTopPlayersByWins,
    getTopPlayersByWinRate,
    getTopPlayersByGames,
    getUserRank,
    formatLeaderboardData
};