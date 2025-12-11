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
    },
    // NEW: Ultra-rare glitched weather
    G1TCH3D: {
        name: 'G1tCh3D',
        coinMultiplier: 3500,
        gemMultiplier: 3500,
        chance: 1 / 1500000, 
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
        chance: 0.03,
        checkInterval: 3600000,
        duration: 420000,
        description: 'A void opens in space, draining all energy from your farm!',
        emoji: '🕳️'
    },
    TEMPORAL_COLLAPSE: {
        name: 'Temporal Collapse',
        coinMultiplier: 1/50,
        gemMultiplier: 1/75,
        chance: 0.05,
        checkInterval: 2700000,
        duration: 600000, 
        description: 'Time itself distorts, severely disrupting production!',
        emoji: '⏳'
    },
    PESTILENCE: {
        name: 'Pestilence',
        coinMultiplier: 1/7,
        gemMultiplier: 1/10,
        chance: 0.11,
        checkInterval: 1800000,
        duration: 1500000,
        description: 'A plague of locusts devours your crops!',
        emoji: '🦗'
    },
    DIVINE_ASCENSION: {
        name: 'Divine Ascension',
        coinMultiplier: 250,
        gemMultiplier: 250,
        chance: 0.04,
        checkInterval: 3600000,
        duration: 480000, 
        description: 'Divine beings bless your farm with otherworldly abundance!',
        emoji: '👼'
    }
};