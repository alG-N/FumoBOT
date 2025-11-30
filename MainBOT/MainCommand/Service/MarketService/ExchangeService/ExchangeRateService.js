const { get, run } = require('../../../Core/database');
const { debugLog } = require('../../../Core/logger');

const EXCHANGE_RATE_ID = 1;
const DEFAULT_RATE = 10.0;

const TAX_BRACKETS = [
    { limit: 10_000, rate: 0.05 },
    { limit: 100_000, rate: 0.15 },
    { limit: 1_000_000, rate: 0.25 },
    { limit: 10_000_000, rate: 0.33 },
    { limit: Infinity, rate: 0.45 }
];

function getTaxRate(amount) {
    for (const bracket of TAX_BRACKETS) {
        if (amount <= bracket.limit) {
            return bracket.rate;
        }
    }
    return TAX_BRACKETS[TAX_BRACKETS.length - 1].rate;
}

async function getExchangeRate() {
    const row = await get(
        'SELECT coinToGem FROM exchangeRate WHERE id = ?',
        [EXCHANGE_RATE_ID]
    );

    if (!row) {
        await run(
            'INSERT INTO exchangeRate (id, coinToGem) VALUES (?, ?)',
            [EXCHANGE_RATE_ID, DEFAULT_RATE]
        );
        return DEFAULT_RATE;
    }

    return row.coinToGem || DEFAULT_RATE;
}

async function updateExchangeRate(newRate) {
    await run(
        'UPDATE exchangeRate SET coinToGem = ? WHERE id = ?',
        [newRate, EXCHANGE_RATE_ID]
    );

    debugLog('EXCHANGE', `Updated exchange rate to ${newRate}`);
    return newRate;
}

function calculateExchange(type, amount, rate) {
    const taxRate = getTaxRate(amount);
    const taxedAmount = Math.floor(amount * (1 - taxRate));

    let result;
    if (type === 'coins') {
        result = Math.floor(taxedAmount / rate);
    } else {
        result = Math.floor(taxedAmount * rate);
    }

    return {
        taxedAmount,
        result,
        taxRate
    };
}

function previewExchange(type, amount, rate) {
    const { taxedAmount, result, taxRate } = calculateExchange(type, amount, rate);
    
    return {
        originalAmount: amount,
        taxAmount: amount - taxedAmount,
        taxRate,
        taxedAmount,
        result,
        targetType: type === 'coins' ? 'gems' : 'coins'
    };
}

module.exports = {
    getExchangeRate,
    updateExchangeRate,
    getTaxRate,
    calculateExchange,
    previewExchange,
    EXCHANGE_RATE_ID,
    DEFAULT_RATE,
    TAX_BRACKETS
};