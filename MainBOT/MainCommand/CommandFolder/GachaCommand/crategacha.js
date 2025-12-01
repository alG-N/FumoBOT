const { get } = require('../../Core/database');
const { logUserActivity, logError, logToDiscord } = require('../../Core/logger');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { verifyButtonOwnership } = require('../../Middleware/buttonOwnership');
const { getUserBoosts } = require('../../Service/GachaService/NormalGachaService/BoostService');
const { performSingleRoll, performMultiRoll } = require('../../Service/GachaService/NormalGachaService/CrateGachaRollService');
const { startAutoRoll, stopAutoRoll, isAutoRollActive } = require('../../Service/GachaService/NormalGachaService/CrateAutoRollService');
const {
    createShopEmbed,
    createShopButtons,
    displaySingleRollAnimation,
    displayMultiRollResults,
    createAutoRollSummary
} = require('../../Service/GachaService/NormalGachaService/CrateGachaUIService');

const { SPECIAL_RARITIES } = require('../../Configuration/rarity');
const FumoPool = require('../../Data/FumoPool');

async function handleSingleRoll(interaction, client) {
    try {
        const crateFumos = FumoPool.getForCrate();

        const result = await performSingleRoll(interaction.user.id, crateFumos);

        if (!result.success) {
            const errorMessages = {
                'INSUFFICIENT_COINS': 'You do not have enough coins to buy a fumo.',
                'NO_FUMO_FOUND': 'No Fumo found for this rarity. Please contact the developer.'
            };
            return await interaction.reply({
                content: errorMessages[result.error] || 'An error occurred.',
                ephemeral: true
            });
        }

        await displaySingleRollAnimation(interaction, result.fumo, result.rarity);

        if (SPECIAL_RARITIES.includes(result.rarity)) {
            await logUserActivity(
                client,
                interaction.user.id,
                interaction.user.tag,
                'Single Roll - Rare Drop',
                `Got **${result.fumo.name}** (${result.rarity})`
            );
        }

    } catch (err) {
        await logError(client, 'Single Roll', err, interaction.user.id);
        try {
            await interaction.reply({
                content: 'An error occurred while processing your fumo roll.',
                ephemeral: true
            });
        } catch { }
    }
}

async function handleMultiRoll(interaction, rollCount, client) {
    try {
        const crateFumos = FumoPool.getForCrate();

        const result = await performMultiRoll(interaction.user.id, crateFumos, rollCount);

        if (!result.success) {
            return await interaction.reply({
                content: `You do not have enough coins to buy ${rollCount} fumos.`,
                ephemeral: true
            });
        }

        await displayMultiRollResults(interaction, result.fumosBought, result.bestFumo, rollCount);

        await logToDiscord(
            client,
            `✅ User ${interaction.user.tag} rolled ${rollCount}x. Best: ${result.bestFumo?.name} (${result.bestFumo?.rarity})`
        );

    } catch (err) {
        await logError(client, `${rollCount}x Roll`, err, interaction.user.id);
        try {
            await interaction.reply({
                content: `An error occurred while processing your ${rollCount} fumo rolls.`,
                ephemeral: true
            });
        } catch { }
    }
}

async function handleAutoRollStart(interaction, client) {
    const userId = interaction.user.id;

    try {
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');

        const choiceRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`autoRollProceed_${userId}`)
                .setLabel('Proceed AutoRoll')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`autoRollAutoSell_${userId}`)
                .setLabel('Enable AutoSell')
                .setStyle(ButtonStyle.Success)
        );

        const choiceEmbed = new EmbedBuilder()
            .setTitle('🤖 Choose Your Auto Roll Mode')
            .setDescription('How would you like to proceed?\n\n- **Proceed AutoRoll**: Just auto roll as usual.\n- **Enable AutoSell**: Auto roll and automatically sell all fumos below EXCLUSIVE rarity for coins.\n⚠️ WARNING: THIS WILL AUTOMATICALLY USE ALL OF YOUR BOOST!')
            .setColor(Colors.Blue);

        await interaction.reply({
            embeds: [choiceEmbed],
            components: [choiceRow],
            ephemeral: true
        });

        const filter = i => {
            return verifyButtonOwnership(i);
        };

        const collector = interaction.channel.createMessageComponentCollector({
            filter,
            time: 15000,
            max: 1
        });

        collector.on('collect', async i => {
            if (!i.isButton()) return;
            
            try {
                if (!i.deferred && !i.replied) {
                    await i.deferUpdate().catch(err => {
                        console.warn('Failed to defer interaction (likely expired):', err.message);
                    });
                }
            } catch (deferError) {
                console.warn('Error deferring interaction:', deferError.message);
            }

            const autoSell = i.customId.startsWith('autoRollAutoSell_');

            const crateFumos = FumoPool.getForCrate();
            const result = await startAutoRoll(userId, crateFumos, autoSell);

            if (!result.success) {
                const responseMethod = i.deferred || i.replied ? 'followUp' : 'reply';
                
                return await i[responseMethod]({
                    embeds: [{
                        title: '⏳ Auto Roll Already Running',
                        description: 'You already have Auto Roll active!',
                        color: 0xffcc00
                    }],
                    ephemeral: true
                }).catch(err => {
                    console.warn('Failed to send error response:', err.message);
                });
            }

            const responseMethod = i.deferred || i.replied ? 'followUp' : 'reply';
            
            await i[responseMethod]({
                embeds: [{
                    title: autoSell ? '🤖 Auto Roll + AutoSell Started!' : '🎰 Auto Roll Started!',
                    description: autoSell
                        ? `Rolling every **${result.interval / 1000} seconds** and **auto-selling all fumos below EXCLUSIVE**.\nUse \`Stop Roll 100\` to cancel.`
                        : `Rolling every **${result.interval / 1000} seconds** indefinitely.\nUse \`Stop Roll 100\` to cancel.`,
                    color: 0x3366ff,
                    footer: { text: 'This will continue until you stop it manually.' }
                }],
                ephemeral: true
            }).catch(err => {
                console.warn('Failed to send success response:', err.message);
            });

            await logUserActivity(
                client,
                userId,
                interaction.user.tag,
                'Auto-Roll Started',
                `Mode: ${autoSell ? 'With AutoSell' : 'Normal'}, Interval: ${result.interval / 1000}s`
            );
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({
                    content: '⏱️ Auto Roll setup timed out.',
                    components: [],
                    embeds: []
                }).catch(err => {
                    console.warn('Failed to edit reply on timeout:', err.message);
                });
            }
        });

    } catch (err) {
        await logError(client, 'Auto-Roll Start', err, userId);
        
        const errorMessage = {
            content: '❌ An error occurred while setting up auto-roll. Please try again.',
            ephemeral: true
        };
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(errorMessage).catch(() => {});
        } else {
            await interaction.followUp(errorMessage).catch(() => {});
        }
    }
}

async function handleAutoRollStop(interaction, client) {
    const userId = interaction.user.id;

    const result = stopAutoRoll(userId);

    if (!result.success) {
        return await interaction.reply({
            embeds: [{
                title: '❌ No Active Auto Roll',
                description: "You currently don't have an auto-roll running.",
                color: 0xff4444,
                footer: { text: 'Auto Roll Status' },
                timestamp: new Date()
            }],
            ephemeral: true
        });
    }

    const summary = createAutoRollSummary(result.summary, userId);

    await interaction.reply({
        embeds: [summary.embed],
        components: summary.components,
        ephemeral: true
    });

    await logToDiscord(
        client,
        `🛑 User ${interaction.user.tag} stopped auto-roll. Total: ${result.summary.rollCount * 100} rolls`
    );
}

module.exports = (client) => {
    client.on('messageCreate', async message => {
        if (!message.content.startsWith('.crategacha') && !message.content.startsWith('.cg')) return;

        try {
            const restriction = checkRestrictions(message.author.id);
            if (restriction.blocked) {
                await logUserActivity(
                    client,
                    message.author.id,
                    message.author.tag,
                    'Access Denied',
                    restriction.embed.data.title === '🚧 Maintenance Mode' ? 'Maintenance mode' : 'Banned'
                );
                return message.reply({ embeds: [restriction.embed] });
            }

            const row = await get(
                `SELECT coins, boostCharge, boostActive, boostRollsRemaining, pityTranscendent, pityEternal, 
                 pityInfinite, pityCelestial, pityAstral, hasFantasyBook, rollsLeft, totalRolls
                 FROM userCoins WHERE userId = ?`,
                [message.author.id]
            );

            if (!row) {
                return message.reply({ content: 'You do not have any coins unfortunately..', ephemeral: true });
            }

            const hasFantasyBook = !!row.hasFantasyBook;
            const boosts = await getUserBoosts(message.author.id);
            const autoRollActive = isAutoRollActive(message.author.id);

            const embed = createShopEmbed(row, boosts, hasFantasyBook, autoRollActive);
            const buttons = createShopButtons(message.author.id, autoRollActive);

            await message.channel.send({ embeds: [embed], components: [buttons] });
            await logToDiscord(client, `📋 User ${message.author.tag} opened crate gacha shop`);

        } catch (err) {
            await logError(client, 'Message Handler', err, message.author.id);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        try {
            const userId = interaction.user.id;
            
            const parts = interaction.customId.split('_');
            const claimedUserId = parts[parts.length - 1];
            const action = parts.slice(0, -1).join('_');

            const crategachaActions = ['buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50', 'autoRollProceed', 'autoRollAutoSell'];
            if (!crategachaActions.includes(action)) {
                return;
            }

            if (!verifyButtonOwnership(interaction)) {
                return interaction.reply({
                    content: "❌ You can't use someone else's buttons. Run the command yourself.",
                    ephemeral: true
                });
            }

            if (['buy1fumo', 'buy10fumos', 'buy100fumos', 'autoRoll50', 'stopAuto50'].includes(action)) {
                const cooldown = await checkAndSetCooldown(userId, 'gacha');
                if (cooldown.onCooldown) {
                    return interaction.reply({
                        content: `🕒 Please wait ${cooldown.remaining}s before clicking again.`,
                        ephemeral: true
                    });
                }

                if (['buy1fumo', 'buy10fumos', 'buy100fumos'].includes(action) && isAutoRollActive(userId)) {
                    return interaction.reply({
                        content: '⚠️ You cannot manually roll while Auto Roll is active. Please stop it first.',
                        ephemeral: true
                    });
                }
            }

            switch (action) {
                case 'buy1fumo':
                    await handleSingleRoll(interaction, client);
                    break;

                case 'buy10fumos':
                    await handleMultiRoll(interaction, 10, client);
                    break;

                case 'buy100fumos':
                    await handleMultiRoll(interaction, 100, client);
                    break;

                case 'autoRoll50':
                    await handleAutoRollStart(interaction, client);
                    break;

                case 'stopAuto50':
                    await handleAutoRollStop(interaction, client);
                    break;

                default:
                    break;
            }

        } catch (err) {
            await logError(client, 'Interaction Handler', err, interaction.user?.id);

            const errorMsg = { content: 'An error occurred while processing your request.', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(errorMsg).catch(() => { });
            } else {
                await interaction.reply(errorMsg).catch(() => { });
            }
        }
    });
};