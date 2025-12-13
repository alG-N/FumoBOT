const { debugLog } = require('../Core/logger');

const ID_REGEX = /^\d{17,19}$/;
const MAX_CUSTOM_ID_LENGTH = 100;

function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    const parts = interaction.customId.split('_');
    
    if (parts.length < 2) return false;
    
    let userIdIndex = -1;
    let claimedUserId = null;
    
    for (let i = parts.length - 1; i >= 0; i--) {
        if (ID_REGEX.test(parts[i])) {
            userIdIndex = i;
            claimedUserId = parts[i];
            break;
        }
    }
    
    if (!claimedUserId) {
        claimedUserId = parts[parts.length - 1];
        userIdIndex = parts.length - 1;
    }
    
    const action = parts.slice(0, userIdIndex).join('_');
    
    if (expectedAction && action !== expectedAction) return false;
    
    return actualUserId === claimedUserId;
}

async function sendOwnershipError(interaction, customMessage = null) {
    const message = customMessage || "❌ You can't use someone else's button. Run the command yourself.";
    
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
        } else {
            await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
        }
    } catch (error) {
        debugLog('BUTTON_OWNERSHIP', `Failed to send ownership error: ${error.message}`);
    }
}

function checkButtonOwnership(interaction, expectedAction = null) {
    return verifyButtonOwnership(interaction, expectedAction);
}

function getValidatedUserId(interaction) {
    return interaction.user.id;
}

const KEY_MAP = {
    fumoName: 'f', rarity: 'r', fumoId: 'id', userId: 'u',
    itemName: 'i', quantity: 'q', page: 'p', type: 't'
};

const REVERSE_KEY_MAP = Object.fromEntries(
    Object.entries(KEY_MAP).map(([k, v]) => [v, k])
);

function shortenDataKeys(data) {
    const shortened = {};
    for (const [key, value] of Object.entries(data)) {
        shortened[KEY_MAP[key] || key] = value;
    }
    return shortened;
}

function expandDataKeys(data) {
    if (typeof data !== 'object' || data === null) return data;
    
    const expanded = {};
    for (const [key, value] of Object.entries(data)) {
        expanded[REVERSE_KEY_MAP[key] || key] = value;
    }
    return expanded;
}

function buildSecureCustomId(action, userId, additionalData = null) {
    const sanitizedAction = action.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedUserId = userId.replace(/[^0-9]/g, '');
    
    let customId = `${sanitizedAction}_${sanitizedUserId}`;
    
    if (additionalData) {
        const shortened = shortenDataKeys(additionalData);
        const compactData = JSON.stringify(shortened);
        
        const currentLength = customId.length + 1;
        const availableSpace = MAX_CUSTOM_ID_LENGTH - currentLength;
        
        if (compactData.length <= availableSpace) {
            customId += `_${compactData}`;
        } else {
            const encoded = Buffer.from(compactData).toString('base64');
            
            if (currentLength + encoded.length <= MAX_CUSTOM_ID_LENGTH) {
                customId += `_${encoded}`;
            } else {
                console.warn(`[CUSTOM_ID] Data too large (needs ${currentLength + encoded.length}, max ${MAX_CUSTOM_ID_LENGTH})`);
                customId += `_${encoded.substring(0, availableSpace)}`;
            }
        }
    }
    
    if (customId.length > MAX_CUSTOM_ID_LENGTH) {
        console.warn(`Custom ID too long (${customId.length} chars), truncating...`);
        customId = customId.substring(0, MAX_CUSTOM_ID_LENGTH);
    }
    
    return customId;
}

function parseCustomId(customId) {
    const parts = customId.split('_');
    
    if (parts.length < 2) {
        return { action: parts[0] || '', userId: '', additionalData: null };
    }
    
    let userIdIndex = -1;
    
    for (let i = parts.length - 1; i >= 0; i--) {
        if (ID_REGEX.test(parts[i])) {
            userIdIndex = i;
            break;
        }
    }
    
    if (userIdIndex === -1) {
        userIdIndex = parts.length - 1;
    }
    
    const userId = parts[userIdIndex];
    const action = parts.slice(0, userIdIndex).join('_');
    let additionalData = null;
    
    if (userIdIndex < parts.length - 1) {
        const remaining = parts.slice(userIdIndex + 1).join('_');
        
        try {
            const decoded = Buffer.from(remaining, 'base64').toString('utf8');
            additionalData = expandDataKeys(JSON.parse(decoded));
        } catch {
            try {
                additionalData = expandDataKeys(JSON.parse(remaining));
            } catch {
                additionalData = remaining;
            }
        }
    }
    
    return { action: action || '', userId: userId || '', additionalData };
}

function createOwnershipMiddleware(expectedAction = null) {
    return async (interaction, next) => {
        const isValid = checkButtonOwnership(interaction, expectedAction);
        
        if (!isValid) {
            await sendOwnershipError(interaction);
            return false;
        }
        
        if (typeof next === 'function') {
            return next();
        }
        
        return true;
    };
}

function verifyInteractionUser(interaction, originalMessage) {
    return interaction.user.id === originalMessage.author.id;
}

module.exports = {
    verifyButtonOwnership,
    sendOwnershipError,
    checkButtonOwnership,
    getValidatedUserId,
    buildSecureCustomId,
    parseCustomId,
    createOwnershipMiddleware,
    verifyInteractionUser
};