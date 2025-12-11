const RARITY_ORDER = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY',
    'LEGENDARY', 'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL',
    'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const RARITY_COLORS = {
    'Common': 0x808080,
    'UNCOMMON': 0x00FF00,
    'RARE': 0x0099FF,
    'EPIC': 0x9933FF,
    'OTHERWORLDLY': 0x4B0082,
    'LEGENDARY': 0xFFAA00,
    'MYTHICAL': 0xFF0000,
    'EXCLUSIVE': 0xFF00FF,
    '???': 0x000000,
    'ASTRAL': 0x00FFFF,
    'CELESTIAL': 0xFFD700,
    'INFINITE': 0xC0C0C0,
    'ETERNAL': 0x8A2BE2,
    'TRANSCENDENT': 0xFFFFFF
};

const RARITY_EMOJI = {
    'Common': '⚪',
    'UNCOMMON': '🟢',
    'RARE': '🔵',
    'EPIC': '🟣',
    'OTHERWORLDLY': '🌌',
    'LEGENDARY': '🟠',
    'MYTHICAL': '🔴',
    'EXCLUSIVE': '💎',
    '???': '❓',
    'ASTRAL': '🌠',
    'CELESTIAL': '✨',
    'INFINITE': '♾️',
    'ETERNAL': '🪐',
    'TRANSCENDENT': '🌈'
};

const STORAGE_CONFIG = {
    ITEMS_PER_PAGE: 3,
    COLLECTOR_TIMEOUT: 180000,
    MAX_SEARCH_RESULTS: 50,
    CACHE_TTL: 60000,
    MAX_FUMO_STORAGE: 15000,
    STORAGE_WARNING_THRESHOLD: 0.9
};

const HIGH_TIER_RARITIES = [
    'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT', 'OTHERWORLDLY'
];

module.exports = {
    RARITY_ORDER,
    RARITY_COLORS,
    RARITY_EMOJI,
    STORAGE_CONFIG,
    HIGH_TIER_RARITIES
};