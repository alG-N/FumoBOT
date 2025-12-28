const coinBannerChances = {
    'TRANSCENDENT': '0.0000667%',
    'ETERNAL': '0.0002%',
    'INFINITE': '0.0005%',
    'CELESTIAL': '0.001111%',
    'ASTRAL': '0.003333%',
    '???': '0.006666%',
    'EXCLUSIVE': '0.02%',
    'MYTHICAL': '0.1%',
    'LEGENDARY': '0.4%',
    'OTHERWORLDLY': '1%',
    'EPIC': '6%',
    'RARE': '10%',
    'UNCOMMON': '25%',
    'Common': '57.4681233%',
};

const gemBannerChances = {
    'COMMON': '49%',
    'UNCOMMON': '30%',
    'RARE': '20%',
    '???': '1%',
    'TRANSCENDENT': '0.000000001%'
};

const ReimuChances = {
    'EPIC': '44.20%',
    'LEGENDARY': '19.89%',
    'OTHERWORLDLY': '14.36%',
    'MYTHICAL': '7.73%',
    'EXCLUSIVE': '5.52%',
    '???': '2.76%',
    'ASTRAL': '2.21%',
    'CELESTIAL': '1.66%',
    'INFINITE': '0.88%',
    'ETERNAL': '0.55%',
    'TRANSCENDENT': '0.22%'
};

const SUMMON_PLACES = {
    COINS_BANNER: 'Coins Banner',
    GEMS_BANNER: 'Gems Banner',
    REIMU_PRAYER: 'Reimus Prayer',
    MARKET: 'Market',
    CODE: 'Code',
    CRATE: 'Crate'
};

const VARIANT_CONFIG = {
    NORMAL: {
        tag: '',
        multiplier: 1,
        emoji: ''
    },
    SHINY: {
        tag: '[✨SHINY]',
        multiplier: 1 / 100,
        emoji: '✨'
    },
    ALG: {
        tag: '[🌟alG]',
        multiplier: 1 / 100000,
        emoji: '🌟'
    }
};

const INTERACTION_TIMEOUT = 60000;

module.exports = {
    coinBannerChances,
    gemBannerChances,
    ReimuChances,
    SUMMON_PLACES,
    VARIANT_CONFIG,
    INTERACTION_TIMEOUT
};