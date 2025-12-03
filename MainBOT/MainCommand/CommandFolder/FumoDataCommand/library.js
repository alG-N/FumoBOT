const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const LibraryUIService = require('../../Service/FumoDataService/LibraryService/LibraryUIService');
const LibraryDataService = require('../../Service/FumoDataService/LibraryService/LibraryDataService');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        try {
            if (message.author.bot) return;
            if (!message.content.startsWith('.library') && !message.content.startsWith('.li')) return;

            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            const cooldown = await checkAndSetCooldown(message.author.id, 'library', 3000);
            if (cooldown.onCooldown) {
                return message.reply(`⏰ Please wait ${cooldown.remaining}s before checking your library again.`);
            }

            const libraryData = await LibraryDataService.getUserLibraryData(message.author.id);
            
            if (!libraryData) {
                return message.reply('❌ Failed to load library data. Please try again.');
            }

            await LibraryUIService.displayLibrary(message, libraryData);

        } catch (error) {
            console.error(`[Library Command Error] ${error.message}`);
            message.channel.send('❌ An error occurred while loading your library.');
        }
    });
};