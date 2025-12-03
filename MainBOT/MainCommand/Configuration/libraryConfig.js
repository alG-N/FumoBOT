const CATEGORIES = [
    'Common',
    'UNCOMMON',
    'RARE',
    'EPIC',
    'OTHERWORLDLY',
    'LEGENDARY',
    'MYTHICAL',
    'EXCLUSIVE',
    '???',
    'ASTRAL',
    'CELESTIAL',
    'INFINITE',
    'ETERNAL',
    'TRANSCENDENT'
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

const RARITY_EMOJIS = {
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

const COLLECTOR_TIMEOUT = 120000;

const ITEMS_PER_PAGE = 15;

const PROGRESS_BAR_LENGTH = 20;

const CACHE_TTL = 60000;

const MOTIVATIONAL_MESSAGES = {
    100: "🎉 Perfect Collection! You're a true collector!",
    90: "🔥 Almost there! Just a few more!",
    75: "⭐ Outstanding progress!",
    50: "💪 Halfway there! Keep going!",
    25: "🌟 Good start! Keep collecting!",
    0: "🚀 Your journey begins!"
};

function getMotivationalMessage(percentage) {
    for (const [threshold, message] of Object.entries(MOTIVATIONAL_MESSAGES).sort((a, b) => b[0] - a[0])) {
        if (percentage >= parseInt(threshold)) {
            return message;
        }
    }
    return MOTIVATIONAL_MESSAGES[0];
}

function getRarityColor(rarity) {
    return RARITY_COLORS[rarity] || 0x0099FF;
}

function getRarityEmoji(rarity) {
    return RARITY_EMOJIS[rarity] || '⚪';
}

module.exports = {
    CATEGORIES,
    RARITY_COLORS,
    RARITY_EMOJIS,
    COLLECTOR_TIMEOUT,
    ITEMS_PER_PAGE,
    PROGRESS_BAR_LENGTH,
    CACHE_TTL,
    MOTIVATIONAL_MESSAGES,
    
    getMotivationalMessage,
    getRarityColor,
    getRarityEmoji
};