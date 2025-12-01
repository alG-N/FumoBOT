const { get, run } = require('../../../Core/database');
const { SLOT_CONFIG, isValidCurrency, getMinBet } = require('../../../Configuration/slotConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');
const { parseBet } = require('../../../Ultility/formatting');
const { debugLog } = require('../../../Core/logger');

async function getUserBalance(userId) {
    return await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );
}

async function updateUserBalance(userId, currency, amount) {
    await run(
        `UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`,
        [amount, userId]
    );
}

function spinReels() {
    return Array.from({ length: 3 }, () =>
        SLOT_CONFIG.reels[Math.floor(Math.random() * SLOT_CONFIG.reels.length)]
    );
}

function calculateWinInfo(spinResult) {
    const [s1, s2, s3] = spinResult;
    const allMatch = s1 === s2 && s2 === s3;
    const twoMatch = s1 === s2 || s2 === s3 || s1 === s3;

    if (allMatch) return SLOT_CONFIG.payouts[s1];
    if (twoMatch) return SLOT_CONFIG.twoMatch;
    return SLOT_CONFIG.noMatch;
}

async function validateSlotRequest(userId, currency, bet) {
    if (!isValidCurrency(currency)) {
        return { 
            valid: false, 
            error: 'INVALID_CURRENCY',
            message: 'Invalid currency. Use `coins` or `gems`.'
        };
    }

    if (isNaN(bet) || bet <= 0) {
        return { 
            valid: false, 
            error: 'INVALID_BET',
            message: 'Your bet must be a positive number.'
        };
    }

    const userRow = await getUserBalance(userId);

    if (!userRow) {
        return { 
            valid: false, 
            error: 'NO_ACCOUNT',
            message: 'You do not have an account yet. Please register first.'
        };
    }

    const minBet = getMinBet(currency);
    if (userRow[currency] < minBet) {
        return { 
            valid: false, 
            error: 'BELOW_MINIMUM',
            message: `You need at least ${minBet.toLocaleString()} ${currency} to play.`,
            minBet
        };
    }

    if (userRow[currency] < bet) {
        return { 
            valid: false, 
            error: 'INSUFFICIENT_BALANCE',
            message: `Not enough ${currency} for this bet. Try a smaller amount.`
        };
    }

    return { valid: true, userRow };
}

async function performSlotSpin(userId, currency, bet, autoSpinCount = 1) {
    debugLog('SLOT', `${autoSpinCount}x spin for user ${userId}: ${bet} ${currency}`);

    const validation = await validateSlotRequest(userId, currency, bet);
    if (!validation.valid) {
        return validation;
    }

    await updateUserBalance(userId, currency, -bet);
    
    try {
        await incrementDailyGamble(userId);
    } catch (err) {
        debugLog('SLOT', `Gamble increment error: ${err.message}`);
    }

    let totalWin = 0;
    let totalBet = bet;
    let lastResult = null;
    let spinResults = []; 

    for (let spin = 0; spin < autoSpinCount; spin++) {
        if (spin > 0) {
            const checkBalance = await getUserBalance(userId);
            
            if (!checkBalance || checkBalance[currency] < bet) {
                debugLog('SLOT', `Auto-spin stopped at spin ${spin + 1}: insufficient funds`);
                break;
            }
            
            await updateUserBalance(userId, currency, -bet);
            totalBet += bet;
        }

        const spinResult = spinReels();
        const winInfo = calculateWinInfo(spinResult);
        const winAmount = Math.floor(bet * winInfo.multiplier);
        totalWin += winAmount;
        
        lastResult = { spinResult, winInfo, winAmount };
        spinResults.push(lastResult);

        if (winAmount > 0) {
            await updateUserBalance(userId, currency, winAmount);
        }

        debugLog('SLOT', `Spin ${spin + 1}: ${spinResult.join('-')} | Win: ${winAmount} ${currency}`);
    }

    const netProfit = totalWin - totalBet;

    return {
        success: true,
        spinResult: lastResult.spinResult,
        winInfo: lastResult.winInfo,
        totalWin,
        totalBet,
        netProfit,
        spinsCompleted: spinResults.length,
        bet,
        currency
    };
}

module.exports = {
    getUserBalance,
    updateUserBalance,
    spinReels,
    calculateWinInfo,
    validateSlotRequest,
    performSlotSpin
};