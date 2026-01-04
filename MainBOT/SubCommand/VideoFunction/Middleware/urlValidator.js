const videoEmbedBuilder = require('../Utility/videoEmbedBuilder');

/**
 * Validate a video URL
 * @param {Interaction} interaction 
 * @param {string} url 
 * @returns {Promise<boolean>}
 */
async function validateUrl(interaction, url) {
    // Basic protocol check
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        await interaction.editReply({ 
            embeds: [videoEmbedBuilder.buildInvalidUrlEmbed()] 
        });
        return false;
    }
    
    // Try to parse URL to ensure it's valid
    try {
        const parsedUrl = new URL(url);
        
        // Block obviously malicious URLs
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.', '172.'];
        if (blockedHosts.some(host => parsedUrl.hostname.includes(host))) {
            await interaction.editReply({ 
                embeds: [videoEmbedBuilder.buildInvalidUrlEmbed('Internal URLs are not allowed.')] 
            });
            return false;
        }
        
        // Block file:// and other dangerous protocols
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            await interaction.editReply({ 
                embeds: [videoEmbedBuilder.buildInvalidUrlEmbed('Only HTTP/HTTPS URLs are supported.')] 
            });
            return false;
        }
        
    } catch (error) {
        await interaction.editReply({ 
            embeds: [videoEmbedBuilder.buildInvalidUrlEmbed('The URL format is invalid.')] 
        });
        return false;
    }
    
    return true;
}

module.exports = {
    validateUrl
};