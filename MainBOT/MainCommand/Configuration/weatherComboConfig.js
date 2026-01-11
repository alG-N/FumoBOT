/**
 * Weather Combo Configuration
 * 
 * Weather combos trigger when specific weather combinations are active simultaneously.
 * Combos OVERRIDE individual weather effects with their own multipliers.
 * 
 * Design:
 * - Combos require 2-3 specific weather types active at once
 * - When a combo forms, it replaces individual weather effects
 * - Combos have their own duration and are announced separately
 * - Combos can be positive (buff) or negative (debuff)
 */

const WEATHER_COMBOS = {
    // ===== POSITIVE COMBOS =====
    
    // Easy to trigger (common weathers)
    PERFECT_DAY: {
        name: 'Perfect Day',
        requiredWeathers: ['SUNNY_DAY', 'LIGHT_RAIN'],
        coinMultiplier: 8,
        gemMultiplier: 8,
        description: '**☀️🌦️ PERFECT DAY** — Sun and rain create ideal farming conditions!',
        emoji: '🌤️',
        duration: 1200000,      // 20 minutes
        tier: 'UNCOMMON',
        type: 'positive'
    },
    
    PRISMATIC_STORM: {
        name: 'Prismatic Storm',
        requiredWeathers: ['RAINBOW', 'LIGHT_RAIN'],
        coinMultiplier: 15,
        gemMultiplier: 20,
        description: '**🌈🌦️ PRISMATIC STORM** — Rainbows paint the sky with fortune!',
        emoji: '🌈',
        duration: 900000,
        tier: 'RARE',
        type: 'positive'
    },
    
    STARLIT_RAINBOW: {
        name: 'Starlit Rainbow',
        requiredWeathers: ['RAINBOW', 'STARRY_NIGHT'],
        coinMultiplier: 25,
        gemMultiplier: 35,
        description: '**🌈⭐ STARLIT RAINBOW** — Stars and rainbows align!',
        emoji: '✨',
        duration: 600000,
        tier: 'RARE',
        type: 'positive'
    },
    
    // Medium difficulty (rare weathers)
    HARVEST_MOON: {
        name: 'Harvest Moon',
        requiredWeathers: ['FESTIVAL_HARVEST', 'BLOOD_MOON'],
        coinMultiplier: 75,
        gemMultiplier: 100,
        description: '**🌾🌕 HARVEST MOON** — The crimson moon blesses the harvest!',
        emoji: '🌕',
        duration: 900000,
        tier: 'EPIC',
        type: 'positive'
    },
    
    SOLAR_SUPREMACY: {
        name: 'Solar Supremacy',
        requiredWeathers: ['SUNNY_DAY', 'GOLDEN_HOUR'],
        coinMultiplier: 60,
        gemMultiplier: 60,
        description: '**☀️✨ SOLAR SUPREMACY** — The sun\'s power reaches its peak!',
        emoji: '☀️',
        duration: 600000,
        tier: 'EPIC',
        type: 'positive'
    },
    
    COSMIC_CONVERGENCE: {
        name: 'Cosmic Convergence',
        requiredWeathers: ['METEOR_SHOWER', 'AURORA_BOREALIS'],
        coinMultiplier: 150,
        gemMultiplier: 150,
        description: '**☄️🌌 COSMIC CONVERGENCE** — Cosmic events align!',
        emoji: '🌠',
        duration: 600000,
        tier: 'LEGENDARY',
        type: 'positive'
    },
    
    CELESTIAL_DAWN: {
        name: 'Celestial Dawn',
        requiredWeathers: ['DAWN_DAYLIGHT', 'SOLAR_FLARE'],
        coinMultiplier: 500,
        gemMultiplier: 500,
        description: '**🌅🔆 CELESTIAL DAWN** — The ultimate sunrise!',
        emoji: '🌅',
        duration: 480000,
        tier: 'MYTHICAL',
        type: 'positive'
    },
    
    DIVINE_BLESSING: {
        name: 'Divine Blessing',
        requiredWeathers: ['DIVINE_ASCENSION', 'GOLDEN_HOUR', 'AURORA_BOREALIS'],
        coinMultiplier: 1000,
        gemMultiplier: 1000,
        description: '**👼✨🌌 DIVINE BLESSING** — The gods smile upon your farm!',
        emoji: '👼',
        duration: 480000,
        tier: 'DIVINE',
        type: 'positive'
    },
    
    // ===== NEGATIVE COMBOS =====
    
    ELECTRICAL_STORM: {
        name: 'Electrical Storm',
        requiredWeathers: ['STORM', 'STORMCHARGED'],
        coinMultiplier: 0.1,
        gemMultiplier: 0.1,
        description: '**🌧️⚡ ELECTRICAL STORM** — Lightning ravages your farm!',
        emoji: '⛈️',
        duration: 900000,
        tier: 'EPIC',
        type: 'negative'
    },
    
    DRY_STORM: {
        name: 'Dry Storm',
        requiredWeathers: ['DROUGHT', 'STORMCHARGED'],
        coinMultiplier: 0.05,
        gemMultiplier: 0.05,
        description: '**🏜️⚡ DRY STORM** — Electrical devastation in the drought!',
        emoji: '💀',
        duration: 900000,
        tier: 'LEGENDARY',
        type: 'negative'
    },
    
    FROZEN_WASTELAND: {
        name: 'Frozen Wasteland',
        requiredWeathers: ['BLIZZARD', 'HAILSTORM'],
        coinMultiplier: 0.03,
        gemMultiplier: 0.03,
        description: '**❄️🧊 FROZEN WASTELAND** — Everything freezes solid!',
        emoji: '🥶',
        duration: 600000,
        tier: 'LEGENDARY',
        type: 'negative'
    },
    
    DISASTER_CASCADE: {
        name: 'Disaster Cascade',
        requiredWeathers: ['STORM', 'TORNADO', 'HAILSTORM'],
        coinMultiplier: 0.01,
        gemMultiplier: 0.01,
        description: '**🌧️🌪️🧊 DISASTER CASCADE** — Multiple disasters strike!',
        emoji: '💀',
        duration: 600000,
        tier: 'MYTHICAL',
        type: 'negative'
    },
    
    TEMPORAL_VOID: {
        name: 'Temporal Void',
        requiredWeathers: ['COSMIC_VOID', 'TEMPORAL_COLLAPSE'],
        coinMultiplier: 0.005,
        gemMultiplier: 0.005,
        description: '**🕳️⏳ TEMPORAL VOID** — Space and time collapse!',
        emoji: '🌀',
        duration: 420000,
        tier: 'DIVINE',
        type: 'negative'
    },
    
    // ===== ULTRA RARE COMBO =====
    GLITCHED_REALITY: {
        name: 'Glitched Reality',
        requiredWeathers: ['G1TCH3D', 'COSMIC_VOID'],
        coinMultiplier: 5000,
        gemMultiplier: 5000,
        description: '**▓🕳️ G̷L̴I̸T̷C̸H̴E̷D̸ ̴R̵E̶A̷L̸I̸T̴Y̷** — R̴E̷A̶L̸I̵T̴Y̷.̴E̶X̵E̸ ̷C̵R̶A̷S̵H̶E̷D̸',
        emoji: '▓',
        duration: 300000,
        tier: 'GLITCHED',
        type: 'glitched',
        isGlitched: true
    }
};

// Categorize combos by type
const POSITIVE_COMBOS = Object.entries(WEATHER_COMBOS)
    .filter(([_, combo]) => combo.type === 'positive')
    .map(([key]) => key);

const NEGATIVE_COMBOS = Object.entries(WEATHER_COMBOS)
    .filter(([_, combo]) => combo.type === 'negative')
    .map(([key]) => key);

const GLITCHED_COMBOS = Object.entries(WEATHER_COMBOS)
    .filter(([_, combo]) => combo.type === 'glitched')
    .map(([key]) => key);

// For backwards compatibility
const BAD_COMBOS = NEGATIVE_COMBOS;
const GOOD_COMBOS = [...POSITIVE_COMBOS, ...GLITCHED_COMBOS];

/**
 * Check if active weathers form any combo
 * Returns the highest-tier combo if multiple match
 */
function checkForWeatherCombo(activeWeathers) {
    if (!activeWeathers || activeWeathers.length < 2) {
        return { found: false };
    }
    
    const tierPriority = {
        'GLITCHED': 7,
        'DIVINE': 6,
        'MYTHICAL': 5,
        'LEGENDARY': 4,
        'EPIC': 3,
        'RARE': 2,
        'UNCOMMON': 1,
        'COMMON': 0
    };
    
    let bestCombo = null;
    let bestTier = -1;
    
    for (const [comboKey, comboData] of Object.entries(WEATHER_COMBOS)) {
        const hasAllWeathers = comboData.requiredWeathers.every(weather => 
            activeWeathers.includes(weather)
        );
        
        if (hasAllWeathers) {
            const tierValue = tierPriority[comboData.tier] || 0;
            if (tierValue > bestTier) {
                bestTier = tierValue;
                bestCombo = { comboKey, comboData };
            }
        }
    }
    
    if (bestCombo) {
        return {
            found: true,
            comboKey: bestCombo.comboKey,
            comboData: bestCombo.comboData
        };
    }
    
    return { found: false };
}

/**
 * Get combo description
 */
function getComboDescription(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo ? combo.description : '';
}

/**
 * Get combo multipliers
 */
function getComboMultiplier(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    if (!combo) return { coin: 1, gem: 1 };
    
    return {
        coin: combo.coinMultiplier,
        gem: combo.gemMultiplier
    };
}

/**
 * Get combo duration
 */
function getComboDuration(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.duration || 600000;
}

/**
 * Check if combo is glitched
 */
function isGlitchedCombo(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.isGlitched || false;
}

/**
 * Get combo tier
 */
function getComboTier(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.tier || 'COMMON';
}

/**
 * Get required weathers for a combo
 */
function getComboRequirements(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.requiredWeathers || [];
}

/**
 * List all possible combos (for info display)
 */
function getAllCombos() {
    return Object.entries(WEATHER_COMBOS).map(([key, data]) => ({
        key,
        name: data.name,
        tier: data.tier,
        type: data.type,
        requirements: data.requiredWeathers,
        multiplier: { coin: data.coinMultiplier, gem: data.gemMultiplier },
        emoji: data.emoji
    }));
}

module.exports = {
    WEATHER_COMBOS,
    POSITIVE_COMBOS,
    NEGATIVE_COMBOS,
    GLITCHED_COMBOS,
    BAD_COMBOS,
    GOOD_COMBOS,
    checkForWeatherCombo,
    getComboDescription,
    getComboMultiplier,
    getComboDuration,
    isGlitchedCombo,
    getComboTier,
    getComboRequirements,
    getAllCombos
};