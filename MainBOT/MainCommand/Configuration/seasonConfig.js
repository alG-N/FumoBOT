const SEASONS = {
    WEEKEND: {
        name: 'Weekend Season',
        coinMultiplier: 2,
        gemMultiplier: 2,
        description: 'Double rewards for the weekend!',
        emoji: '🎊'
    },
    FESTIVAL_HARVEST: {
        name: 'Festival Harvest',
        coinMultiplier: 15,
        gemMultiplier: 15,
        chance: 1/12000, // 1 in 12,000 seconds (was 0.15 every 30 min)
        checkInterval: 1000,
        duration: 1800000, 
        description: 'Bountiful harvest! Massive farming boost!',
        emoji: '🌾'
    },
    DAWN_DAYLIGHT: {
        name: 'Dawn Daylight',
        coinMultiplier: 350,
        gemMultiplier: 350,
        chance: 1/72000, // 1 in 72,000 seconds (was 0.05 every 1 hour)
        checkInterval: 1000,
        duration: 600000,
        description: 'The legendary dawn has arrived!',
        emoji: '🌅'
    },
    STORMCHARGED: {
        name: 'Stormcharged',
        coinMultiplier: 1/15,
        gemMultiplier: 1/15,
        chance: 1/22500, // 1 in 22,500 seconds (was 0.08 every 30 min)
        checkInterval: 1000,
        duration: 900000, 
        description: 'Electrical interference reduces farming!',
        emoji: '⚡'
    },
    STORM: {
        name: 'Storm',
        coinMultiplier: 1/5,
        gemMultiplier: 1/5,
        chance: 1/15000, // 1 in 15,000 seconds (was 0.12 every 30 min)
        checkInterval: 1000,
        duration: 1200000, 
        description: 'Heavy storm reduces farming efficiency!',
        emoji: '🌧️'
    },
    TORNADO: {
        name: 'Tornado',
        coinMultiplier: 1/30,
        gemMultiplier: 1/30,
        chance: 1/30000, // 1 in 30,000 seconds (was 0.06 every 30 min)
        checkInterval: 1000,
        duration: 300000, 
        description: 'Devastating tornado! Farming severely reduced!',
        emoji: '🌪️'
    },
    GOLDEN_HOUR: {
        name: 'Golden Hour',
        coinMultiplier: 50,
        gemMultiplier: 50,
        chance: 1/18000, // 1 in 18,000 seconds (was 0.10 every 30 min)
        checkInterval: 1000,
        duration: 900000,
        description: 'The golden hour shines upon your farm!',
        emoji: '✨'
    },
    METEOR_SHOWER: {
        name: 'Meteor Shower',
        coinMultiplier: 100,
        gemMultiplier: 100,
        chance: 1/54000, // 1 in 54,000 seconds (was 0.05 every 45 min)
        checkInterval: 1000,
        duration: 600000, 
        description: 'Meteors rain down blessings!',
        emoji: '☄️'
    },
    BLOOD_MOON: {
        name: 'Blood Moon',
        coinMultiplier: 5,
        gemMultiplier: 25,
        chance: 1/22500, // 1 in 22,500 seconds (was 0.08 every 30 min)
        checkInterval: 1000,
        duration: 1200000, 
        description: 'The crimson moon empowers gem production!',
        emoji: '🌕'
    },
    AURORA_BOREALIS: {
        name: 'Aurora Borealis',
        coinMultiplier: 30,
        gemMultiplier: 30,
        chance: 1/34286, // 1 in 34,286 seconds (was 0.07 every 40 min)
        checkInterval: 1000,
        duration: 900000, 
        description: 'The northern lights dance across the sky!',
        emoji: '🌌'
    },
    SOLAR_FLARE: {
        name: 'Solar Flare',
        coinMultiplier: 75,
        gemMultiplier: 75,
        chance: 1/35000, // 1 in 35,000 seconds (was 0.06 every 35 min)
        checkInterval: 1000,
        duration: 480000, 
        description: 'Intense solar energy supercharges your farm!',
        emoji: '☀️'
    },
    SUNNY_DAY: {
        name: 'Sunny Day',
        coinMultiplier: 3,
        gemMultiplier: 2,
        chance: 1/4800, // 1 in 4,800 seconds (was 0.25 every 20 min)
        checkInterval: 1000,
        duration: 1800000,
        description: 'Perfect weather for farming!',
        emoji: '☀️'
    },
    LIGHT_RAIN: {
        name: 'Light Rain',
        coinMultiplier: 2,
        gemMultiplier: 3,
        chance: 1/6000, // 1 in 6,000 seconds (was 0.20 every 20 min)
        checkInterval: 1000,
        duration: 1500000,
        description: 'Gentle rain nourishes the crops!',
        emoji: '🌦️'
    },
    FOGGY: {
        name: 'Foggy',
        coinMultiplier: 1/3,
        gemMultiplier: 1/3,
        chance: 1/12000, // 1 in 12,000 seconds (was 0.15 every 30 min)
        checkInterval: 1000,
        duration: 1200000,
        description: 'Thick fog reduces visibility and productivity!',
        emoji: '🌫️'
    },
    DROUGHT: {
        name: 'Drought',
        coinMultiplier: 1/8,
        gemMultiplier: 1/10,
        chance: 1/24000, // 1 in 24,000 seconds (was 0.10 every 40 min)
        checkInterval: 1000,
        duration: 1800000,
        description: 'Severe drought withers your crops!',
        emoji: '🏜️'
    },
    HAILSTORM: {
        name: 'Hailstorm',
        coinMultiplier: 1/12,
        gemMultiplier: 1/12,
        chance: 1/22500, // 1 in 22,500 seconds (was 0.08 every 30 min)
        checkInterval: 1000,
        duration: 600000,
        description: 'Hail damages your farm!',
        emoji: '🧊'
    },
    BLIZZARD: {
        name: 'Blizzard',
        coinMultiplier: 1/20,
        gemMultiplier: 1/20,
        chance: 1/34286, // 1 in 34,286 seconds (was 0.07 every 40 min)
        checkInterval: 1000,
        duration: 900000,
        description: 'Freezing blizzard halts farming operations!',
        emoji: '❄️'
    },
    RAINBOW: {
        name: 'Rainbow',
        coinMultiplier: 8,
        gemMultiplier: 12,
        chance: 1/15000, // 1 in 15,000 seconds (was 0.12 every 30 min)
        checkInterval: 1000,
        duration: 600000,
        description: 'A magical rainbow brings good fortune!',
        emoji: '🌈'
    },
    STARRY_NIGHT: {
        name: 'Starry Night',
        coinMultiplier: 4,
        gemMultiplier: 8,
        chance: 1/8333, // 1 in 8,333 seconds (was 0.18 every 25 min)
        checkInterval: 1000,
        duration: 1200000,
        description: 'Stars shine brightly, blessing your farm!',
        emoji: '⭐'
    },
    G1TCH3D: {
        name: 'G1tCh3D',
        coinMultiplier: 3500,
        gemMultiplier: 3500,
        chance: 1/1500000, // 1 in 1.5 million seconds (ultra mega rare!)
        checkInterval: 1000,
        duration: 300000, 
        description: '̷̢̛̝͎̈́̓R̴͎̈́͜E̸̢̛̳̅A̶̰̍̚L̷̰̈́͠I̵̞̿̚T̴̨̛̩́Y̶̱̿ ̶̢̍Ḯ̶̱͜S̶̱̀ ̴͖̌B̷̨̛̜R̴̨͋̕E̸̡̤̾A̵̬̓K̴̨̓Ī̵̮̓Ņ̶̎G̶̰̾!̷̱̈́',
        emoji: '▓',
        isGlitched: true
    },
    COSMIC_VOID: {
        name: 'Cosmic Void',
        coinMultiplier: 1/100,
        gemMultiplier: 1/100,
        chance: 1/120000, // 1 in 120,000 seconds (was 0.03 every 1 hour)
        checkInterval: 1000,
        duration: 420000,
        description: 'A void opens in space, draining all energy from your farm!',
        emoji: '🕳️'
    },
    TEMPORAL_COLLAPSE: {
        name: 'Temporal Collapse',
        coinMultiplier: 1/50,
        gemMultiplier: 1/75,
        chance: 1/54000, // 1 in 54,000 seconds (was 0.05 every 45 min)
        checkInterval: 1000,
        duration: 600000, 
        description: 'Time itself distorts, severely disrupting production!',
        emoji: '⏳'
    },
    PESTILENCE: {
        name: 'Pestilence',
        coinMultiplier: 1/7,
        gemMultiplier: 1/10,
        chance: 1/16364, // 1 in 16,364 seconds (was 0.11 every 30 min)
        checkInterval: 1000,
        duration: 1500000,
        description: 'A plague of locusts devours your crops!',
        emoji: '🦗'
    },
    DIVINE_ASCENSION: {
        name: 'Divine Ascension',
        coinMultiplier: 250,
        gemMultiplier: 250,
        chance: 1/90000, // 1 in 90,000 seconds (was 0.04 every 1 hour)
        checkInterval: 1000,
        duration: 480000, 
        description: 'Divine beings bless your farm with otherworldly abundance!',
        emoji: '👼'
    }
};

const WEATHER_EVENTS = [
    'FESTIVAL_HARVEST',
    'DAWN_DAYLIGHT',
    'STORMCHARGED',
    'STORM',
    'TORNADO',
    'GOLDEN_HOUR',
    'METEOR_SHOWER',
    'BLOOD_MOON',
    'AURORA_BOREALIS',
    'SOLAR_FLARE',
    'SUNNY_DAY',
    'LIGHT_RAIN',
    'FOGGY',
    'DROUGHT',
    'HAILSTORM',
    'BLIZZARD',
    'RAINBOW',
    'STARRY_NIGHT',
    'G1TCH3D',
    'COSMIC_VOID',
    'TEMPORAL_COLLAPSE',
    'PESTILENCE',
    'DIVINE_ASCENSION'
];

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
    const weather = SEASONS[weatherType];
    if (!weather || !weather.chance) return false;
    
    return Math.random() < weather.chance;
}

function getWeatherMultiplier(weatherType) {
    const weather = SEASONS[weatherType];
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
    const season = SEASONS[seasonKey];
    if (!season) return '';
    
    if (season.isGlitched) {
        return `${season.emoji} ${season.description}`;
    }
    
    return `${season.emoji} ${season.description}`;
}

function getWeatherDuration(weatherType) {
    const weather = SEASONS[weatherType];
    return weather?.duration || 0;
}

function getWeatherCheckInterval(weatherType) {
    const weather = SEASONS[weatherType];
    return weather?.checkInterval || 1800000; 
}

function isGlitchedWeather(weatherType) {
    const weather = SEASONS[weatherType];
    return weather?.isGlitched || false;
}

function getWeatherRarity(weatherType) {
    const weather = SEASONS[weatherType];
    if (!weather || !weather.chance) return 'N/A';
    
    const chance = weather.chance;
    
    if (chance >= 0.15) return '⚪ Common';
    if (chance >= 0.08) return '🟢 Uncommon';
    if (chance >= 0.05) return '🔵 Rare';
    if (chance >= 0.03) return '🟣 Epic';
    if (chance >= 0.01) return '🟠 Legendary';
    if (chance >= 0.001) return '🔴 Mythical';
    return '⬛ ???';
}

module.exports = {
    SEASONS,
    WEATHER_EVENTS,
    isWeekend,
    getBaseSeasonMultiplier,
    shouldTriggerWeather,
    getWeatherMultiplier,
    calculateTotalMultipliers,
    getSeasonDescription,
    getWeatherDuration,
    getWeatherCheckInterval,
    isGlitchedWeather,
    getWeatherRarity
};