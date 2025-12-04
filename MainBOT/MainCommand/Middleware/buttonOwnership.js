const { debugLog } = require('../Core/logger');

function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    const parts = interaction.customId.split('_');
    
    if (parts.length < 2) {
        return false;
    }
    
    let userIdIndex = -1;
    let claimedUserId = null;
    
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
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
    
    if (expectedAction && action !== expectedAction) {
        return false;
    }
    
    return actualUserId === claimedUserId;
}

async function sendOwnershipError(interaction, customMessage = null) {
    const message = customMessage || "❌ You can't use someone else's button. Run the command yourself.";
    
    try {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
                content: message,
                ephemeral: true
            }).catch(() => {});
        }
        
        return interaction.reply({
            content: message,
            ephemeral: true
        }).catch(() => {});
    } catch (error) {
        debugLog('BUTTON_OWNERSHIP', `Failed to send ownership error: ${error.message}`);
    }
}

function checkButtonOwnership(interaction, expectedAction = null, customErrorMessage = null) {
    return verifyButtonOwnership(interaction, expectedAction);
}

function getValidatedUserId(interaction) {
    return interaction.user.id;
}

function shortenDataKeys(data) {
    const keyMap = {
        'fumoName': 'f',
        'rarity': 'r',
        'fumoId': 'id',
        'userId': 'u',
        'itemName': 'i',
        'quantity': 'q',
        'page': 'p',
        'type': 't'
    };
    
    const shortened = {};
    for (const [key, value] of Object.entries(data)) {
        const shortKey = keyMap[key] || key;
        shortened[shortKey] = value;
    }
    
    return shortened;
}

function expandDataKeys(data) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    
    const keyMap = {
        'f': 'fumoName',
        'r': 'rarity',
        'id': 'fumoId',
        'u': 'userId',
        'i': 'itemName',
        'q': 'quantity',
        'p': 'page',
        't': 'type'
    };
    
    const expanded = {};
    for (const [key, value] of Object.entries(data)) {
        const fullKey = keyMap[key] || key;
        expanded[fullKey] = value;
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
        
        const maxLength = 100;
        const currentLength = customId.length + 1; 
        const availableSpace = maxLength - currentLength;
        
        if (compactData.length <= availableSpace) {
            customId += `_${compactData}`;
        } else {
            const encoded = Buffer.from(compactData).toString('base64');
            
            if (currentLength + encoded.length <= maxLength) {
                customId += `_${encoded}`;
            } else {
                console.warn(`[CUSTOM_ID] Data too large for customId (needs ${currentLength + encoded.length}, max ${maxLength})`);
                
                const maxDataLength = availableSpace;
                const finalData = encoded.substring(0, maxDataLength);
                customId += `_${finalData}`;
            }
        }
    }
    
    if (customId.length > 100) {
        console.warn(`Custom ID still too long (${customId.length} chars), hard truncating...`);
        customId = customId.substring(0, 100);
    }
    
    return customId;
}

function parseCustomId(customId) {
    const parts = customId.split('_');
    
    if (parts.length < 2) {
        return {
            action: parts[0] || '',
            userId: '',
            additionalData: null
        };
    }
    
    let userId, action, additionalData = null;
    
    let userIdIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
            userIdIndex = i;
            userId = parts[i];
            break;
        }
    }
    
    if (userIdIndex === -1) {
        userIdIndex = parts.length - 1;
        userId = parts[userIdIndex];
    }
    
    action = parts.slice(0, userIdIndex).join('_');
    
    if (userIdIndex < parts.length - 1) {
        const remaining = parts.slice(userIdIndex + 1).join('_');
        try {
            const decoded = Buffer.from(remaining, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            additionalData = expandDataKeys(parsed);
        } catch (error) {
            try {
                const parsed = JSON.parse(remaining);
                additionalData = expandDataKeys(parsed);
            } catch (error2) {
                additionalData = remaining;
            }
        }
    }
    
    return {
        action: action || '',
        userId: userId || '',
        additionalData
    };
}

function createOwnershipMiddleware(expectedAction = null) {
    return async (interaction, next) => {
        const isValid = checkButtonOwnership(interaction, expectedAction);
        
        if (isValid && typeof next === 'function') {
            return next();
        }
        
        return isValid;
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