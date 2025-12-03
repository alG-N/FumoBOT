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

function getAllSummonPlaces(fumo) {
    if (!fumo) return [];
    
    const places = [];
    
    if (fumo.availability.crate) {
        places.push({
            place: SUMMON_PLACES.COINS_BANNER,
            chance: coinBannerChances[fumo.rarity] || null,
            currency: 'coins'
        });
    }
    
    if (fumo.availability.event) {
        places.push({
            place: SUMMON_PLACES.GEMS_BANNER,
            chance: gemBannerChances[fumo.rarity] || null,
            currency: 'gems'
        });
    }
    
    if (fumo.availability.pray) {
        places.push({
            place: SUMMON_PLACES.REIMU_PRAYER,
            chance: ReimuChances[fumo.rarity] || null,
            currency: 'special'
        });
    }
    
    if (fumo.availability.market && fumo.marketPrice !== null) {
        places.push({
            place: SUMMON_PLACES.MARKET,
            price: fumo.marketPrice,
            currency: 'coins'
        });
    }
    
    return places;
}

function calculateVariantChance(baseChance, variantMultiplier) {
    if (!baseChance) return null;
    
    const numericChance = parseFloat(baseChance.replace('%', ''));
    const variantChance = numericChance * variantMultiplier;
    
    if (variantChance >= 0.01) {
        return `${variantChance.toFixed(4)}%`;
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

    const summonPlaces = getAllSummonPlaces(fumo);

    return {
        found: true,
        fumo,
        variant,
        summonPlaces
    };
}

module.exports = {
    normalizeFumoName,
    extractVariant,
    findFumoInPool,
    getAllSummonPlaces,
    calculateVariantChance,
    getFumoData
};