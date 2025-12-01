const { debugLog } = require('../Core/logger');

function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    const parts = interaction.customId.split('_');
    
    if (parts.length < 2) {
        debugLog('BUTTON_OWNERSHIP', `Invalid customId format: ${interaction.customId}`);
        return false;
    }
    
    // Find the userId by looking for a part that's all digits
    let userIdIndex = -1;
    let claimedUserId = null;
    
    // Search from right to left for the first part that looks like a Discord user ID (all digits, 17-19 chars)
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
            userIdIndex = i;
            claimedUserId = parts[i];
            break;
        }
    }
    
    // If no valid userId found, fall back to last part (old behavior)
    if (!claimedUserId) {
        claimedUserId = parts[parts.length - 1];
        userIdIndex = parts.length - 1;
    }
    
    const action = parts.slice(0, userIdIndex).join('_');
    
    debugLog('BUTTON_OWNERSHIP', `Parsed: action="${action}", claimedUserId="${claimedUserId}", actualUserId="${actualUserId}"`);
    
    if (expectedAction && action !== expectedAction) {
        debugLog('BUTTON_OWNERSHIP', `Action mismatch: expected ${expectedAction}, got ${action}`);
        return false;
    }
    
    const isOwner = actualUserId === claimedUserId;
    
    if (!isOwner) {
        debugLog('BUTTON_OWNERSHIP', `Ownership failed: user ${actualUserId} tried to use ${claimedUserId}'s button`);
    }
    
    return isOwner;
}

async function sendOwnershipError(interaction, customMessage = null) {
    const message = customMessage || "❌ You can't use someone else's button. Run the command yourself.";
    
    try {
        if (interaction.replied || interaction.deferred) {
            return interaction.followUp({
                content: message,
                ephemeral: true
            });
        }
        
        return interaction.reply({
            content: message,
            ephemeral: true
        });
    } catch (error) {
        debugLog('BUTTON_OWNERSHIP', `Failed to send ownership error: ${error.message}`);
    }
}

async function checkButtonOwnership(interaction, expectedAction = null, customErrorMessage = null, autoReply = true) {
    const isValid = verifyButtonOwnership(interaction, expectedAction);
    
    if (!isValid && autoReply) {
        await sendOwnershipError(interaction, customErrorMessage);
    }
    
    return isValid;
}

function getValidatedUserId(interaction) {
    return interaction.user.id;
}

// Helper function to shorten data keys for compact custom IDs
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

// Helper to expand shortened keys back
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
        // Shorten the data keys first
        const shortened = shortenDataKeys(additionalData);
        const compactData = JSON.stringify(shortened);
        
        // Calculate remaining space (Discord limit is 100 chars)
        const maxLength = 100;
        const currentLength = customId.length + 1; // +1 for underscore
        const availableSpace = maxLength - currentLength;
        
        if (compactData.length <= availableSpace) {
            // Data fits without encoding, use plain JSON
            customId += `_${compactData}`;
        } else {
            // Try base64 encoding
            const encoded = Buffer.from(compactData).toString('base64');
            
            if (currentLength + encoded.length <= maxLength) {
                customId += `_${encoded}`;
            } else {
                // Data is too large even with base64
                console.warn(`[CUSTOM_ID] Data too large for customId (needs ${currentLength + encoded.length}, max ${maxLength})`);
                
                // Take only what fits
                const maxDataLength = availableSpace;
                const finalData = encoded.substring(0, maxDataLength);
                customId += `_${finalData}`;
            }
        }
    }
    
    // Final safety check
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
    
    // Find userId by searching for Discord ID pattern (17-19 digits)
    let userIdIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
        if (/^\d{17,19}$/.test(parts[i])) {
            userIdIndex = i;
            userId = parts[i];
            break;
        }
    }
    
    if (userIdIndex === -1) {
        // Fallback: assume last part is userId
        userIdIndex = parts.length - 1;
        userId = parts[userIdIndex];
    }
    
    action = parts.slice(0, userIdIndex).join('_');
    
    // Everything after userId is additional data
    if (userIdIndex < parts.length - 1) {
        const remaining = parts.slice(userIdIndex + 1).join('_');
        
        // Try to parse as base64 JSON first
        try {
            const decoded = Buffer.from(remaining, 'base64').toString('utf8');
            const parsed = JSON.parse(decoded);
            additionalData = expandDataKeys(parsed);
        } catch (error) {
            // Try parsing as plain JSON
            try {
                const parsed = JSON.parse(remaining);
                additionalData = expandDataKeys(parsed);
            } catch (error2) {
                // If both fail, treat as plain text
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
        const isValid = await checkButtonOwnership(interaction, expectedAction);
        
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