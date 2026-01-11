const rarityLevels = [
    { name: 'Common', chance: 0.45, minStock: 5, maxStock: 10, emoji: '⚪' },
    { name: 'UNCOMMON', chance: 0.30, minStock: 4, maxStock: 8, emoji: '🟢' },
    { name: 'RARE', chance: 0.15, minStock: 3, maxStock: 6, emoji: '🔵' },
    { name: 'EPIC', chance: 0.06, minStock: 2, maxStock: 5, emoji: '🟣' },
    { name: 'OTHERWORLDLY', chance: 0.025, minStock: 2, maxStock: 4, emoji: '🌌' },
    { name: 'LEGENDARY', chance: 0.012, minStock: 1, maxStock: 3, emoji: '🟠' },
    { name: 'MYTHICAL', chance: 0.006, minStock: 1, maxStock: 2, emoji: '💫' },
    { name: 'EXCLUSIVE', chance: 0.003, minStock: 1, maxStock: 2, emoji: '💎' },
    { name: '???', chance: 0.002, minStock: 1, maxStock: 2, emoji: '❓' },
    { name: 'ASTRAL', chance: 0.001, minStock: 1, maxStock: 1, emoji: '🌠' },
    { name: 'CELESTIAL', chance: 0.0005, minStock: 1, maxStock: 1, emoji: '🌟' },
    { name: 'INFINITE', chance: 0.0003, minStock: 1, maxStock: 1, emoji: '♾️' },
    { name: 'ETERNAL', chance: 0.0001, minStock: 1, maxStock: 1, emoji: '🪐' },
    { name: 'TRANSCENDENT', chance: 0.00005, minStock: 1, maxStock: 1, emoji: '🌈' }
];

const gemShopRarityLevels = [
    { name: 'RARE', chance: 0.35, minStock: 2, maxStock: 4, emoji: '🔵' },
    { name: 'EPIC', chance: 0.25, minStock: 2, maxStock: 3, emoji: '🟣' },
    { name: 'OTHERWORLDLY', chance: 0.18, minStock: 1, maxStock: 3, emoji: '🌌' },
    { name: 'LEGENDARY', chance: 0.12, minStock: 1, maxStock: 2, emoji: '🟠' },
    { name: 'MYTHICAL', chance: 0.06, minStock: 1, maxStock: 2, emoji: '💫' },
    { name: 'EXCLUSIVE', chance: 0.025, minStock: 1, maxStock: 1, emoji: '💎' },
    { name: '???', chance: 0.012, minStock: 1, maxStock: 1, emoji: '❓' },
    { name: 'ASTRAL', chance: 0.006, minStock: 1, maxStock: 1, emoji: '🌠' },
    { name: 'CELESTIAL', chance: 0.003, minStock: 1, maxStock: 1, emoji: '🌟' },
    { name: 'INFINITE', chance: 0.0015, minStock: 1, maxStock: 1, emoji: '♾️' },
    { name: 'ETERNAL', chance: 0.0008, minStock: 1, maxStock: 1, emoji: '🪐' },
    { name: 'TRANSCENDENT', chance: 0.0002, minStock: 1, maxStock: 1, emoji: '🌈' }
];

const HIGH_RARITIES = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
const CELESTIAL_PLUS = ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

const COIN_MARKET_RESET_INTERVAL = 3600000;
const GEM_MARKET_RESET_INTERVAL = 21600000;
const COIN_MIN_SIZE = 5;
const COIN_MAX_SIZE = 7;
const GEM_MIN_SIZE = 7;
const GEM_MAX_SIZE = 9;

const GLOBAL_SHOP_CONFIG = {
    MAX_LISTINGS_PER_USER: 5,
    DISPLAY_COUNT: 5,
    TAX_RATE: 0.05
};

module.exports = {
    rarityLevels,
    gemShopRarityLevels,
    HIGH_RARITIES,
    CELESTIAL_PLUS,
    COIN_MARKET_RESET_INTERVAL,
    GEM_MARKET_RESET_INTERVAL,
    COIN_MIN_SIZE,
    COIN_MAX_SIZE,
    GEM_MIN_SIZE,
    GEM_MAX_SIZE,
    GLOBAL_SHOP_CONFIG
};