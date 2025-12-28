const { checkRestrictions } = require('../../Middleware/restrictions');
const { selectRandomCharacter } = require('../../Configuration/prayConfig');
const {
    validatePrayRequest,
    trackUsage,
    addActiveSession,
    removeActiveSession
} = require('../../Service/PrayService/PrayValidationService');
const {
    createRitualWelcomeEmbed,
    createPrayButtons,
    disableButtons,
    createDeclineEmbed,
    createTimeoutEmbed,
    createCharacterEmbed,
    createActionButtons,
    createInfoEmbed
} = require('../../Service/PrayService/PrayUIService');
const { consumeTicket, consumeShards, getPrayRelevantItems } = require('../../Service/PrayService/PrayDatabaseService');
const { checkButtonOwnership } = require('../../Middleware/buttonOwnership');

const { handleYuyuko } = require('../../Service/PrayService/CharacterHandlers/YuyukoHandler');
const { handleYukari } = require('../../Service/PrayService/CharacterHandlers/YukariHandler');
const { handleReimu } = require('../../Service/PrayService/CharacterHandlers/ReimuHandler');
const { handleMarisa } = require('../../Service/PrayService/CharacterHandlers/MarisaHandler');
const { handleSakuya } = require('../../Service/PrayService/CharacterHandlers/SakuyaHandler');
const { handleSanae } = require('../../Service/PrayService/CharacterHandlers/SanaeHandler');

const BASIC_SHARDS = ['RedShard(L)', 'BlueShard(L)', 'YellowShard(L)', 'WhiteShard(L)', 'DarkShard(L)'];
const ENHANCED_SHARDS = {
    divineOrb: 'DivineOrb(D)',
    celestialEssence: 'CelestialEssence(D)'
};

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        const validCommands = ['.pray', '.p'];
        const isValidCommand = validCommands.some(cmd =>
            message.content === cmd || message.content.startsWith(cmd + ' ')
        );

        if (!isValidCommand || message.author.bot) return;

        const userId = message.author.id;

        try {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }

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

            const { hasBasicShards, hasEnhancedShards } = await getPrayRelevantItems(userId);

            const embed = createRitualWelcomeEmbed(hasBasicShards, hasEnhancedShards);
            const buttons = createPrayButtons(userId, hasBasicShards, hasEnhancedShards);
            const sentMessage = await message.channel.send({ 
                embeds: [embed], 
                components: [buttons] 
            });

            addActiveSession(userId);

            const filter = (interaction) => {
                const [action] = interaction.customId.split('_');
                return ['pray'].includes(action);
            };

            const collector = sentMessage.createMessageComponentCollector({ 
                filter, 
                time: 60000 
            });

            collector.on('collect', async (interaction) => {
                const isOwner = await checkButtonOwnership(interaction, null, null, true);
                if (!isOwner) return;

                const [, action, type] = interaction.customId.split('_');

                if (action === 'cancel') {
                    removeActiveSession(userId);
                    await interaction.update({
                        embeds: [createDeclineEmbed('the ritual')],
                        components: []
                    });
                    collector.stop('cancelled');
                    return;
                }

                if (action === 'basic' || action === 'enhanced') {
                    await interaction.deferUpdate();

                    const consumeOperations = [
                        consumeTicket(userId),
                        consumeShards(userId, BASIC_SHARDS)
                    ];

                    if (action === 'enhanced') {
                        consumeOperations.push(
                            consumeShards(userId, [
                                ENHANCED_SHARDS.divineOrb,
                                ...Array(5).fill(ENHANCED_SHARDS.celestialEssence)
                            ])
                        );
                    }

                    await Promise.all(consumeOperations);

                    const enhancedMode = action === 'enhanced';
                    trackUsage(userId);

                    const character = selectRandomCharacter(enhancedMode);

                    const characterEmbed = createCharacterEmbed(character, enhancedMode);
                    const characterButtons = createActionButtons(character.id, userId);
                    
                    await interaction.editReply({
                        embeds: [characterEmbed],
                        components: [characterButtons]
                    });

                    collector.stop('summoned');

                    const characterFilter = (i) => {
                        const [action] = i.customId.split('_');
                        return action === 'pray';
                    };

                    const characterCollector = sentMessage.createMessageComponentCollector({
                        filter: characterFilter,
                        time: 60000
                    });

                    characterCollector.on('collect', async (characterInteraction) => {
                        const isOwner = await checkButtonOwnership(characterInteraction, null, null, true);
                        if (!isOwner) return;

                        const [, action, characterId] = characterInteraction.customId.split('_');

                        if (action === 'decline') {
                            removeActiveSession(userId);
                            await characterInteraction.update({
                                embeds: [createDeclineEmbed(character.name)],
                                components: []
                            });
                            characterCollector.stop('declined');
                            return;
                        }

                        if (action === 'info') {
                            await characterInteraction.reply({
                                embeds: [createInfoEmbed(character)],
                                ephemeral: true
                            });
                            return;
                        }

                        if (action === 'accept') {
                            await characterInteraction.deferUpdate();
                            removeActiveSession(userId);

                            const disabledRow = disableButtons(characterButtons);
                            await characterInteraction.message.edit({ components: [disabledRow] });

                            characterCollector.stop('accepted');

                            try {
                                switch (character.id) {
                                    case 'yuyuko':
                                        await handleYuyuko(userId, message.channel);
                                        break;
                                    case 'yukari':
                                        await handleYukari(userId, message.channel);
                                        break;
                                    case 'reimu':
                                        await handleReimu(userId, message.channel, characterInteraction.user.id);
                                        break;
                                    case 'marisa':
                                        await handleMarisa(userId, message.channel);
                                        break;
                                    case 'sakuya':
                                        await handleSakuya(userId, message.channel);
                                        break;
                                    case 'sanae':
                                        await handleSanae(userId, message.channel);
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

                    characterCollector.on('end', (collected, reason) => {
                        removeActiveSession(userId);
                        
                        if (reason === 'time') {
                            const disabledRow = disableButtons(characterButtons);
                            message.channel.send({
                                embeds: [createTimeoutEmbed()]
                            });
                            sentMessage.edit({ components: [disabledRow] }).catch(() => {});
                        }
                    });
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