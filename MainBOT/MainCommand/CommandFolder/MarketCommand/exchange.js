const { checkRestrictions } = require('../../Middleware/restrictions');
const { handleExchangeCommand, handleExchangeInteraction } = require('../../Service/MarketService/ExchangeService/ExchangeService');

module.exports = async (discordClient) => {
    discordClient.on('messageCreate', async message => {
        if (!message.guild || message.author.bot) return;

        const command = message.content.trim().split(/\s+/)[0].toLowerCase();
        if (command !== '.exchange' && command !== '.e') return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.trim().split(/\s+/).slice(1);
        await handleExchangeCommand(message, args);
    });

    discordClient.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        if (!interaction.customId.startsWith('exchange_')) return;

        await handleExchangeInteraction(interaction);
    });
};