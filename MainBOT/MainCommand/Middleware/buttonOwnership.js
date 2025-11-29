const { debugLog } = require('../Core/logger');

function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const claimedUserId = parts[1];
    
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
    
    return interaction.reply({
        content: message,
        ephemeral: true
    });
}

async function checkButtonOwnership(interaction, expectedAction = null, customErrorMessage = null) {
    if (!verifyButtonOwnership(interaction, expectedAction)) {
        await sendOwnershipError(interaction, customErrorMessage);
        return false;
    }
    return true;
}

function getValidatedUserId(interaction) {
    return interaction.user.id;
}

function buildSecureCustomId(action, userId, additionalData = null) {
    const sanitizedAction = action.replace(/[^a-zA-Z0-9]/g, '');
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
    
    const result = {
        action: parts[0] || '',
        userId: parts[1] || '',
        additionalData: null
    };
    
    if (parts[2]) {
        try {
            result.additionalData = JSON.parse(
                Buffer.from(parts[2], 'base64').toString('utf8')
            );
        } catch (error) {
            debugLog('BUTTON_OWNERSHIP', `Failed to parse additional data: ${error.message}`);
        }
    }
    
    return result;
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