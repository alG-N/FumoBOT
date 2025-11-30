const { get } = require('../../../Core/database');
const { formatNumber } = require('../../../Ultility/formatting');

const MIN_EXCHANGE = 10;
const MAX_EXCHANGES_PER_DAY = 5;
const VALID_TYPES = ['coins', 'gems'];

function validateType(type) {
    if (!VALID_TYPES.includes(type)) {
        return {
            valid: false,
            message: '❌ **Invalid type.** Use either `coins` or `gems`.'
        };
    }
    return { valid: true };
}

function validateAmount(amount, userBalance) {
    if (!isFinite(amount) || amount <= 0) {
        return {
            valid: false,
            message: '❌ **Invalid amount.** Please enter a positive number or `all`.'
        };
    }

    if (amount > userBalance) {
        return {
            valid: false,
            message: `❌ You don't have enough. Your balance: **${formatNumber(userBalance)}**.`
        };
    }

    if (amount < MIN_EXCHANGE) {
        return {
            valid: false,
            message: `❌ Minimum exchange amount is **${MIN_EXCHANGE}**.`
        };
    }

    return { valid: true };
}

async function validateExchangeRequest(userId, type, amount, userBalance) {
    const typeValidation = validateType(type);
    if (!typeValidation.valid) return typeValidation;

    const amountValidation = validateAmount(amount, userBalance);
    if (!amountValidation.valid) return amountValidation;

    return { valid: true };
}

async function checkDailyLimit(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    const row = await get(
        'SELECT count FROM userExchangeLimits WHERE userId = ? AND date = ?',
        [userId, today]
    );

    const usedCount = row?.count || 0;
    const remaining = MAX_EXCHANGES_PER_DAY - usedCount;

    if (remaining <= 0) {
        const now = new Date();
        const resetTime = new Date();
        resetTime.setUTCDate(resetTime.getUTCDate() + 1);
        resetTime.setUTCHours(0, 0, 0, 0);
        const hoursUntilReset = Math.ceil((resetTime - now) / (1000 * 60 * 60));

        return {
            canExchange: false,
            remaining: 0,
            message: `❌ You have reached your **daily limit of ${MAX_EXCHANGES_PER_DAY} exchanges**.\n⏳ Limit resets in **${hoursUntilReset} hour(s)** (at 00:00 UTC).`
        };
    }

    return {
        canExchange: true,
        remaining,
        usedCount
    };
}

function getResetTimeText() {
    const now = new Date();
    const resetTime = new Date();
    resetTime.setUTCDate(resetTime.getUTCDate() + 1);
    resetTime.setUTCHours(0, 0, 0, 0);
    return Math.ceil((resetTime - now) / (1000 * 60 * 60));
}

module.exports = {
    validateExchangeRequest,
    validateType,
    validateAmount,
    checkDailyLimit,
    getResetTimeText,
    MIN_EXCHANGE,
    MAX_EXCHANGES_PER_DAY
};