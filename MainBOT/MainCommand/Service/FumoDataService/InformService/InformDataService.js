const FumoPool = require('../../../Data/FumoPool');
const { coinBannerChances, gemBannerChances, ReimuChances, SUMMON_PLACES } = require('../../../Configuration/informConfig');

function normalizeFumoName(input) {
    return input
        .replace(/\[✨SHINY\]$/i, '')
        .replace(/\[🌟alG\]$/i, '')
        .replace(/^shiny\s+/i, '')
        .replace(/^alg\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractVariant(input) {
    if (/\[✨SHINY\]/i.test(input) || /^shiny\s+/i.test(input)) {
        return 'SHINY';
    }
    if (/\[🌟alG\]/i.test(input) || /^alg\s+/i.test(input)) {
        return 'ALG';
    }
    return 'NORMAL';
}

function findFumoInPool(normalizedName) {
    const allFumos = FumoPool.getRaw();
    
    return allFumos.find(fumo => {
        const fumoFullName = `${fumo.name}(${fumo.rarity})`;
        return fumoFullName.toLowerCase() === normalizedName.toLowerCase();
    });
}

function determineSummonPlace(fumo) {
    if (!fumo) return null;

    if (fumo.availability.market && fumo.marketPrice !== null) {
        return SUMMON_PLACES.MARKET;
    }
    
    if (fumo.availability.pray) {
        return SUMMON_PLACES.REIMU_PRAYER;
    }
    
    if (fumo.availability.event) {
        return SUMMON_PLACES.GEMS_BANNER;
    }
    
    if (fumo.availability.crate) {
        return SUMMON_PLACES.COINS_BANNER;
    }

    return null;
}

function getChanceForFumo(fumo, summonPlace) {
    if (!fumo) return null;

    const rarity = fumo.rarity;

    switch (summonPlace) {
        case SUMMON_PLACES.COINS_BANNER:
            return coinBannerChances[rarity] || null;
        case SUMMON_PLACES.GEMS_BANNER:
            return gemBannerChances[rarity] || null;
        case SUMMON_PLACES.REIMU_PRAYER:
            return ReimuChances[rarity] || null;
        case SUMMON_PLACES.MARKET:
            return null;
        default:
            return null;
    }
}

function calculateVariantChance(baseChance, variantMultiplier) {
    if (!baseChance) return null;
    
    const numericChance = parseFloat(baseChance.replace('%', ''));
    const variantChance = numericChance * variantMultiplier;
    
    if (variantChance >= 0.01) {
        return `${variantChance.toFixed(2)}%`;
    } else if (variantChance > 0) {
        const inverse = Math.round(100 / variantChance);
        return `1 in ${inverse.toLocaleString()}`;
    }
    
    return baseChance;
}

function getFumoData(input) {
    const normalized = normalizeFumoName(input);
    const variant = extractVariant(input);
    const fumo = findFumoInPool(normalized);

    if (!fumo) {
        return { found: false };
    }

    const summonPlace = determineSummonPlace(fumo);
    const baseChance = getChanceForFumo(fumo, summonPlace);

    return {
        found: true,
        fumo,
        variant,
        summonPlace,
        baseChance
    };
}

module.exports = {
    normalizeFumoName,
    extractVariant,
    findFumoInPool,
    determineSummonPlace,
    getChanceForFumo,
    calculateVariantChance,
    getFumoData
};