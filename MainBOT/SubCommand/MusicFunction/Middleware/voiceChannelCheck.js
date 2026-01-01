const validators = require('../Utility/validators');
const trackHandler = require('../Handler/trackHandler');

async function checkVoiceChannel(interaction) {
    if (!validators.isInVoiceChannel(interaction.member)) {
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed("❌ No Voice Channel", "Join a voice channel first.")],
            ephemeral: true,
        });
        return false;
    }
    return true;
}

async function checkSameVoiceChannel(interaction, botChannelId) {
    if (!botChannelId) {
        return true;
    }

    if (!validators.isInSameVoiceChannel(interaction.member, botChannelId)) {
        await interaction.reply({
            ephemeral: true,
            content: "❌ You must be in the same voice channel as the bot to use these controls.",
        });
        return false;
    }
    return true;
}

async function checkVoicePermissions(interaction) {
    const voiceChannel = interaction.member.voice?.channel;
    
    if (!voiceChannel) {
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed("❌ No Voice Channel", "Join a voice channel first.")],
            ephemeral: true,
        });
        return false;
    }

    if (!validators.hasVoicePermissions(voiceChannel)) {
        await interaction.reply({
            embeds: [trackHandler.createInfoEmbed(
                "❌ Missing Permissions", 
                "I don't have permission to connect or speak in your voice channel."
            )],
            ephemeral: true,
        });
        return false;
    }

    return true;
}

module.exports = {
    checkVoiceChannel,
    checkSameVoiceChannel,
    checkVoicePermissions
};