const RARITY_ORDER = ['Basic', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical', 'Divine', 'Secret', 'Unknown', 'Prime'];

const RARITY_SUFFIX_MAP = {
    '(B)': 'Basic',
    '(C)': 'Common',
    '(R)': 'Rare',
    '(E)': 'Epic',
    '(L)': 'Legendary',
    '(M)': 'Mythical',
    '(D)': 'Divine',
    '(?)': 'Secret',
    '(Un)': 'Unknown',
    '(P)': 'Prime'
};

const RARITY_TO_SUFFIX = Object.fromEntries(
    Object.entries(RARITY_SUFFIX_MAP).map(([suffix, rarity]) => [rarity, suffix])
);

const RARITY_COLORS = {
    'Basic': 0xC0C0C0,
    'Common': 0x808080,
    'Rare': 0x0099FF,
    'Epic': 0x9933FF,
    'Legendary': 0xFFAA00,
    'Mythical': 0xFF0000,
    'Divine': 0xFFFF66,
    'Secret': 0xFF00FF,
    'Unknown': 0x8B008B,   
    'Prime': 0xFFD700
};

const RARITY_EMOJI = {
    'Basic': '⚫',
    'Common': '⚪',
    'Rare': '🔵',
    'Epic': '🟣',
    'Legendary': '🟠',
    'Mythical': '🔴',
    'Divine': '✨',
    'Secret': '❓',
    'Unknown': '🌀',
    'Prime': '👑'
};

const PAGINATION = {
    ITEMS_PER_PAGE: 2,      
    INTERACTION_TIMEOUT: 300000, 
    AUTO_DELETE_TIMEOUT: 300000   
};

const ITEM_TYPES = {
    CONSUMABLE: 'consumable',
    MATERIAL: 'material',
    EQUIPMENT: 'equipment',
    QUEST: 'quest',
    SPECIAL: 'special'
};

const MAX_INVENTORY_SIZE = 1000;

function getRarityIndex(rarity) {
    return RARITY_ORDER.indexOf(rarity);
}

function compareRarities(rarity1, rarity2) {
    const idx1 = getRarityIndex(rarity1);
    const idx2 = getRarityIndex(rarity2);
    return idx1 - idx2;
}

function isRarer(rarity1, rarity2) {
    return compareRarities(rarity1, rarity2) > 0;
}

function getRarityFromItemName(itemName) {
    for (const [suffix, rarity] of Object.entries(RARITY_SUFFIX_MAP)) {
        if (itemName.endsWith(suffix)) {
            return rarity;
        }
    }
    return null;
}

function getRarityColor(rarity) {
    return RARITY_COLORS[rarity] || 0x808080;
}

function getRarityEmoji(rarity) {
    return RARITY_EMOJI[rarity] || '⚪';
}

module.exports = {
    RARITY_ORDER,
    RARITY_SUFFIX_MAP,
    RARITY_TO_SUFFIX,
    RARITY_COLORS,
    RARITY_EMOJI,
    PAGINATION,
    ITEM_TYPES,
    MAX_INVENTORY_SIZE,
    
    getRarityIndex,
    compareRarities,
    isRarer,
    getRarityFromItemName,
    getRarityColor,
    getRarityEmoji
};