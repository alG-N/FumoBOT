const { get } = require('../../Core/database');
const { debugLog } = require('../../Core/logger');
const {
    COIN_WEALTH_TIERS,
    GEM_WEALTH_TIERS,
    WEALTH_PERCENT_RATES,
    MAX_WEALTH_CAPS,
    WEALTH_PRICING_ENABLED,
    MINIMUM_WEALTH_THRESHOLD
} = require('../../Configuration/wealthPricingConfig');

/**
 * Get user's current wealth (coins and gems)
 * @param {string} userId - User ID
 * @returns {Object} { coins: number, gems: number }
 */
async function getUserWealth(userId) {
    const row = await get(
        `SELECT coins, gems FROM userCoins WHERE userId = ?`,
        [userId]
    );
    return {
        coins: row?.coins || 0,
        gems: row?.gems || 0
    };
}

/**
 * Get wealth multiplier for a given wealth amount
 * @param {number} wealth - Current wealth amount
 * @param {string} currency - 'coins' or 'gems'
 * @returns {number} Multiplier (1.0 - 5.0)
 */
function getWealthMultiplier(wealth, currency) {
    const tiers = currency === 'gems' ? GEM_WEALTH_TIERS : COIN_WEALTH_TIERS;
    const wealthBigInt = BigInt(Math.floor(wealth));
    
    for (const tier of tiers) {
        if (wealthBigInt >= tier.threshold) {
            return tier.multiplier;
        }
    }
    return 1.0;
}

/**
 * Calculate wealth addition component
 * @param {number} basePrice - Original item price
 * @param {number} wealth - User's wealth in that currency
 * @param {string} currency - 'coins' or 'gems'
 * @returns {number} Amount to add to base price
 */
function calculateWealthAddition(basePrice, wealth, currency) {
    const minThreshold = MINIMUM_WEALTH_THRESHOLD[currency] || 0;
    
    // Grace period for smaller players
    if (wealth < minThreshold) {
        return 0;
    }
    
    const percentRate = WEALTH_PERCENT_RATES[currency] || 0.000001;
    const maxCap = MAX_WEALTH_CAPS[currency] || 10;
    
    // Calculate raw wealth addition
    const rawAddition = wealth * percentRate;
    
    // Cap at maxCap × basePrice
    const maxAddition = basePrice * maxCap;
    
    return Math.min(rawAddition, maxAddition);
}

/**
 * Calculate final price with wealth scaling
 * @param {number} basePrice - Original item price
 * @param {number} wealth - User's wealth in the relevant currency
 * @param {string} currency - 'coins' or 'gems'
 * @param {string} shopType - 'itemShop', 'coinMarket', 'gemMarket', 'eggShop', 'globalMarket'
 * @returns {Object} { finalPrice, multiplier, wealthAddition, breakdown }
 */
function calculateWealthPrice(basePrice, wealth, currency, shopType = 'itemShop') {
    // Check if wealth pricing is enabled for this shop
    if (!WEALTH_PRICING_ENABLED[shopType]) {
        return {
            finalPrice: basePrice,
            multiplier: 1.0,
            wealthAddition: 0,
            scaled: false,
            breakdown: null
        };
    }
    
    const wealthAddition = calculateWealthAddition(basePrice, wealth, currency);
    const multiplier = getWealthMultiplier(wealth, currency);
    
    const finalPrice = Math.ceil((basePrice + wealthAddition) * multiplier);
    
    return {
        finalPrice,
        multiplier,
        wealthAddition: Math.ceil(wealthAddition),
        scaled: multiplier > 1.0 || wealthAddition > 0,
        breakdown: {
            base: basePrice,
            addition: Math.ceil(wealthAddition),
            multiplier,
            final: finalPrice
        }
    };
}

/**
 * Calculate price for coin-based purchases
 * @param {string} userId - User ID
 * @param {number} basePrice - Original coin price
 * @param {string} shopType - Shop type identifier
 * @returns {Object} Price calculation result
 */
async function calculateCoinPrice(userId, basePrice, shopType = 'itemShop') {
    const wealth = await getUserWealth(userId);
    const result = calculateWealthPrice(basePrice, wealth.coins, 'coins', shopType);
    
    debugLog('WEALTH_PRICING', 
        `User ${userId} | Coins: ${wealth.coins.toLocaleString()} | ` +
        `Base: ${basePrice} → Final: ${result.finalPrice} (${result.multiplier}x)`
    );
    
    return result;
}

/**
 * Calculate price for gem-based purchases
 * @param {string} userId - User ID
 * @param {number} basePrice - Original gem price
 * @param {string} shopType - Shop type identifier
 * @returns {Object} Price calculation result
 */
async function calculateGemPrice(userId, basePrice, shopType = 'itemShop') {
    const wealth = await getUserWealth(userId);
    const result = calculateWealthPrice(basePrice, wealth.gems, 'gems', shopType);
    
    debugLog('WEALTH_PRICING',
        `User ${userId} | Gems: ${wealth.gems.toLocaleString()} | ` +
        `Base: ${basePrice} → Final: ${result.finalPrice} (${result.multiplier}x)`
    );
    
    return result;
}

/**
 * Calculate prices for items requiring both coins AND gems
 * @param {string} userId - User ID
 * @param {number} baseCoinPrice - Original coin price
 * @param {number} baseGemPrice - Original gem price
 * @param {string} shopType - Shop type identifier
 * @returns {Object} Combined price calculation
 */
async function calculateDualPrice(userId, baseCoinPrice, baseGemPrice, shopType = 'eggShop') {
    const wealth = await getUserWealth(userId);
    
    const coinResult = calculateWealthPrice(baseCoinPrice, wealth.coins, 'coins', shopType);
    const gemResult = calculateWealthPrice(baseGemPrice, wealth.gems, 'gems', shopType);
    
    debugLog('WEALTH_PRICING',
        `User ${userId} | Dual price | ` +
        `Coins: ${baseCoinPrice} → ${coinResult.finalPrice} | ` +
        `Gems: ${baseGemPrice} → ${gemResult.finalPrice}`
    );
    
    return {
        coins: coinResult,
        gems: gemResult,
        totalScaled: coinResult.scaled || gemResult.scaled
    };
}

/**
 * Get wealth tier info for display purposes
 * @param {number} wealth - Wealth amount
 * @param {string} currency - 'coins' or 'gems'
 * @returns {Object} { tier, multiplier, nextTier, toNextTier }
 */
function getWealthTierInfo(wealth, currency) {
    const tiers = currency === 'gems' ? GEM_WEALTH_TIERS : COIN_WEALTH_TIERS;
    const wealthBigInt = BigInt(Math.floor(wealth));
    
    let currentTier = null;
    let nextTier = null;
    
    for (let i = 0; i < tiers.length; i++) {
        if (wealthBigInt >= tiers[i].threshold) {
            currentTier = tiers[i];
            nextTier = i > 0 ? tiers[i - 1] : null;
            break;
        }
    }
    
    if (!currentTier) {
        currentTier = tiers[tiers.length - 1];
    }
    
    return {
        multiplier: currentTier.multiplier,
        threshold: Number(currentTier.threshold),
        nextTier: nextTier ? {
            multiplier: nextTier.multiplier,
            threshold: Number(nextTier.threshold),
            remaining: Number(nextTier.threshold) - wealth
        } : null
    };
}

/**
 * Format price with scaling indicator for UI
 * @param {number} basePrice - Original price
 * @param {number} finalPrice - Scaled price
 * @param {boolean} scaled - Whether price was scaled
 * @returns {string} Formatted price string
 */
function formatScaledPrice(basePrice, finalPrice, scaled) {
    if (!scaled || basePrice === finalPrice) {
        return finalPrice.toLocaleString();
    }
    
    const increase = ((finalPrice - basePrice) / basePrice * 100).toFixed(0);
    return `${finalPrice.toLocaleString()} (+${increase}%)`;
}

module.exports = {
    getUserWealth,
    getWealthMultiplier,
    calculateWealthAddition,
    calculateWealthPrice,
    calculateCoinPrice,
    calculateGemPrice,
    calculateDualPrice,
    getWealthTierInfo,
    formatScaledPrice
};
