const VALID_RARITIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY',
    'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 
    'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

function parseAddFarmCommand(input) {
    if (!input || typeof input !== 'string') {
        return { valid: false, error: 'EMPTY_INPUT' };
    }

    const trimmed = input.trim();

    if (VALID_RARITIES.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'RARITY',
            rarity: VALID_RARITIES.find(r => r.toLowerCase() === trimmed.toLowerCase())
        };
    }

    const match = trimmed.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z]+)\))?(?:\s*\[([^\]]+)\])?\s*(\d+)?$/);
    
    if (!match) {
        return { valid: false, error: 'INVALID_FORMAT' };
    }

    const [, name, rarity, tag, quantityStr] = match;
    const quantity = parseInt(quantityStr, 10) || 1;

    if (quantity <= 0) {
        return { valid: false, error: 'INVALID_QUANTITY' };
    }

    const fumoKey = `${name}${rarity ? `(${rarity})` : ''}${tag ? `[${tag}]` : ''}`;

    return {
        valid: true,
        type: 'SPECIFIC',
        fumoName: fumoKey,
        quantity
    };
}

function parseEndFarmCommand(input) {
    if (!input || typeof input !== 'string') {
        return { valid: false, error: 'EMPTY_INPUT' };
    }

    const trimmed = input.trim();

    if (trimmed.toLowerCase() === 'all') {
        return { valid: true, type: 'ALL' };
    }

    if (VALID_RARITIES.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'RARITY',
            rarity: VALID_RARITIES.find(r => r.toLowerCase() === trimmed.toLowerCase())
        };
    }

    const match = trimmed.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z]+)\))?(?:\s*\[([^\]]+)\])?\s*(\d+)?$/);
    
    if (!match) {
        return { valid: false, error: 'INVALID_FORMAT' };
    }

    const [, name, rarity, tag, quantityStr] = match;
    const quantity = parseInt(quantityStr, 10) || 1;

    if (quantity <= 0) {
        return { valid: false, error: 'INVALID_QUANTITY' };
    }

    const fumoKey = `${name}${rarity ? `(${rarity})` : ''}${tag ? `[${tag}]` : ''}`;

    return {
        valid: true,
        type: 'SPECIFIC',
        fumoName: fumoKey,
        quantity
    };
}

function buildFumoKey(name, rarity, tag) {
    return `${name}${rarity ? `(${rarity})` : ''}${tag ? `[${tag}]` : ''}`;
}

function escapeRegex(str) {
    return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
}

function createRegexForFumo(name, rarity) {
    const escapedName = escapeRegex(name);
    const escapedRarity = escapeRegex(rarity);
    return new RegExp(`^${escapedName}\\(${escapedRarity}\\)(\\[.*\\])?$`);
}

module.exports = {
    VALID_RARITIES,
    parseAddFarmCommand,
    parseEndFarmCommand,
    buildFumoKey,
    escapeRegex,
    createRegexForFumo
};