const VALID_RARITIES = [
    'Common', 'UNCOMMON', 'RARE', 'EPIC', 'OTHERWORLDLY', 'LEGENDARY',
    'MYTHICAL', 'EXCLUSIVE', '???', 'ASTRAL', 'CELESTIAL', 
    'INFINITE', 'ETERNAL', 'TRANSCENDENT'
];

const VALID_TRAITS = ['Base', 'SHINY', 'alG'];

function parseAddFarmCommand(input) {
    if (!input || typeof input !== 'string') {
        return { valid: false, error: 'EMPTY_INPUT' };
    }

    const trimmed = input.trim();

    // Check if it's just a rarity selection
    if (VALID_RARITIES.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'RARITY',
            rarity: VALID_RARITIES.find(r => r.toLowerCase() === trimmed.toLowerCase())
        };
    }

    // Check if it's a trait selection
    if (VALID_TRAITS.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'TRAIT',
            trait: VALID_TRAITS.find(t => t.toLowerCase() === trimmed.toLowerCase())
        };
    }

    // Parse full fumo name with quantity
    const match = trimmed.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z?]+)\))?(?:\[([^\]]+)\])?\s*(\d+)?$/);
    
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

    // Check if it's a rarity selection
    if (VALID_RARITIES.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'RARITY',
            rarity: VALID_RARITIES.find(r => r.toLowerCase() === trimmed.toLowerCase())
        };
    }

    // Check if it's a trait selection
    if (VALID_TRAITS.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
        return {
            valid: true,
            type: 'TRAIT',
            trait: VALID_TRAITS.find(t => t.toLowerCase() === trimmed.toLowerCase())
        };
    }

    // Parse full fumo name with quantity
    const match = trimmed.match(/^([a-zA-Z0-9]+)(?:\(([a-zA-Z?]+)\))?(?:\[([^\]]+)\])?\s*(\d+)?$/);
    
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

function parseTraitFromFumoName(fumoName) {
    if (fumoName.includes('[🌟alG]')) return 'alG';
    if (fumoName.includes('[✨SHINY]')) return 'SHINY';
    return 'Base';
}

function stripTraitFromFumoName(fumoName) {
    return fumoName.replace(/\[✨SHINY\]/g, '').replace(/\[🌟alG\]/g, '');
}

module.exports = {
    VALID_RARITIES,
    VALID_TRAITS,
    parseAddFarmCommand,
    parseEndFarmCommand,
    buildFumoKey,
    escapeRegex,
    createRegexForFumo,
    parseTraitFromFumoName,
    stripTraitFromFumoName
};