const { checkRestrictions } = require('../../Middleware/restrictions');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (message.content !== '.fumoCraft' && !message.content.startsWith('.fumoCraft ') &&
            message.content !== '.fc' && !message.content.startsWith('.fc ')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        message.reply('🧸 Fumo crafting coming soon!');
    });
};