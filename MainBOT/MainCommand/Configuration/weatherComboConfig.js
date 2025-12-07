const WEATHER_COMBOS = {
    APOCALYPSE: {
        name: 'Apocalypse',
        requiredWeathers: ['STORM', 'TORNADO', 'HAILSTORM', 'BLIZZARD', 'COSMIC_VOID'],
        coinMultiplier: 1/200,
        gemMultiplier: 1/200,
        description: '**APOCALYPSE** - The end times are here! All negative weather combined into ultimate devastation!',
        emoji: '☠️',
        duration: 1200000,
        chance: 1/180000
    },
    
    DISASTER_CASCADE: {
        name: 'Disaster Cascade',
        requiredWeathers: ['STORM', 'TORNADO', 'HAILSTORM'],
        coinMultiplier: 1/50,
        gemMultiplier: 1/50,
        description: '**DISASTER CASCADE** - Multiple disasters strike at once!',
        emoji: '💀',
        duration: 900000,
        chance: 1/120000
    },

    FROZEN_WASTELAND: {
        name: 'Frozen Wasteland',
        requiredWeathers: ['BLIZZARD', 'HAILSTORM', 'FOGGY'],
        coinMultiplier: 1/40,
        gemMultiplier: 1/40,
        description: '**FROZEN WASTELAND** - Everything freezes solid!',
        emoji: '🧊',
        duration: 1200000,
        chance: 1/100000
    },

    TEMPORAL_VOID: {
        name: 'Temporal Void',
        requiredWeathers: ['COSMIC_VOID', 'TEMPORAL_COLLAPSE'],
        coinMultiplier: 1/150,
        gemMultiplier: 1/150,
        description: '**TEMPORAL VOID** - Space and time collapse together!',
        emoji: '🌀',
        duration: 600000,
        chance: 1/200000
    },

    DRY_STORM: {
        name: 'Dry Storm',
        requiredWeathers: ['DROUGHT', 'STORMCHARGED'],
        coinMultiplier: 1/25,
        gemMultiplier: 1/25,
        description: '**DRY STORM** - Electric storms without rain devastate the land!',
        emoji: '⚡',
        duration: 1200000,
        chance: 1/80000
    },

    DIVINE_BLESSING: {
        name: 'Divine Blessing',
        requiredWeathers: ['DAWN_DAYLIGHT', 'GOLDEN_HOUR', 'METEOR_SHOWER', 'SOLAR_FLARE', 'DIVINE_ASCENSION', 'AURORA_BOREALIS'],
        coinMultiplier: 5000,
        gemMultiplier: 5000,
        description: '**DIVINE BLESSING** - All celestial events align! The gods themselves smile upon your farm!',
        emoji: '👼',
        duration: 900000,
        chance: 1/300000
    },

    HARVEST_MOON: {
        name: 'Harvest Moon',
        requiredWeathers: ['FESTIVAL_HARVEST', 'BLOOD_MOON', 'GOLDEN_HOUR'],
        coinMultiplier: 750,
        gemMultiplier: 750,
        description: '**HARVEST MOON** - The perfect harvest under the crimson moon!',
        emoji: '🌕',
        duration: 1200000,
        chance: 1/150000
    },

    COSMIC_CONVERGENCE: {
        name: 'Cosmic Convergence',
        requiredWeathers: ['METEOR_SHOWER', 'AURORA_BOREALIS', 'STARRY_NIGHT'],
        coinMultiplier: 300,
        gemMultiplier: 300,
        description: '**COSMIC CONVERGENCE** - Cosmic events align in perfect harmony!',
        emoji: '✨',
        duration: 900000,
        chance: 1/120000
    },

    SOLAR_SUPREMACY: {
        name: 'Solar Supremacy',
        requiredWeathers: ['DAWN_DAYLIGHT', 'SOLAR_FLARE', 'SUNNY_DAY'],
        coinMultiplier: 400,
        gemMultiplier: 400,
        description: '**SOLAR SUPREMACY** - The sun\'s power reaches its absolute peak!',
        emoji: '☀️',
        duration: 600000,
        chance: 1/100000
    },

    PRISMATIC_STORM: {
        name: 'Prismatic Storm',
        requiredWeathers: ['RAINBOW', 'LIGHT_RAIN', 'SUNNY_DAY'],
        coinMultiplier: 50,
        gemMultiplier: 75,
        description: '**PRISMATIC STORM** - Gentle rain and sunshine create endless rainbows!',
        emoji: '🌈',
        duration: 1800000,
        chance: 1/70000
    },

    GLITCHED_REALITY: {
        name: 'Glitched Reality',
        requiredWeathers: ['G1TCH3D', 'COSMIC_VOID'],
        coinMultiplier: 7000,
        gemMultiplier: 7000,
        description: '**G̷L̴I̸T̷C̸H̴E̷D̸ ̴R̵E̶A̷L̸I̸T̴Y̷** - R̴̨͋̕E̸̡̤̾A̵̬̓L̷̰̈́͠I̵̞̿̚T̴̨̛̩́Y̶̱̿.̶̢̍E̸̢̛̳̅X̷E̴ ̶̢H̸A̶S̷ ̵S̸T̵O̸P̶P̸E̷D̶ ̴W̵O̴R̴K̷I̵N̶G̴',
        emoji: '▓',
        duration: 300000,
        chance: 1/500000,
        isGlitched: true
    }
};

const BAD_COMBOS = ['APOCALYPSE', 'DISASTER_CASCADE', 'FROZEN_WASTELAND', 'TEMPORAL_VOID', 'DRY_STORM'];
const GOOD_COMBOS = ['DIVINE_BLESSING', 'HARVEST_MOON', 'COSMIC_CONVERGENCE', 'SOLAR_SUPREMACY', 'PRISMATIC_STORM', 'GLITCHED_REALITY'];

function checkForWeatherCombo(activeWeathers) {
    for (const [comboKey, comboData] of Object.entries(WEATHER_COMBOS)) {
        const hasAllWeathers = comboData.requiredWeathers.every(weather => 
            activeWeathers.includes(weather)
        );

        if (hasAllWeathers) {
            return {
                found: true,
                comboKey,
                comboData
            };
        }
    }

    return { found: false };
}

function shouldTriggerCombo(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    if (!combo || !combo.chance) return false;
    
    return Math.random() < combo.chance;
}

function getComboDescription(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo ? combo.description : '';
}

function getComboMultiplier(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    if (!combo) return { coin: 1, gem: 1 };
    
    return {
        coin: combo.coinMultiplier,
        gem: combo.gemMultiplier
    };
}

function getComboDuration(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.duration || 600000;
}

function isGlitchedCombo(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    return combo?.isGlitched || false;
}

function getComboRarity(comboKey) {
    const combo = WEATHER_COMBOS[comboKey];
    if (!combo || !combo.chance) return 'N/A';
    
    const chance = combo.chance;
    
    if (chance >= 0.00001) return '🔴 Mythical';
    if (chance >= 0.000001) return '⬛ Impossible';
    return '💀 Beyond Impossible';
}

module.exports = {
    WEATHER_COMBOS,
    BAD_COMBOS,
    GOOD_COMBOS,
    checkForWeatherCombo,
    shouldTriggerCombo,
    getComboDescription,
    getComboMultiplier,
    getComboDuration,
    isGlitchedCombo,
    getComboRarity
};