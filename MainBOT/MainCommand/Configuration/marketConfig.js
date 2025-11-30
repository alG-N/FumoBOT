const rarityLevels = [
    { name: 'Common', chance: 0.35, minStock: 60, maxStock: 120, emoji: '⚪' },
    { name: 'UNCOMMON', chance: 0.22, minStock: 50, maxStock: 100, emoji: '🟢' },
    { name: 'RARE', chance: 0.13, minStock: 35, maxStock: 80, emoji: '🔵' },
    { name: 'EPIC', chance: 0.09, minStock: 25, maxStock: 60, emoji: '🟣' },
    { name: 'OTHERWORLDLY', chance: 0.06, minStock: 15, maxStock: 40, emoji: '🌌' },
    { name: 'LEGENDARY', chance: 0.045, minStock: 10, maxStock: 30, emoji: '🟠' },
    { name: 'MYTHICAL', chance: 0.025, minStock: 5, maxStock: 15, emoji: '💫' },
    { name: 'EXCLUSIVE', chance: 0.015, minStock: 5, maxStock: 12, emoji: '💎' },
    { name: '???', chance: 0.012, minStock: 4, maxStock: 10, emoji: '❓' },
    { name: 'ASTRAL', chance: 0.008, minStock: 3, maxStock: 8, emoji: '🌠' },
    { name: 'CELESTIAL', chance: 0.006, minStock: 3, maxStock: 6, emoji: '🌟' },
    { name: 'INFINITE', chance: 0.004, minStock: 2, maxStock: 5, emoji: '♾️' },
    { name: 'ETERNAL', chance: 0.003, minStock: 2, maxStock: 4, emoji: '🪐' },
    { name: 'TRANSCENDENT', chance: 0.002, minStock: 1, maxStock: 3, emoji: '🌈' }
];

const HIGH_RARITIES = ['???', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
const CELESTIAL_PLUS = ['CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];

const MARKET_RESET_INTERVAL = 3600000;
const MIN_MARKET_SIZE = 5;
const MAX_MARKET_SIZE_BASE = 7;
const MAX_MARKET_SIZE_RANGE = 6;

module.exports = {
    rarityLevels,
    HIGH_RARITIES,
    CELESTIAL_PLUS,
    MARKET_RESET_INTERVAL,
    MIN_MARKET_SIZE,
    MAX_MARKET_SIZE_BASE,
    MAX_MARKET_SIZE_RANGE
};