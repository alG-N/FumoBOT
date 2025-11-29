function verifyButtonOwnership(interaction, expectedAction = null) {
    const actualUserId = interaction.user.id;
    
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const claimedUserId = parts[1];
    
    if (expectedAction && action !== expectedAction) {
        return false;
    }
    
    return actualUserId === claimedUserId;
}

async function sendOwnershipError(interaction) {
    return interaction.reply({
        content: "❌ You can't use someone else's button. Use `.crategacha` yourself.",
        ephemeral: true
    });
}

async function checkButtonOwnership(interaction, expectedAction = null) {
    if (!verifyButtonOwnership(interaction, expectedAction)) {
        await sendOwnershipError(interaction);
        return false;
    }
    return true;
}

function getValidatedUserId(interaction) {
    return interaction.user.id;
}

function buildSecureCustomId(action, userId) {
    // Sanitize inputs
    const sanitizedAction = action.replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedUserId = userId.replace(/[^0-9]/g, '');
    
    return `${sanitizedAction}_${sanitizedUserId}`;
}

module.exports = {
    verifyButtonOwnership,
    sendOwnershipError,
    checkButtonOwnership,
    getValidatedUserId,
    buildSecureCustomId
};