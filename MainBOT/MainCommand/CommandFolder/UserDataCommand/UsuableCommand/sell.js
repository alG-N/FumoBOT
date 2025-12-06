const SellService = require('../../../Service/UserDataService/SellService/SellService');

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.sell') && message.content !== '.s' && !message.content.startsWith('.s ')) return;

        const args = message.content.split(' ').slice(1);

        try {
            await SellService.handleSellCommand(message, args);
        } catch (error) {
            console.error('[Sell Command] Unexpected error:', error);
            message.reply('An unexpected error occurred. Please contact the developer.');
        }
    });
};