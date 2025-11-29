function verifyButtonOwnership(interaction, buttonOwnerId) {
    return interaction.user.id === buttonOwnerId;
}

async function sendOwnershipError(interaction) {
    return interaction.reply({
        content: "You can't use someone else's button. Use `.crategacha` yourself.",
        ephemeral: true
    });
}

async function checkButtonOwnership(interaction, buttonOwnerId) {
    if (!verifyButtonOwnership(interaction, buttonOwnerId)) {
        await sendOwnershipError(interaction);
        return false;
    }
    return true;
}

module.exports = {
    verifyButtonOwnership,
    sendOwnershipError,
    checkButtonOwnership
};