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
        chance: 0.15, // Buffed from 0.005 to 0.15
        checkInterval: 1800000, // 30 minutes (buffed from 60 min)
        duration: 1800000, // 30 minutes
        description: 'Bountiful harvest! Massive farming boost!',
        emoji: '🌾'
    },
    DAWN_DAYLIGHT: {
        name: 'Dawn Daylight',
        coinMultiplier: 350,
        gemMultiplier: 350,
        chance: 0.05, // Buffed from 0.0001 to 0.05
        checkInterval: 3600000, // 1 hour (buffed from 12 hours)
        duration: 600000, // 10 minutes
        description: 'The legendary dawn has arrived!',
        emoji: '🌅'
    },
    STORMCHARGED: {
        name: 'Stormcharged',
        coinMultiplier: 1/15,
        gemMultiplier: 1/15,
        chance: 0.08, // Buffed from 0.0005 to 0.08
        checkInterval: 1800000, // 30 minutes (buffed from 60 min)
        duration: 900000, // 15 minutes
        description: 'Electrical interference reduces farming!',
        emoji: '⚡'
    },
    STORM: {
        name: 'Storm',
        coinMultiplier: 1/5,
        gemMultiplier: 1/5,
        chance: 0.12, // Buffed from 0.01 to 0.12
        checkInterval: 1800000, // 30 minutes (buffed from 60 min)
        duration: 1200000, // 20 minutes
        description: 'Heavy storm reduces farming efficiency!',
        emoji: '🌧️'
    },
    TORNADO: {
        name: 'Tornado',
        coinMultiplier: 1/30,
        gemMultiplier: 1/30,
        chance: 0.06, // Buffed from 0.005 to 0.06
        checkInterval: 1800000, // 30 minutes (buffed from 60 min)
        duration: 300000, // 5 minutes
        description: 'Devastating tornado! Farming severely reduced!',
        emoji: '🌪️'
    },
    // NEW WEATHER EVENTS
    GOLDEN_HOUR: {
        name: 'Golden Hour',
        coinMultiplier: 50,
        gemMultiplier: 50,
        chance: 0.10,
        checkInterval: 1800000, // 30 minutes
        duration: 900000, // 15 minutes
        description: 'The golden hour shines upon your farm!',
        emoji: '✨'
    },
    METEOR_SHOWER: {
        name: 'Meteor Shower',
        coinMultiplier: 100,
        gemMultiplier: 100,
        chance: 0.05,
        checkInterval: 2700000, // 45 minutes
        duration: 600000, // 10 minutes
        description: 'Meteors rain down blessings!',
        emoji: '☄️'
    },
    BLOOD_MOON: {
        name: 'Blood Moon',
        coinMultiplier: 5,
        gemMultiplier: 25,
        chance: 0.08,
        checkInterval: 1800000, // 30 minutes
        duration: 1200000, // 20 minutes
        description: 'The crimson moon empowers gem production!',
        emoji: '🌕'
    },
    AURORA_BOREALIS: {
        name: 'Aurora Borealis',
        coinMultiplier: 30,
        gemMultiplier: 30,
        chance: 0.07,
        checkInterval: 2400000, // 40 minutes
        duration: 900000, // 15 minutes
        description: 'The northern lights dance across the sky!',
        emoji: '🌌'
    },
    SOLAR_FLARE: {
        name: 'Solar Flare',
        coinMultiplier: 75,
        gemMultiplier: 75,
        chance: 0.06,
        checkInterval: 2100000, // 35 minutes
        duration: 480000, // 8 minutes
        description: 'Intense solar energy supercharges your farm!',
        emoji: '☀️'
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
    'SOLAR_FLARE'
];

function isWeekend() {
    const day = new Date().getDay();
    // Weekend includes Friday (5), Saturday (6), Sunday (0)
    return day === 0 || day === 5 || day === 6;
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
    return weather?.checkInterval || 1800000; // Default 30 minutes
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