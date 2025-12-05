const videoEmbedBuilder = require('../Utility/videoEmbedBuilder');

async function validateUrl(interaction, url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await interaction.editReply({ 
            embeds: [videoEmbedBuilder.buildInvalidUrlEmbed()] 
        });
        return false;
    }
    return true;
}

module.exports = {
    validateUrl
};