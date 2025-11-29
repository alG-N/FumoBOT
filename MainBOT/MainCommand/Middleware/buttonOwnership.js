const { debugLog } = require('../Core/logger');

function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    const parts = interaction.customId.split('_');
    
    if (parts.length < 2) {
        debugLog('BUTTON_OWNERSHIP', `Invalid customId format: ${interaction.customId}`);
        return false;
    }
    
    const claimedUserId = parts[parts.length - 1];
    const action = parts.slice(0, -1).join('_');
    
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

/**
 * Check button ownership without automatically sending error messages
 * Use this for collectors where you want to handle the response yourself
 */
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

function buildSecureCustomId(action, userId, additionalData = null) {
    const sanitizedAction = action.replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedUserId = userId.replace(/[^0-9]/g, '');
    
    let customId = `${sanitizedAction}_${sanitizedUserId}`;
    
    if (additionalData) {
        const encoded = Buffer.from(JSON.stringify(additionalData)).toString('base64');
        customId += `_${encoded}`;
    }
    
    if (customId.length > 100) {
        console.warn(`Custom ID too long (${customId.length} chars), truncating...`);
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
    
    if (parts.length === 2) {
        action = parts[0];
        userId = parts[1];
    } else if (parts.length === 3) {
        const lastPart = parts[2];
        if (/^\d+$/.test(lastPart)) {
            action = parts.slice(0, -1).join('_');
            userId = lastPart;
        } else {
            action = parts[0];
            userId = parts[1];
            try {
                additionalData = JSON.parse(Buffer.from(lastPart, 'base64').toString('utf8'));
            } catch (error) {
                debugLog('BUTTON_OWNERSHIP', `Failed to parse additional data: ${error.message}`);
            }
        }
    } else {
        let userIdIndex = -1;
        for (let i = parts.length - 1; i >= 0; i--) {
            if (/^\d+$/.test(parts[i])) {
                userIdIndex = i;
                break;
            }
        }
        
        if (userIdIndex === -1) {
            action = parts.join('_');
            userId = '';
        } else {
            action = parts.slice(0, userIdIndex).join('_');
            userId = parts[userIdIndex];
            
            if (userIdIndex < parts.length - 1) {
                try {
                    const dataStr = parts.slice(userIdIndex + 1).join('_');
                    additionalData = JSON.parse(Buffer.from(dataStr, 'base64').toString('utf8'));
                } catch (error) {
                    debugLog('BUTTON_OWNERSHIP', `Failed to parse additional data: ${error.message}`);
                }
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