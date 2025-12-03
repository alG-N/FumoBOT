const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        message.reply('🌟 Blessing crafting coming soon!');
    });
};