const { getUserBalance, updateUserBalance } = require('./mysteryCrateStorageService');
const { 
    getTierByBet, 
    rollCrateOutcome, 
    checkSpecialEvent, 
    calculateReward,
    getComboBonus,
    validateBetAmount
} = require('../../../Configuration/mysteryCrateConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');

async function validateCrateRequest(userId, numCrates, betAmount, currency) {
    try {
        const balance = await getUserBalance(userId, currency);
        
        if (balance === null) {
            return {
                success: false,
                error: 'NO_ACCOUNT',
                currency
            };
        }
        
        const tier = getTierByBet(betAmount, currency);
        const validation = validateBetAmount(betAmount, tier);
        
        if (!validation.valid) {
            return {
                success: false,
                error: 'BELOW_MINIMUM',
                minBet: validation.minBet,
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
            balance,
            tier
        };
    } catch (error) {
        console.error('[Mystery Crate] Validation error:', error);
        return {
            success: false,
            error: 'DATABASE_ERROR'
        };
    }
}

async function executeCrateGame(userId, numCrates, betAmount, currency, balance) {
    try {
        const tier = getTierByBet(betAmount, currency);
        const specialEvent = checkSpecialEvent();
        
        const crateResults = [];
        for (let i = 0; i < numCrates; i++) {
            const outcome = rollCrateOutcome(tier);
            crateResults.push({
                outcome,
                index: i
            });
        }
        
        return {
            success: true,
            tier,
            crateResults,
            specialEvent: specialEvent.triggered ? specialEvent : null,
            betAmount,
            currency,
            numCrates
        };
    } catch (error) {
        console.error('[Mystery Crate] Game execution error:', error);
        return {
            success: false,
            error: 'GAME_ERROR'
        };
    }
}

async function processCrateSelection(userId, selectedIndex, crateResults, betAmount, currency, balance, sessionData = {}) {
    try {
        const selectedCrate = crateResults[selectedIndex];
        const { outcome, specialEvent } = selectedCrate;
        
        const comboBonus = getComboBonus(sessionData.winStreak || 0);
        const comboMult = comboBonus?.active ? comboBonus.multiplier : 1;
        
        const reward = calculateReward(betAmount, outcome, specialEvent, comboMult);
        
        let netChange = reward.netChange;
        
        if (specialEvent?.effect === 'cursed_crate' && outcome.multiplier === 0) {
            netChange = -balance;
        }
        
        await updateUserBalance(userId, currency, netChange);
        
        try {
            incrementDailyGamble(userId);
        } catch (err) {
            console.error('[Mystery Crate] Quest update error:', err);
        }
        
        const newBalance = balance + netChange;
        const won = netChange > 0;
        const newWinStreak = won ? (sessionData.winStreak || 0) + 1 : 0;
        
        return {
            success: true,
            selectedCrate,
            reward,
            netChange,
            newBalance,
            won,
            newWinStreak,
            comboBonus: comboBonus.active ? comboBonus : null,
            cursedTriggered: specialEvent?.effect === 'cursed_crate' && outcome.multiplier === 0
        };
    } catch (error) {
        console.error('[Mystery Crate] Selection processing error:', error);
        return {
            success: false,
            error: 'PROCESSING_ERROR'
        };
    }
}

function generateSessionStats(sessionData) {
    const { games = [], winStreak = 0, totalWon = 0, totalLost = 0, biggestWin = 0 } = sessionData;
    
    const totalGames = games.length;
    const wins = games.filter(g => g.won).length;
    const losses = totalGames - wins;
    const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : 0;
    const netProfit = totalWon - totalLost;
    
    return {
        totalGames,
        wins,
        losses,
        winRate,
        currentStreak: winStreak,
        netProfit,
        totalWon,
        totalLost,
        biggestWin
    };
}

module.exports = {
    validateCrateRequest,
    executeCrateGame,
    processCrateSelection,
    generateSessionStats
};