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
        chance: 0.15, 
        checkInterval: 1800000, 
        duration: 1800000, 
        description: 'Bountiful harvest! Massive farming boost!',
        emoji: '🌾'
    },
    DAWN_DAYLIGHT: {
        name: 'Dawn Daylight',
        coinMultiplier: 350,
        gemMultiplier: 350,
        chance: 0.05, 
        checkInterval: 3600000, 
        duration: 600000,
        description: 'The legendary dawn has arrived!',
        emoji: '🌅'
    },
    STORMCHARGED: {
        name: 'Stormcharged',
        coinMultiplier: 1/15,
        gemMultiplier: 1/15,
        chance: 0.08, 
        checkInterval: 1800000, 
        duration: 900000, 
        description: 'Electrical interference reduces farming!',
        emoji: '⚡'
    },
    STORM: {
        name: 'Storm',
        coinMultiplier: 1/5,
        gemMultiplier: 1/5,
        chance: 0.12, 
        checkInterval: 1800000, 
        duration: 1200000, 
        description: 'Heavy storm reduces farming efficiency!',
        emoji: '🌧️'
    },
    TORNADO: {
        name: 'Tornado',
        coinMultiplier: 1/30,
        gemMultiplier: 1/30,
        chance: 0.06, 
        checkInterval: 1800000, 
        duration: 300000, 
        description: 'Devastating tornado! Farming severely reduced!',
        emoji: '🌪️'
    },
    GOLDEN_HOUR: {
        name: 'Golden Hour',
        coinMultiplier: 50,
        gemMultiplier: 50,
        chance: 0.10,
        checkInterval: 1800000, 
        duration: 900000,
        description: 'The golden hour shines upon your farm!',
        emoji: '✨'
    },
    METEOR_SHOWER: {
        name: 'Meteor Shower',
        coinMultiplier: 100,
        gemMultiplier: 100,
        chance: 0.05,
        checkInterval: 2700000, 
        duration: 600000, 
        description: 'Meteors rain down blessings!',
        emoji: '☄️'
    },
    BLOOD_MOON: {
        name: 'Blood Moon',
        coinMultiplier: 5,
        gemMultiplier: 25,
        chance: 0.08,
        checkInterval: 1800000, 
        duration: 1200000, 
        description: 'The crimson moon empowers gem production!',
        emoji: '🌕'
    },
    AURORA_BOREALIS: {
        name: 'Aurora Borealis',
        coinMultiplier: 30,
        gemMultiplier: 30,
        chance: 0.07,
        checkInterval: 2400000, 
        duration: 900000, 
        description: 'The northern lights dance across the sky!',
        emoji: '🌌'
    },
    SOLAR_FLARE: {
        name: 'Solar Flare',
        coinMultiplier: 75,
        gemMultiplier: 75,
        chance: 0.06,
        checkInterval: 2100000, 
        duration: 480000, 
        description: 'Intense solar energy supercharges your farm!',
        emoji: '☀️'
    },
    SUNNY_DAY: {
        name: 'Sunny Day',
        coinMultiplier: 3,
        gemMultiplier: 2,
        chance: 0.25,
        checkInterval: 1200000,
        duration: 1800000,
        description: 'Perfect weather for farming!',
        emoji: '☀️'
    },
    LIGHT_RAIN: {
        name: 'Light Rain',
        coinMultiplier: 2,
        gemMultiplier: 3,
        chance: 0.20,
        checkInterval: 1200000,
        duration: 1500000,
        description: 'Gentle rain nourishes the crops!',
        emoji: '🌦️'
    },
    FOGGY: {
        name: 'Foggy',
        coinMultiplier: 1/3,
        gemMultiplier: 1/3,
        chance: 0.15,
        checkInterval: 1800000,
        duration: 1200000,
        description: 'Thick fog reduces visibility and productivity!',
        emoji: '🌫️'
    },
    DROUGHT: {
        name: 'Drought',
        coinMultiplier: 1/8,
        gemMultiplier: 1/10,
        chance: 0.10,
        checkInterval: 2400000,
        duration: 1800000,
        description: 'Severe drought withers your crops!',
        emoji: '🏜️'
    },
    HAILSTORM: {
        name: 'Hailstorm',
        coinMultiplier: 1/12,
        gemMultiplier: 1/12,
        chance: 0.08,
        checkInterval: 1800000,
        duration: 600000,
        description: 'Hail damages your farm!',
        emoji: '🧊'
    },
    BLIZZARD: {
        name: 'Blizzard',
        coinMultiplier: 1/20,
        gemMultiplier: 1/20,
        chance: 0.07,
        checkInterval: 2400000,
        duration: 900000,
        description: 'Freezing blizzard halts farming operations!',
        emoji: '❄️'
    },
    RAINBOW: {
        name: 'Rainbow',
        coinMultiplier: 8,
        gemMultiplier: 12,
        chance: 0.12,
        checkInterval: 1800000,
        duration: 600000,
        description: 'A magical rainbow brings good fortune!',
        emoji: '🌈'
    },
    STARRY_NIGHT: {
        name: 'Starry Night',
        coinMultiplier: 4,
        gemMultiplier: 8,
        chance: 0.18,
        checkInterval: 1500000,
        duration: 1200000,
        description: 'Stars shine brightly, blessing your farm!',
        emoji: '⭐'
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
    'STARRY_NIGHT'
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
    return season ? `${season.emoji} ${season.description}` : '';
}

function getWeatherDuration(weatherType) {
    const weather = SEASONS[weatherType];
    return weather?.duration || 0;
}

function getWeatherCheckInterval(weatherType) {
    const weather = SEASONS[weatherType];
    return weather?.checkInterval || 1800000; 
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
    getWeatherCheckInterval
};