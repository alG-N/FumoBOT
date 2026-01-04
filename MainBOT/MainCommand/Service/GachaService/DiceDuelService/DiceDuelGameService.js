const { getUserBalance, updateUserBalance } = require('./diceDuelStorageService');
const { getDiceResult } = require('../../../Configuration/diceDuelConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');
const QuestMiddleware = require('../../../Middleware/questMiddleware');

async function validateDiceRequest(userId, betAmount, currency) {
    try {
        const balance = await getUserBalance(userId, currency);
        
        if (balance === null) {
            return {
                success: false,
                error: 'NO_ACCOUNT',
                currency
            };
        }
        
        if (balance < betAmount) {
            return {
                success: false,
                error: 'INSUFFICIENT_BALANCE',
                balance,
                required: betAmount,
                currency
            };
        }
        
        return {
            success: true,
            balance
        };
    } catch (error) {
        console.error('[Dice Duel] Validation error:', error);
        return {
            success: false,
            error: 'DATABASE_ERROR'
        };
    }
}

async function executeDiceGame(userId, mode, betAmount, currency, balance) {
    try {
        const result = getDiceResult(mode, betAmount);
        
        return {
            success: true,
            result,
            mode,
            betAmount,
            currency
        };
    } catch (error) {
        console.error('[Dice Duel] Game execution error:', error);
        return {
            success: false,
            error: 'GAME_ERROR'
        };
    }
}

async function processDiceResult(userId, result, betAmount, currency, balance) {
    try {
        await updateUserBalance(userId, currency, result.netChange);
        
        try {
            incrementDailyGamble(userId);
        } catch (err) {
            console.error('[Dice Duel] Quest update error:', err);
        }

        // Track for quest progress
        try {
            await QuestMiddleware.trackGamble(userId);
            
            // Track win and coins/gems earned
            if (result.netChange > 0) {
                await QuestMiddleware.trackGambleWin(userId, result.netChange);
                
                if (currency === 'coins') {
                    await QuestMiddleware.trackCoinsEarned(userId, result.netChange);
                } else if (currency === 'gems') {
                    await QuestMiddleware.trackGemsEarned(userId, result.netChange);
                }
            }
        } catch (err) {
            console.error('[Dice Duel] Quest tracking error:', err);
        }
        
        const newBalance = balance + result.netChange;
        
        return {
            success: true,
            result,
            netChange: result.netChange,
            newBalance
        };
    } catch (error) {
        console.error('[Dice Duel] Processing error:', error);
        return {
            success: false,
            error: 'PROCESSING_ERROR'
        };
    }
}

module.exports = {
    validateDiceRequest,
    executeDiceGame,
    processDiceResult
};