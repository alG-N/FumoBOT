const { get, run } = require('../../../Core/database');
const { doesCounter, validateBet, GAMBLE_CONFIG } = require('../../../Configuration/gambleConfig');
const { incrementDailyGamble } = require('../../../Ultility/weekly');

async function validateGambleRequest(user1Id, user2Id, currency, amount) {
    const betValidation = validateBet(currency, amount);
    if (!betValidation.valid) {
        return betValidation;
    }

    const [user1, user2] = await Promise.all([
        get('SELECT userId, coins, gems FROM userCoins WHERE userId = ?', [user1Id]),
        get('SELECT userId, coins, gems FROM userCoins WHERE userId = ?', [user2Id])
    ]);

    if (!user1 || !user2) {
        return { 
            success: false, 
            error: 'USER_NOT_FOUND',
            message: 'One or both users do not have an account. Please register first.' 
        };
    }

    if (user1[currency] < amount) {
        return { 
            success: false, 
            error: 'INSUFFICIENT_BALANCE_USER1',
            message: `You don't have enough ${currency}. Required: ${amount}, Available: ${user1[currency]}` 
        };
    }

    if (user2[currency] < amount) {
        return { 
            success: false, 
            error: 'INSUFFICIENT_BALANCE_USER2',
            message: `Your opponent doesn't have enough ${currency}. Required: ${amount}, Available: ${user2[currency]}` 
        };
    }

    return { success: true };
}

async function determineWinner(user1Id, user2Id, card1, card2, currency, amount) {
    if (!card1 && !card2) {
        return {
            outcome: 'NO_SELECTION',
            winner: null,
            loser: null,
            card1: null,
            card2: null
        };
    }

    if (!card1 || !card2) {
        const winner = card1 ? user1Id : user2Id;
        const loser = card1 ? user2Id : user1Id;
        const selectedCard = card1 || card2;

        await updateBalances(winner, loser, currency, amount);
        await incrementBothQuests(winner, loser);

        return {
            outcome: 'DEFAULT_WIN',
            winner,
            loser,
            card1: card1 || null,
            card2: card2 || null,
            amount
        };
    }

    if (card1 === card2) {
        const penalty = Math.floor(amount * GAMBLE_CONFIG.SAME_CARD_PENALTY);
        await updateBalancesPenalty(user1Id, user2Id, currency, penalty);
        await incrementBothQuests(user1Id, user2Id);

        return {
            outcome: 'SAME_CARD',
            card1,
            card2,
            penalty
        };
    }

    const user1Counters = doesCounter(card1, card2);
    const user2Counters = doesCounter(card2, card1);

    if (user1Counters && !user2Counters) {
        await updateBalances(user1Id, user2Id, currency, amount);
        await incrementBothQuests(user1Id, user2Id);

        return {
            outcome: 'USER1_WIN',
            winner: user1Id,
            loser: user2Id,
            card1,
            card2,
            amount
        };
    }

    if (user2Counters && !user1Counters) {
        await updateBalances(user2Id, user1Id, currency, amount);
        await incrementBothQuests(user1Id, user2Id);

        return {
            outcome: 'USER2_WIN',
            winner: user2Id,
            loser: user1Id,
            card1,
            card2,
            amount
        };
    }

    return {
        outcome: 'DRAW',
        card1,
        card2
    };
}

async function updateBalances(winnerId, loserId, currency, amount) {
    await Promise.all([
        run(
            `UPDATE userCoins SET ${currency} = ${currency} + ? WHERE userId = ?`,
            [amount, winnerId]
        ),
        run(
            `UPDATE userCoins SET ${currency} = CASE 
                WHEN ${currency} >= ? THEN ${currency} - ?
                ELSE 0
            END WHERE userId = ?`,
            [amount, amount, loserId]
        )
    ]);
}

async function updateBalancesPenalty(user1Id, user2Id, currency, penalty) {
    await Promise.all([
        run(
            `UPDATE userCoins SET ${currency} = CASE 
                WHEN ${currency} >= ? THEN ${currency} - ?
                ELSE 0
            END WHERE userId = ?`,
            [penalty, penalty, user1Id]
        ),
        run(
            `UPDATE userCoins SET ${currency} = CASE 
                WHEN ${currency} >= ? THEN ${currency} - ?
                ELSE 0
            END WHERE userId = ?`,
            [penalty, penalty, user2Id]
        )
    ]);
}

async function incrementBothQuests(user1Id, user2Id) {
    try {
        await Promise.all([
            incrementDailyGamble(user1Id),
            incrementDailyGamble(user2Id)
        ]);
    } catch (error) {
        console.error('Error incrementing gamble quests:', error);
    }
}

module.exports = {
    validateGambleRequest,
    determineWinner,
    updateBalances,
    updateBalancesPenalty
};