const { Client } = require('discord.js');
const { createClient } = require('../../Configuration/discord');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { selectRandomCharacter } = require('../../Configuration/prayConfig');
const {
    validatePrayRequest,
    trackUsage,
    addActiveSession,
    removeActiveSession
} = require('../../Service/PrayService/PrayValidationService');
const {
    createCharacterEmbed,
    createActionButtons,
    disableButtons,
    createDeclineEmbed,
    createTimeoutEmbed,
    createInfoEmbed
} = require('../../Service/PrayService/PrayUIService');
const { consumeTicket } = require('../../Service/PrayService/PrayDatabaseService');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');

// Character handlers
const { handleYuyuko } = require('../../Service/PrayService/CharacterHandlers/YuyukoHandler');
const { handleYukari } = require('../../Service/PrayService/CharacterHandlers/YukariHandler');
const { handleReimu } = require('../../Service/PrayService/CharacterHandlers/ReimuHandler');
const { handleMarisa } = require('../../Service/PrayService/CharacterHandlers/MarisaHandler');
const { handleSakuya } = require('../../Service/PrayService/CharacterHandlers/SakuyaHandler');

const client = createClient();
client.setMaxListeners(150);

module.exports = async (discordClient) => {
    discordClient.on('messageCreate', async (message) => {
        // Command validation
        const validCommands = ['.pray', '.p'];
        const isValidCommand = validCommands.some(cmd =>
            message.content === cmd || message.content.startsWith(cmd + ' ')
        );

        if (!isValidCommand || message.author.bot) return;

        const userId = message.author.id;

        try {
            // Check restrictions (maintenance/ban)
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

            // Validate pray request (session, ticket, limit)
            const validation = await validatePrayRequest(userId);
            if (!validation.valid) {
                const errorEmbeds = {
                    ACTIVE_SESSION: {
                        title: '🔒 Decision Pending',
                        description: 'You already have an ongoing offer! Please accept or decline it before praying again.',
                        color: '#ff0000'
                    },
                    NO_TICKET: {
                        title: '📿 Missing Prayer Ticket',
                        description: validation.message,
                        color: '#ff0000'
                    },
                    LIMIT_REACHED: {
                        title: '⚠️ Limit Reached',
                        description: validation.message,
                        color: '#ffcc00'
                    }
                };

                const errorConfig = errorEmbeds[validation.error];
                if (errorConfig) {
                    const { EmbedBuilder } = require('discord.js');
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setTitle(errorConfig.title)
                            .setDescription(errorConfig.description)
                            .setColor(errorConfig.color)
                            .setTimestamp()]
                    });
                }
                return;
            }

            // Consume ticket
            await consumeTicket(userId);

            // Track usage
            trackUsage(userId);

            // Select random character
            const character = selectRandomCharacter();

            // Create and send embed with buttons
            const embed = createCharacterEmbed(character);
            const buttons = createActionButtons(character.id, userId);
            const sentMessage = await message.channel.send({ 
                embeds: [embed], 
                components: [buttons] 
            });

            // Mark user as having active session
            addActiveSession(userId);

            // Create collector
            const filter = (interaction) => {
                const [action] = interaction.customId.split('_');
                return ['pray'].includes(action);
            };

            const collector = sentMessage.createMessageComponentCollector({ 
                filter, 
                time: 60000 
            });

            collector.on('collect', async (interaction) => {
                // Verify button ownership
                const isOwner = await checkButtonOwnership(interaction, null, null, true);
                if (!isOwner) return;

                const [, action, characterId] = interaction.customId.split('_');

                if (action === 'decline') {
                    removeActiveSession(userId);
                    await interaction.reply({
                        embeds: [createDeclineEmbed(character.name)]
                    });

                    const disabledRow = disableButtons(buttons);
                    await interaction.message.edit({ components: [disabledRow] });
                    collector.stop('declined');
                    return;
                }

                if (action === 'info') {
                    await interaction.reply({
                        embeds: [createInfoEmbed(character)],
                        ephemeral: true
                    });
                    return;
                }

                if (action === 'accept') {
                    await interaction.deferUpdate();
                    removeActiveSession(userId);

                    const disabledRow = disableButtons(buttons);
                    await interaction.message.edit({ components: [disabledRow] });

                    collector.stop('accepted');

                    // Route to appropriate handler
                    try {
                        switch (character.id) {
                            case 'yuyuko':
                                await handleYuyuko(userId, message.channel);
                                break;
                            case 'yukari':
                                await handleYukari(userId, message.channel);
                                break;
                            case 'reimu':
                                await handleReimu(userId, message.channel, interaction.user.id);
                                break;
                            case 'marisa':
                                await handleMarisa(userId, message.channel);
                                break;
                            case 'sakuya':
                                await handleSakuya(userId, message.channel);
                                break;
                            default:
                                await message.channel.send('❌ Unknown character handler.');
                        }
                    } catch (error) {
                        console.error(`[${character.name}] Handler Error:`, error);
                        message.channel.send("❌ An error occurred while processing your prayer.");
                    }
                }
            });

            collector.on('end', (collected, reason) => {
                removeActiveSession(userId);
                
                if (reason === 'time') {
                    const disabledRow = disableButtons(buttons);
                    message.channel.send({
                        embeds: [createTimeoutEmbed()]
                    });
                    sentMessage.edit({ components: [disabledRow] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('[Pray Command] Error:', error);
            removeActiveSession(userId);
            message.reply("❌ An error occurred while processing your prayer.");
        }
    });

    console.log('✅ Pray command loaded successfully');
};