const { checkRestrictions } = require('../../Middleware/restrictions');
const { createFarmInfoEmbed } = require('../../Service/FarmingService/FarmingUIService');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.farminfo') && !message.content.startsWith('.fi')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const embed = createFarmInfoEmbed();
        return message.reply({ embeds: [embed] });
    });
};