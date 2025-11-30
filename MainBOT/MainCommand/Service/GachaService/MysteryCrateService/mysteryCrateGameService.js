const { getUserBalance, updateUserBalance } = require('../MysteryCrateService/mysteryCrateStorageService');
const { getCrateOutcome, calculateReward } = require('../../../Configuration/mysteryCrateConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');

function generateCrateResults(numCrates, betAmount) {
    const results = [];
    
    for (let i = 0; i < numCrates; i++) {
        const outcome = getCrateOutcome();
        const { reward, netChange } = calculateReward(betAmount, outcome.multiplier, 0);
        
        results.push({
            outcome,
            reward,
            netChange,
            description: outcome.text,
            emoji: outcome.emoji
        });
    }
    
    return results;
}

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
        console.error('[Mystery Crate] Validation error:', error);
        return {
            success: false,
            error: 'DATABASE_ERROR'
        };
    }
}

async function executeCrateGame(userId, numCrates, betAmount, currency, balance) {
    try {
        const crateResults = generateCrateResults(numCrates, betAmount);
        
        for (let i = 0; i < crateResults.length; i++) {
            const result = crateResults[i];
            if (result.outcome.multiplier === -1) {
                result.netChange = -balance;
            }
        }
        
        return {
            success: true,
            crateResults,
            numCrates,
            betAmount,
            currency
        };
    } catch (error) {
        console.error('[Mystery Crate] Game execution error:', error);
        return {
            success: false,
            error: 'GAME_ERROR'
        };
    }
}

async function processCrateSelection(userId, selectedIndex, crateResults, betAmount, currency, balance) {
    try {
        const selectedCrate = crateResults[selectedIndex];
        let netReward = selectedCrate.netChange;
        
        if (selectedCrate.outcome.multiplier === -1) {
            netReward = -balance;
        }
        
        await updateUserBalance(userId, currency, netReward);
        
        try {
            incrementDailyGamble(userId);
        } catch (err) {
            console.error('[Mystery Crate] Quest update error:', err);
        }
        
        const newBalance = balance + netReward;
        
        return {
            success: true,
            selectedCrate,
            netReward,
            newBalance
        };
    } catch (error) {
        console.error('[Mystery Crate] Selection processing error:', error);
        return {
            success: false,
            error: 'PROCESSING_ERROR'
        };
    }
}

module.exports = {
    generateCrateResults,
    validateCrateRequest,
    executeCrateGame,
    processCrateSelection
};