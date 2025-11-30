const { checkRestrictions } = require('../../Middleware/restrictions');
const { parseAddFarmCommand } = require('../../Service/FarmingService/FarmingParserService');
const { addSingleFumo, addRandomByRarity } = require('../../Service/FarmingService/FarmingActionService');
const { createSuccessEmbed, createErrorEmbed } = require('../../Service/FarmingService/FarmingUIService');
const { logToDiscord, LogLevel } = require('../../Core/logger');

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.addfarm') && !message.content.startsWith('.af')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const input = message.content.replace(/^\.addfarm\s+|^\.af\s+/i, '').trim();
        
        if (!input) {
            return message.reply({
                embeds: [createErrorEmbed('Please specify a fumo name or rarity.\n\nUsage: `.addfarm <Name>(Rarity) [Tag]` or `.addfarm <Rarity>`')]
            });
        }

        const parsed = parseAddFarmCommand(input);

        if (!parsed.valid) {
            const errorMessages = {
                EMPTY_INPUT: 'Please provide a fumo name or rarity.',
                INVALID_FORMAT: 'Invalid format. Use `.addfarm <Name>(Rarity) [Tag]` or `.addfarm <Rarity>`',
                INVALID_QUANTITY: 'Please provide a valid quantity.'
            };

            return message.reply({
                embeds: [createErrorEmbed(errorMessages[parsed.error] || 'Invalid input.')]
            });
        }

        try {
            let result;

            if (parsed.type === 'RARITY') {
                result = await addRandomByRarity(message.author.id, parsed.rarity);
                
                if (!result.success) {
                    const errorMessages = {
                        FARM_FULL: `🚜 Your farm is full. Max ${result.limit} Fumos allowed.`,
                        NO_FUMOS_FOUND: `🔍 No available ${parsed.rarity} Fumos found in your inventory.`
                    };

                    return message.reply({
                        embeds: [createErrorEmbed(errorMessages[result.error] || 'Failed to add fumos.')]
                    });
                }

                await logToDiscord(
                    client,
                    `User ${message.author.tag} added ${result.added} random ${result.rarity} Fumos`,
                    null,
                    LogLevel.ACTIVITY
                );

                return message.reply({
                    embeds: [createSuccessEmbed(`Added ${result.added} ${result.rarity} Fumo(s) to your farm.`)]
                });

            } else {
                result = await addSingleFumo(message.author.id, parsed.fumoName);

                if (!result.success) {
                    const errorMessages = {
                        FARM_FULL: `🚜 Your farm is full. Max ${result.limit} Fumos allowed.`,
                        ALREADY_FARMING: `🚜 You're already farming a ${parsed.fumoName} Fumo.`,
                        NOT_IN_INVENTORY: `🔍 You don't have a ${parsed.fumoName} Fumo in your inventory.`
                    };

                    return message.reply({
                        embeds: [createErrorEmbed(errorMessages[result.error] || 'Failed to add fumo.')]
                    });
                }

                await logToDiscord(
                    client,
                    `User ${message.author.tag} added ${result.fumoName} to farm`,
                    null,
                    LogLevel.ACTIVITY
                );

                return message.reply({
                    embeds: [createSuccessEmbed(`${result.fumoName} Fumo added to your farm.`)]
                });
            }

        } catch (error) {
            console.error('Error in .addfarm:', error);
            await logToDiscord(client, `Error in .addfarm for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                embeds: [createErrorEmbed('⚠️ Something went wrong.')]
            });
        }
    });
};