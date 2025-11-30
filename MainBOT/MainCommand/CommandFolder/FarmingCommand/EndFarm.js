const { checkRestrictions } = require('../../Middleware/restrictions');
const { parseEndFarmCommand } = require('../../Service/FarmingService/FarmingParserService');
const { removeAll, removeByRarity, removeByName } = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { logToDiscord, LogLevel } = require('../../Core/logger');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.endfarm') && !message.content.startsWith('.ef')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const input = message.content.replace(/^\.endfarm\s+|^\.ef\s+/i, '').trim();

        if (!input) {
            return message.reply({
                embeds: [createErrorEmbed(
                    'Please specify what to remove.\n\n' +
                    '• `.endfarm all` — Remove all Fumos\n' +
                    '• `.endfarm <Name>(<Rarity>)` — Remove specific Fumo\n' +
                    '• `.endfarm <Rarity>` — Remove all of a rarity'
                )]
            });
        }

        const parsed = parseEndFarmCommand(input);

        if (!parsed.valid) {
            const errorMessages = {
                EMPTY_INPUT: 'Please provide a fumo name or rarity.',
                INVALID_FORMAT: 'Invalid format. Use `.endfarm <Name>(<Rarity>)` or `.endfarm <Rarity>`',
                INVALID_QUANTITY: 'Please provide a valid quantity.'
            };

            return message.reply({
                embeds: [createErrorEmbed(errorMessages[parsed.error] || 'Invalid input.')]
            });
        }

        try {
            let result;

            if (parsed.type === 'ALL') {
                result = await removeAll(message.author.id);

                await logToDiscord(
                    client,
                    `User ${message.author.tag} removed all Fumos from farm`,
                    null,
                    LogLevel.ACTIVITY
                );

                return message.reply({
                    embeds: [createSuccessEmbed('Successfully removed all Fumos from the farm.')]
                });

            } else if (parsed.type === 'RARITY') {
                result = await removeByRarity(message.author.id, parsed.rarity);

                if (!result.success) {
                    return message.reply({
                        embeds: [createErrorEmbed(`No Fumos of rarity ${parsed.rarity} found in your farm.`)]
                    });
                }

                await logToDiscord(
                    client,
                    `User ${message.author.tag} removed all ${result.rarity} Fumos (${result.count} total)`,
                    null,
                    LogLevel.ACTIVITY
                );

                return message.reply({
                    embeds: [createSuccessEmbed(`Successfully removed ${result.count} ${result.rarity} Fumo(s) from the farm.`)]
                });

            } else {
                result = await removeByName(message.author.id, parsed.fumoName, parsed.quantity);

                if (!result.success) {
                    const errorMessages = {
                        NOT_IN_FARM: `No ${parsed.fumoName} variants found in your farm.`,
                        REMOVE_FAILED: `Failed to remove ${parsed.fumoName} from farm.`
                    };

                    return message.reply({
                        embeds: [createErrorEmbed(errorMessages[result.error] || 'Failed to remove fumo.')]
                    });
                }

                await logToDiscord(
                    client,
                    `User ${message.author.tag} removed ${result.quantity}x ${result.fumoName}`,
                    null,
                    LogLevel.ACTIVITY
                );

                return message.reply({
                    embeds: [createSuccessEmbed(`Successfully removed ${result.quantity} ${result.fumoName}(s) from the farm.`)]
                });
            }

        } catch (error) {
            console.error('Error in .endfarm:', error);
            await logToDiscord(client, `Error in .endfarm for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Unexpected error occurred. Try again later.')]
            });
        }
    });
};