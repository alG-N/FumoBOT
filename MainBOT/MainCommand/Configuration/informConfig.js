const coinBannerChances = {
    'TRANSCENDENT': '0.0000667%',
    'ETERNAL': '0.0002%',
    'INFINITE': '0.0005%',
    'CELESTIAL': '0.001111%',
    'ASTRAL': '0.003333%',
    '???': '0.006666%',
    'EXCLUSIVE': '0.02%',
    'MYTHICAL': '0.1%',
    'LEGENDARY': '0.4%',
    'OTHERWORLDLY': '1%',
    'EPIC': '6%',
    'RARE': '10%',
    'UNCOMMON': '25%',
    'Common': '57.4681233%',
};

const gemBannerChances = {
    'COMMON': '49%',
    'UNCOMMON': '30%',
    'RARE': '20%',
    '???': '1%',
    'TRANSCENDENT': '0.000000001%'
};

const ReimuChances = {
    'EPIC': '44.20%',
    'LEGENDARY': '19.89%',
    'OTHERWORLDLY': '14.36%',
    'MYTHICAL': '7.73%',
    'EXCLUSIVE': '5.52%',
    '???': '2.76%',
    'ASTRAL': '2.21%',
    'CELESTIAL': '1.66%',
    'INFINITE': '0.88%',
    'ETERNAL': '0.55%',
    'TRANSCENDENT': '0.22%'
};

const SUMMON_PLACES = {
    COINS_BANNER: 'Coins Banner',
    GEMS_BANNER: 'Gems Banner',
    REIMU_PRAYER: 'Reimus Prayer',
    MARKET: 'Market',
    CODE: 'Code',
    CRATE: 'Crate'
};

const VARIANT_CONFIG = {
    NORMAL: {
        tag: '',
        multiplier: 1,
        emoji: '',
        baseChance: 1,
        description: 'Standard variant'
    },
    SHINY: {
        tag: '[✨SHINY]',
        multiplier: 1 / 100,
        emoji: '✨',
        baseChance: 0.01, // 1%
        description: 'Sparkles with special energy'
    },
    ALG: {
        tag: '[🌟alG]',
        multiplier: 1 / 100000,
        emoji: '🌟',
        baseChance: 0.00001, // 0.001%
        description: 'Blessed by alterGolden'
    },
    VOID: {
        tag: '[🌀VOID]',
        multiplier: 1 / 1000,
        emoji: '🌀',
        baseChance: 0.001, // 0.1%
        description: 'Consumed by the void, radiates dark energy',
        requiresBoost: true,
        boostSources: ['VoidCrystal']
    },
    GLITCHED: {
        tag: '[🔮GLITCHED]',
        multiplier: 1 / 500000,
        emoji: '🔮',
        baseChance: 0.000002, // 0.0002%
        description: 'Reality warps around this anomaly',
        requiresBoost: true,
        boostSources: ['CosmicCore', 'S!gil']
    }
};

const INTERACTION_TIMEOUT = 60000;

/**
 * Format a percentage as "1 in X (Y%)" format
 * @param {number} percentage - The percentage (e.g., 0.01 for 1%)
 * @returns {string} Formatted string like "1 in 100 (1%)"
 */
function formatChanceAsOneInX(percentage) {
    if (percentage <= 0) return 'N/A';
    if (percentage >= 100) return '1 in 1 (100%)';
    
    const decimalChance = percentage / 100;
    const oneInX = Math.round(1 / decimalChance);
    
    // Format large numbers with clean abbreviations
    let oneInXFormatted;
    if (oneInX >= 1000000000000) {
        // Trillion
        const trillions = oneInX / 1000000000000;
        oneInXFormatted = (trillions >= 10 ? Math.round(trillions) : trillions.toFixed(1)) + 'T';
    } else if (oneInX >= 1000000000) {
        // Billion
        const billions = oneInX / 1000000000;
        oneInXFormatted = (billions >= 10 ? Math.round(billions) : billions.toFixed(1)) + 'B';
    } else if (oneInX >= 1000000) {
        // Million
        const millions = oneInX / 1000000;
        oneInXFormatted = (millions >= 10 ? Math.round(millions) : millions.toFixed(1)) + 'M';
    } else if (oneInX >= 1000) {
        // Thousand
        const thousands = oneInX / 1000;
        oneInXFormatted = (thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)) + 'K';
    } else {
        oneInXFormatted = oneInX.toLocaleString();
    }
    
    // Format percentage display - clean and readable
    let percentDisplay;
    if (percentage >= 1) {
        percentDisplay = percentage.toFixed(percentage % 1 === 0 ? 0 : 2) + '%';
    } else if (percentage >= 0.01) {
        percentDisplay = percentage.toFixed(2) + '%';
    } else if (percentage >= 0.001) {
        percentDisplay = percentage.toFixed(3) + '%';
    } else if (percentage >= 0.0001) {
        percentDisplay = percentage.toFixed(4) + '%';
    } else if (percentage >= 0.00001) {
        percentDisplay = percentage.toFixed(5) + '%';
    } else if (percentage >= 0.000001) {
        percentDisplay = percentage.toFixed(6) + '%';
    } else if (percentage >= 0.0000001) {
        percentDisplay = percentage.toFixed(7) + '%';
    } else if (percentage >= 0.00000001) {
        percentDisplay = percentage.toFixed(8) + '%';
    } else if (percentage >= 0.000000001) {
        percentDisplay = percentage.toFixed(9) + '%';
    } else {
        // For extremely small percentages, use scientific notation
        percentDisplay = percentage.toExponential(2) + '%';
    }
    
    return `1 in ${oneInXFormatted} (${percentDisplay})`;
}

/**
 * Parse percentage string to number
 * @param {string} percentStr - Percentage string like "0.01%" or "1%"
 * @returns {number} The percentage as a number
 */
function parsePercentage(percentStr) {
    if (typeof percentStr === 'number') return percentStr;
    return parseFloat(percentStr.replace('%', ''));
}

/**
 * Get variant chance info for display
 * @param {string} variantType - SHINY, ALG, VOID, or GLITCHED
 * @param {number} baseRarityChance - Base chance of the rarity (as percentage)
 * @returns {object} Variant info with formatted chances
 */
function getVariantChanceInfo(variantType, baseRarityChance = 100) {
    const variant = VARIANT_CONFIG[variantType];
    if (!variant) return null;
    
    const variantChance = variant.baseChance * 100; // Convert to percentage
    const combinedChance = (baseRarityChance / 100) * variant.baseChance * 100;
    
    return {
        name: variantType,
        tag: variant.tag,
        emoji: variant.emoji,
        description: variant.description,
        variantChance: formatChanceAsOneInX(variantChance),
        combinedChance: formatChanceAsOneInX(combinedChance),
        requiresBoost: variant.requiresBoost || false,
        boostSources: variant.boostSources || []
    };
}

module.exports = {
    coinBannerChances,
    gemBannerChances,
    ReimuChances,
    SUMMON_PLACES,
    VARIANT_CONFIG,
    INTERACTION_TIMEOUT,
    formatChanceAsOneInX,
    parsePercentage,
    getVariantChanceInfo
};