const { checkRestrictions } = require('../../Middleware/restrictions');
const { optimizeFarm } = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { logToDiscord, LogLevel } = require('../../Core/logger');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.addbest') && !message.content.startsWith('.ab')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        try {
            const result = await optimizeFarm(message.author.id);

            if (!result.success) {
                return message.reply({
                    embeds: [createErrorEmbed('Failed to optimize your farm.')]
                });
            }

            await logToDiscord(
                client,
                `User ${message.author.tag} optimized farm with ${result.count} Fumos`,
                null,
                LogLevel.ACTIVITY
            );

            return message.reply({
                embeds: [createSuccessEmbed(`🌾 Optimized your farm with the ${result.count} best Fumo(s).`)]
            });

        } catch (error) {
            console.error('Error in .addbest:', error);
            await logToDiscord(client, `Error in .addbest for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong.')]
            });
        }
    });
};