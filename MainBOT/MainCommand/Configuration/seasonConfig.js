/**
 * Season and Weather Configuration
 * 
 * Weather System Design:
 * - Weather checks happen at defined intervals (5-30 minutes)
 * - Each weather has a % chance to trigger per check
 * - Global cooldown prevents weather spam
 * - Weather can stack for combo potential
 * - Multipliers < 1 are negative effects, > 1 are positive
 */

const SEASONS = {
    WEEKEND: {
        name: 'Weekend Season',
        coinMultiplier: 2,
        gemMultiplier: 2,
        description: 'Double rewards for the weekend!',
        emoji: '🎊'
    }
};

// Weather tiers for organization
const WEATHER_TIERS = {
    COMMON: { color: '⚪', chanceRange: [0.15, 0.30] },
    UNCOMMON: { color: '🟢', chanceRange: [0.08, 0.15] },
    RARE: { color: '🔵', chanceRange: [0.04, 0.08] },
    EPIC: { color: '🟣', chanceRange: [0.02, 0.04] },
    LEGENDARY: { color: '🟠', chanceRange: [0.005, 0.02] },
    MYTHICAL: { color: '🔴', chanceRange: [0.001, 0.005] },
    DIVINE: { color: '✨', chanceRange: [0.0001, 0.001] },
    GLITCHED: { color: '▓', chanceRange: [0.00001, 0.0001] }
};

/**
 * Weather Events Configuration
 * 
 * checkInterval: How often to roll for this weather (ms)
 * chance: Probability per roll (0.10 = 10%)
 * duration: How long weather lasts (ms)
 * cooldown: Minimum time before this weather can appear again (ms)
 */
const WEATHER_CONFIG = {
    // ===== POSITIVE WEATHER (Common) =====
    SUNNY_DAY: {
        name: 'Sunny Day',
        coinMultiplier: 2,
        gemMultiplier: 1.5,
        chance: 0.20,           // 20% per check
        checkInterval: 600000,  // Check every 10 minutes
        duration: 1800000,      // 30 minutes
        cooldown: 3600000,      // 1 hour cooldown
        description: 'Perfect weather for farming!',
        emoji: '☀️',
        tier: 'COMMON',
        type: 'positive'
    },
    LIGHT_RAIN: {
        name: 'Light Rain',
        coinMultiplier: 1.5,
        gemMultiplier: 2,
        chance: 0.18,
        checkInterval: 600000,
        duration: 1500000,      // 25 minutes
        cooldown: 3600000,
        description: 'Gentle rain nourishes the crops!',
        emoji: '🌦️',
        tier: 'COMMON',
        type: 'positive'
    },
    STARRY_NIGHT: {
        name: 'Starry Night',
        coinMultiplier: 3,
        gemMultiplier: 5,
        chance: 0.12,
        checkInterval: 900000,  // Check every 15 minutes
        duration: 1200000,      // 20 minutes
        cooldown: 5400000,      // 1.5 hour cooldown
        description: 'Stars shine brightly, blessing your farm!',
        emoji: '⭐',
        tier: 'UNCOMMON',
        type: 'positive'
    },
    RAINBOW: {
        name: 'Rainbow',
        coinMultiplier: 5,
        gemMultiplier: 8,
        chance: 0.10,
        checkInterval: 900000,
        duration: 600000,       // 10 minutes
        cooldown: 7200000,      // 2 hour cooldown
        description: 'A magical rainbow brings good fortune!',
        emoji: '🌈',
        tier: 'UNCOMMON',
        type: 'positive'
    },

    // ===== POSITIVE WEATHER (Rare+) =====
    GOLDEN_HOUR: {
        name: 'Golden Hour',
        coinMultiplier: 25,
        gemMultiplier: 25,
        chance: 0.06,
        checkInterval: 1200000, // Check every 20 minutes
        duration: 900000,       // 15 minutes
        cooldown: 10800000,     // 3 hour cooldown
        description: 'The golden hour shines upon your farm!',
        emoji: '✨',
        tier: 'RARE',
        type: 'positive'
    },
    FESTIVAL_HARVEST: {
        name: 'Festival Harvest',
        coinMultiplier: 10,
        gemMultiplier: 10,
        chance: 0.05,
        checkInterval: 1800000, // Check every 30 minutes
        duration: 1800000,      // 30 minutes
        cooldown: 14400000,     // 4 hour cooldown
        description: 'Bountiful harvest! Massive farming boost!',
        emoji: '🌾',
        tier: 'RARE',
        type: 'positive'
    },
    BLOOD_MOON: {
        name: 'Blood Moon',
        coinMultiplier: 3,
        gemMultiplier: 15,
        chance: 0.04,
        checkInterval: 1800000,
        duration: 1200000,      // 20 minutes
        cooldown: 14400000,
        description: 'The crimson moon empowers gem production!',
        emoji: '🌕',
        tier: 'EPIC',
        type: 'positive'
    },
    AURORA_BOREALIS: {
        name: 'Aurora Borealis',
        coinMultiplier: 20,
        gemMultiplier: 20,
        chance: 0.03,
        checkInterval: 1800000,
        duration: 900000,
        cooldown: 18000000,     // 5 hour cooldown
        description: 'The northern lights dance across the sky!',
        emoji: '🌌',
        tier: 'EPIC',
        type: 'positive'
    },
    METEOR_SHOWER: {
        name: 'Meteor Shower',
        coinMultiplier: 50,
        gemMultiplier: 50,
        chance: 0.015,
        checkInterval: 2700000, // Check every 45 minutes
        duration: 600000,       // 10 minutes
        cooldown: 21600000,     // 6 hour cooldown
        description: 'Meteors rain down blessings!',
        emoji: '☄️',
        tier: 'LEGENDARY',
        type: 'positive'
    },
    SOLAR_FLARE: {
        name: 'Solar Flare',
        coinMultiplier: 40,
        gemMultiplier: 40,
        chance: 0.012,
        checkInterval: 2700000,
        duration: 480000,       // 8 minutes
        cooldown: 21600000,
        description: 'Intense solar energy supercharges your farm!',
        emoji: '🔆',
        tier: 'LEGENDARY',
        type: 'positive'
    },
    DIVINE_ASCENSION: {
        name: 'Divine Ascension',
        coinMultiplier: 150,
        gemMultiplier: 150,
        chance: 0.005,
        checkInterval: 3600000, // Check every hour
        duration: 480000,       // 8 minutes
        cooldown: 43200000,     // 12 hour cooldown
        description: 'Divine beings bless your farm with otherworldly abundance!',
        emoji: '👼',
        tier: 'MYTHICAL',
        type: 'positive'
    },
    DAWN_DAYLIGHT: {
        name: 'Dawn Daylight',
        coinMultiplier: 200,
        gemMultiplier: 200,
        chance: 0.002,
        checkInterval: 3600000,
        duration: 600000,       // 10 minutes
        cooldown: 86400000,     // 24 hour cooldown
        description: 'The legendary dawn has arrived!',
        emoji: '🌅',
        tier: 'DIVINE',
        type: 'positive'
    },

    // ===== NEGATIVE WEATHER =====
    FOGGY: {
        name: 'Foggy',
        coinMultiplier: 0.5,
        gemMultiplier: 0.5,
        chance: 0.12,
        checkInterval: 900000,
        duration: 1200000,
        cooldown: 5400000,
        description: 'Thick fog reduces visibility and productivity!',
        emoji: '🌫️',
        tier: 'UNCOMMON',
        type: 'negative'
    },
    STORM: {
        name: 'Storm',
        coinMultiplier: 0.3,
        gemMultiplier: 0.3,
        chance: 0.08,
        checkInterval: 1200000,
        duration: 1200000,      // 20 minutes
        cooldown: 7200000,
        description: 'Heavy storm reduces farming efficiency!',
        emoji: '🌧️',
        tier: 'RARE',
        type: 'negative'
    },
    STORMCHARGED: {
        name: 'Stormcharged',
        coinMultiplier: 0.15,
        gemMultiplier: 0.15,
        chance: 0.05,
        checkInterval: 1800000,
        duration: 900000,
        cooldown: 10800000,
        description: 'Electrical interference reduces farming!',
        emoji: '⚡',
        tier: 'EPIC',
        type: 'negative'
    },
    DROUGHT: {
        name: 'Drought',
        coinMultiplier: 0.2,
        gemMultiplier: 0.15,
        chance: 0.04,
        checkInterval: 1800000,
        duration: 1800000,
        cooldown: 14400000,
        description: 'Severe drought withers your crops!',
        emoji: '🏜️',
        tier: 'EPIC',
        type: 'negative'
    },
    HAILSTORM: {
        name: 'Hailstorm',
        coinMultiplier: 0.1,
        gemMultiplier: 0.1,
        chance: 0.03,
        checkInterval: 1800000,
        duration: 600000,
        cooldown: 10800000,
        description: 'Hail damages your farm!',
        emoji: '🧊',
        tier: 'LEGENDARY',
        type: 'negative'
    },
    BLIZZARD: {
        name: 'Blizzard',
        coinMultiplier: 0.08,
        gemMultiplier: 0.08,
        chance: 0.025,
        checkInterval: 2700000,
        duration: 900000,
        cooldown: 14400000,
        description: 'Freezing blizzard halts farming operations!',
        emoji: '❄️',
        tier: 'LEGENDARY',
        type: 'negative'
    },
    TORNADO: {
        name: 'Tornado',
        coinMultiplier: 0.05,
        gemMultiplier: 0.05,
        chance: 0.02,
        checkInterval: 2700000,
        duration: 300000,       // 5 minutes
        cooldown: 18000000,
        description: 'Devastating tornado! Farming severely reduced!',
        emoji: '🌪️',
        tier: 'MYTHICAL',
        type: 'negative'
    },
    PESTILENCE: {
        name: 'Pestilence',
        coinMultiplier: 0.2,
        gemMultiplier: 0.15,
        chance: 0.035,
        checkInterval: 1800000,
        duration: 1500000,
        cooldown: 14400000,
        description: 'A plague of locusts devours your crops!',
        emoji: '🦗',
        tier: 'EPIC',
        type: 'negative'
    },
    COSMIC_VOID: {
        name: 'Cosmic Void',
        coinMultiplier: 0.02,
        gemMultiplier: 0.02,
        chance: 0.008,
        checkInterval: 3600000,
        duration: 420000,       // 7 minutes
        cooldown: 43200000,
        description: 'A void opens in space, draining all energy!',
        emoji: '🕳️',
        tier: 'DIVINE',
        type: 'negative'
    },
    TEMPORAL_COLLAPSE: {
        name: 'Temporal Collapse',
        coinMultiplier: 0.03,
        gemMultiplier: 0.02,
        chance: 0.006,
        checkInterval: 3600000,
        duration: 600000,
        cooldown: 43200000,
        description: 'Time itself distorts, severely disrupting production!',
        emoji: '⏳',
        tier: 'DIVINE',
        type: 'negative'
    },

    // ===== ULTRA RARE WEATHER =====
    G1TCH3D: {
        name: 'G1tCh3D',
        coinMultiplier: 2000,
        gemMultiplier: 2000,
        chance: 0.0001,         // 0.01% per check
        checkInterval: 3600000, // Check every hour
        duration: 300000,       // 5 minutes
        cooldown: 604800000,    // 7 day cooldown
        description: '̷̢̛̝͎̈́̓R̴͎̈́͜E̸̢̛̳̅A̶̰̍̚L̷̰̈́͠I̵̞̿̚T̴̨̛̩́Y̶̱̿ ̶̢̍Ḯ̶̱͜S̶̱̀ ̴͖̌B̷̨̛̜R̴̨͋̕E̸̡̤̾A̵̬̓K̴̨̓Ī̵̮̓Ņ̶̎G̶̰̾!̷̱̈́',
        emoji: '▓',
        tier: 'GLITCHED',
        type: 'glitched',
        isGlitched: true
    }
};

// List of active weather event types
const WEATHER_EVENTS = Object.keys(WEATHER_CONFIG);

// Global weather cooldown (minimum time between any weather event)
const GLOBAL_WEATHER_COOLDOWN = 300000; // 5 minutes between any weather

// Maximum simultaneous weather events (for combo potential)
const MAX_SIMULTANEOUS_WEATHER = 3;

// Guaranteed weather interval if no weather has occurred
const GUARANTEED_WEATHER_INTERVAL = 7200000; // 2 hours

function isWeekend() {
    const day = new Date().getDay();
    return day === 0 || day === 6; 
}

function getBaseSeasonMultiplier() {
    if (isWeekend()) {
        return {
            coin: SEASONS.WEEKEND.coinMultiplier,
            gem: SEASONS.WEEKEND.gemMultiplier,
            active: ['WEEKEND']
        };
    }
    return {
        coin: 1,
        gem: 1,
        active: []
    };
}

function shouldTriggerWeather(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    if (!weather || !weather.chance) return false;
    
    return Math.random() < weather.chance;
}

function getWeatherMultiplier(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    if (!weather) return { coin: 1, gem: 1 };
    
    return {
        coin: weather.coinMultiplier,
        gem: weather.gemMultiplier
    };
}

function calculateTotalMultipliers(activeWeathers = []) {
    let baseMult = getBaseSeasonMultiplier();
    let totalCoin = baseMult.coin;
    let totalGem = baseMult.gem;
    let activeEvents = [...baseMult.active];
    
    for (const weather of activeWeathers) {
        const mult = getWeatherMultiplier(weather);
        totalCoin *= mult.coin;
        totalGem *= mult.gem;
        activeEvents.push(weather);
    }
    
    return {
        coinMultiplier: totalCoin,
        gemMultiplier: totalGem,
        activeEvents
    };
}

function getSeasonDescription(seasonKey) {
    const weather = WEATHER_CONFIG[seasonKey];
    if (!weather) return '';
    
    return `${weather.emoji} ${weather.description}`;
}

function getWeatherDuration(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.duration || 0;
}

function getWeatherCheckInterval(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.checkInterval || 1800000; 
}

function getWeatherCooldown(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.cooldown || 3600000;
}

function isGlitchedWeather(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.isGlitched || false;
}

function getWeatherTier(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.tier || 'COMMON';
}

function getWeatherType(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    return weather?.type || 'neutral';
}

function getWeatherRarity(weatherType) {
    const tier = getWeatherTier(weatherType);
    const tierInfo = WEATHER_TIERS[tier];
    return tierInfo ? `${tierInfo.color} ${tier}` : '⚪ Unknown';
}

function getWeatherInfo(weatherType) {
    const weather = WEATHER_CONFIG[weatherType];
    if (!weather) return null;
    
    return {
        ...weather,
        rarity: getWeatherRarity(weatherType),
        isPositive: weather.type === 'positive',
        isNegative: weather.type === 'negative'
    };
}

module.exports = {
    SEASONS,
    WEATHER_CONFIG,
    WEATHER_EVENTS,
    WEATHER_TIERS,
    GLOBAL_WEATHER_COOLDOWN,
    MAX_SIMULTANEOUS_WEATHER,
    GUARANTEED_WEATHER_INTERVAL,
    isWeekend,
    getBaseSeasonMultiplier,
    shouldTriggerWeather,
    getWeatherMultiplier,
    calculateTotalMultipliers,
    getSeasonDescription,
    getWeatherDuration,
    getWeatherCheckInterval,
    getWeatherCooldown,
    isGlitchedWeather,
    getWeatherTier,
    getWeatherType,
    getWeatherRarity,
    getWeatherInfo
};
