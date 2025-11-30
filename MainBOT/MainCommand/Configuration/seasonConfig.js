const SEASONS = {
    WEEKEND: {
        name: 'Weekend Season',
        coinMultiplier: 2,
        gemMultiplier: 2,
        description: '🎉 Double rewards for the weekend!',
        emoji: '🎊'
    },
    FESTIVAL_HARVEST: {
        name: 'Festival Harvest',
        coinMultiplier: 15,
        gemMultiplier: 15,
        chance: 0.005,
        checkInterval: 3600000, 
        duration: 1800000,
        description: '🌾 Bountiful harvest! Massive farming boost!',
        emoji: '🌾'
    },
    DAWN_DAYLIGHT: {
        name: 'Dawn Daylight',
        coinMultiplier: 350,
        gemMultiplier: 350,
        chance: 0.0001,
        checkInterval: 43200000, 
        duration: 600000, 
        description: '🌅 The legendary dawn has arrived!',
        emoji: '🌅'
    },
    STORMCHARGED: {
        name: 'Stormcharged',
        coinMultiplier: 1/15,
        gemMultiplier: 1/15,
        chance: 0.0005,
        checkInterval: 3600000, 
        duration: 900000,
        description: '⚡ Electrical interference reduces farming!',
        emoji: '⚡'
    },
    STORM: {
        name: 'Storm',
        coinMultiplier: 1/5,
        gemMultiplier: 1/5,
        chance: 0.01,
        checkInterval: 3600000, 
        duration: 1200000,
        description: '🌧️ Heavy storm reduces farming efficiency!',
        emoji: '🌧️'
    },
    TORNADO: {
        name: 'Tornado',
        coinMultiplier: 1/30,
        gemMultiplier: 1/30,
        chance: 0.005,
        checkInterval: 3600000, 
        duration: 300000,
        description: '🌪️ Devastating tornado! Farming severely reduced!',
        emoji: '🌪️'
    }
};

const WEATHER_EVENTS = [
    'FESTIVAL_HARVEST',
    'DAWN_DAYLIGHT',
    'STORMCHARGED',
    'STORM',
    'TORNADO'
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
    return weather?.checkInterval || 3600000;
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