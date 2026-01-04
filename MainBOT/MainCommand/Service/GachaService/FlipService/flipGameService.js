const { get, run } = require('../../../Core/database');
const { 
    MULTIPLIERS, 
    WIN_PROBABILITY,
    getMultiplierConfig,
    getMinBet,
    getMaxBet
} = require('../../../Configuration/flipConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');
const { debugLog } = require('../../../Core/logger');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

async function getOrCreateUser(userId) {
    debugLog('FLIP', `Getting user data for ${userId}`);
    
    let user = await get(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
    
    if (!user) {
        // OPTIMIZED: Use INSERT with ON CONFLICT to avoid double query
        await run(
            `INSERT INTO userCoins (userId, coins, gems, wins, losses, joinDate) 
             VALUES (?, 0, 0, 0, 0, ?)
             ON CONFLICT(userId) DO NOTHING`,
            [userId, new Date().toISOString()]
        );
        // Only query again if we actually needed to create
        user = await get(`SELECT * FROM userCoins WHERE userId = ?`, [userId]);
    }
    
    return user;
}

function validateBet(betAmount, balance, currency) {
    const minBet = getMinBet(currency);
    const maxBet = getMaxBet(currency);
    
    if (isNaN(betAmount) || betAmount <= 0) {
        return { valid: false, error: 'INVALID_AMOUNT' };
    }
    
    if (betAmount < minBet) {
        return { valid: false, error: 'BELOW_MINIMUM', minBet };
    }
    
    if (maxBet && betAmount > maxBet) {
        return { valid: false, error: 'ABOVE_MAXIMUM', maxBet };
    }
    
    if (balance < betAmount) {
        return { valid: false, error: 'INSUFFICIENT_BALANCE' };
    }
    
    return { valid: true };
}

function performFlip() {
    return Math.random() < WIN_PROBABILITY ? 'heads' : 'tails';
}

function calculateAmount(bet, multiplier, isWin) {
    const config = getMultiplierConfig(multiplier);
    if (!config) return 0;
    
    return Math.floor(bet * (isWin ? config.win : config.loss));
}

async function updateUserAfterFlip(userId, currency, amount, won) {
    debugLog('FLIP', `Updating user ${userId}: ${won ? 'won' : 'lost'} ${amount} ${currency}`);
    
    const statField = won ? 'wins' : 'losses';
    
    await run(
        `UPDATE userCoins SET 
            ${currency} = CASE 
                WHEN ? THEN ${currency} + ?
                ELSE MAX(0, ${currency} - ?)
            END,
            ${statField} = ${statField} + 1
        WHERE userId = ?`,
        [won, amount, amount, userId]
    );
}


async function executeSingleFlip(userId, choice, currency, bet, multiplier) {
    debugLog('FLIP', `Executing flip for ${userId}: ${choice} ${currency} ${bet} x${multiplier}`);
    
    const user = await getOrCreateUser(userId);
    
    const validation = validateBet(bet, user[currency], currency);
    if (!validation.valid) {
        return { success: false, error: validation.error, ...validation };
    }
    
    const result = performFlip();
    const won = result === choice.toLowerCase();
    
    const amount = calculateAmount(bet, multiplier, won);
    
    await updateUserAfterFlip(userId, currency, amount, won);
    
    if (typeof incrementDailyGamble === 'function') {
        try {
            incrementDailyGamble(userId);
        } catch (err) {
        }
    }
    
    // Track for quest progress
    try {
        await QuestMiddleware.trackGamble(userId);
        
        // Track win for quest progress
        if (won) {
            await QuestMiddleware.trackGambleWin(userId, amount);
            
            // Track coins/gems earned
            if (currency === 'coins') {
                await QuestMiddleware.trackCoinsEarned(userId, amount);
            } else if (currency === 'gems') {
                await QuestMiddleware.trackGemsEarned(userId, amount);
            }
        }
    } catch (err) {
        debugLog('FLIP', `Quest tracking error: ${err.message}`);
    }
    
    const updatedUser = await get(`SELECT ${currency}, wins, losses FROM userCoins WHERE userId = ?`, [userId]);
    
    return {
        success: true,
        won,
        result,
        choice: choice.toLowerCase(),
        amount,
        balance: updatedUser[currency],
        stats: {
            wins: updatedUser.wins,
            losses: updatedUser.losses
        }
    };
}

async function executeBatchFlips(userId, choice, currency, bet, multiplier, count) {
    debugLog('FLIP', `Executing ${count} flips for ${userId}`);
    
    const user = await getOrCreateUser(userId);
    const totalBet = bet * count;
    
    const validation = validateBet(totalBet, user[currency], currency);
    if (!validation.valid) {
        return { success: false, error: validation.error, ...validation };
    }
    
    let totalWon = 0;
    let totalLost = 0;
    let winCount = 0;
    let lossCount = 0;
    const results = [];
    
    for (let i = 0; i < count; i++) {
        const result = performFlip();
        const won = result === choice.toLowerCase();
        const amount = calculateAmount(bet, multiplier, won);
        
        results.push({ result, won, amount });
        
        if (won) {
            totalWon += amount;
            winCount++;
        } else {
            totalLost += amount;
            lossCount++;
        }
    }
    
    const netChange = totalWon - totalLost;
    const newBalance = Math.max(0, user[currency] + netChange);
    
    await run(
        `UPDATE userCoins SET 
            ${currency} = ?,
            wins = wins + ?,
            losses = losses + ?
        WHERE userId = ?`,
        [newBalance, winCount, lossCount, userId]
    );
    
    if (typeof incrementDailyGamble === 'function') {
        try {
            for (let i = 0; i < count; i++) {
                incrementDailyGamble(userId);
            }
        } catch (err) {
        }
    }
    
    // Track for quest progress (batch)
    try {
        for (let i = 0; i < count; i++) {
            await QuestMiddleware.trackGamble(userId);
        }
        
        // Track wins for quest progress
        if (winCount > 0) {
            for (let i = 0; i < winCount; i++) {
                await QuestMiddleware.trackGambleWin(userId, 0);
            }
        }
        
        // Track net coins/gems earned (if positive)
        if (netChange > 0) {
            if (currency === 'coins') {
                await QuestMiddleware.trackCoinsEarned(userId, netChange);
            } else if (currency === 'gems') {
                await QuestMiddleware.trackGemsEarned(userId, netChange);
            }
        }
    } catch (err) {
        debugLog('FLIP', `Quest tracking error: ${err.message}`);
    }
    
    return {
        success: true,
        count,
        results,
        winCount,
        lossCount,
        totalWon,
        totalLost,
        netChange,
        balance: newBalance
    };
}

async function getUserFlipStats(userId) {
    const user = await getOrCreateUser(userId);
    
    const totalGames = user.wins + user.losses;
    const winRate = totalGames > 0 ? ((user.wins / totalGames) * 100).toFixed(2) : '0.00';
    
    return {
        coins: user.coins,
        gems: user.gems,
        wins: user.wins,
        losses: user.losses,
        totalGames,
        winRate
    };
}

module.exports = {
    getOrCreateUser,
    validateBet,
    performFlip,
    calculateAmount,
    updateUserAfterFlip,
    executeSingleFlip,
    executeBatchFlips,
    getUserFlipStats
};