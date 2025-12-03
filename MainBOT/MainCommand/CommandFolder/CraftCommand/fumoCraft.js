const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        message.reply('🧸 Fumo crafting coming soon!');
    });
};