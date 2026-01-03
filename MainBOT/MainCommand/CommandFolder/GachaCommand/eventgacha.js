const { EmbedBuilder } = require('discord.js');
const { get, run } = require('../../Core/database');
const { logToDiscord } = require('../../Core/logger');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { getValidatedUserId } = require('../../Middleware/buttonOwnership');
const {
    isEventActive,
    getRemainingTime,
    isWindowExpired,
    getRollResetTime,
    EVENT_COST_PER_ROLL
} = require('../../Configuration/eventConfig');
const {
    getEventUserBoosts,
    calculateEventLuckMultiplier,
    calculateEventChances,
    performEventSummon,
    getEventUserRollData
} = require('../../Service/GachaService/EventGachaService/EventGachaService');
const {
    createEventShopEmbed,
    createEventStatusEmbed,
    createEventShopButtons,
    createEventResultEmbed,
    createContinueButton,
    createEventAutoRollSummary
} = require('../../Service/GachaService/EventGachaService/EventGachaUIService');
const {
    startEventAutoRoll,
    stopEventAutoRoll,
    isEventAutoRollActive,
    getEventAutoRollMap
} = require('../../Service/GachaService/EventGachaService/EventAutoRollService');

const LOG_CHANNEL_ID = '1411386632589807719';

module.exports = (client) => {
    async function logEvent(message, type = 'info') {
        try {
            const channel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setDescription(message)
                .setTimestamp()
                .setColor(type === 'error' ? '#FF0000' : type === 'warning' ? '#FFA500' : '#00FF00');

            await channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('Failed to log to Discord:', err);
        }
    }

    client.on('messageCreate', async message => {
        const content = message.content.trim().toLowerCase();
        if (content !== '.eventgacha status' && content !== '.eg status') return;

        try {
            const userId = message.author.id;
            const userData = await getEventUserRollData(userId);

            if (!userData) {
                return message.reply('No data found. Use `.eventgacha` to start!');
            }

            const rollsLeft = userData.rollsLeft || 0;
            const boosts = await getEventUserBoosts(userId);
            const isBoostActive = boosts.ancient > 1 || boosts.mysterious > 1 || boosts.pet > 1;
            const totalLuckMultiplier = calculateEventLuckMultiplier(
                boosts,
                userData.luck,
                rollsLeft,
                isBoostActive
            );
            const chances = calculateEventChances(totalLuckMultiplier);

            const embed = createEventStatusEmbed(
                userData,
                boosts,
                chances,
                getRemainingTime(),
                getRollResetTime(userData.lastRollTime)
            );

            await message.reply({ embeds: [embed] });
        } catch (err) {
            await logEvent(`Status command error for ${message.author.id}: ${err.message}`, 'error');
            await message.reply('Error fetching your status.');
        }
    });

    client.on('messageCreate', async message => {
        const content = message.content.trim().toLowerCase();
        if (content !== '.eventgacha' && content !== '.eg') return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            await logEvent(
                `Blocked user ${message.author.id} (${message.author.tag}) - ${restriction.embed.data.title}`,
                'warning'
            );
            return message.reply({ embeds: [restriction.embed] });
        }

        if (!isEventActive()) {
            return message.reply('🎍 The New Year 2026 Banner has closed. Please wait for the next event!');
        }

        try {
            const userData = await getEventUserRollData(message.author.id);

            if (!userData) {
                return message.reply('You do not have any gems.');
            }

            if (!userData.hasFantasyBook) {
                return message.reply('You are not allowed to use this command until you enable **FantasyBook(M)**.');
            }

            let rollsInCurrentWindow = userData.rollsInCurrentWindow || 0;
            let lastRollTime = userData.lastRollTime || Date.now();

            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
                lastRollTime = Date.now();
                await run(
                    `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                    [lastRollTime, message.author.id]
                );
            }

            const rollsLeft = userData.rollsLeft || 0;
            const boosts = await getEventUserBoosts(message.author.id);
            const isBoostActive = boosts.ancient > 1 || boosts.mysterious > 1 || boosts.pet > 1;
            const totalLuckMultiplier = calculateEventLuckMultiplier(
                boosts,
                userData.luck,
                rollsLeft,
                isBoostActive
            );
            const chances = calculateEventChances(totalLuckMultiplier);

            const embed = createEventShopEmbed(
                { ...userData, rollsInCurrentWindow },
                boosts,
                chances,
                getRemainingTime()
            );

            const isAutoRollActive = isEventAutoRollActive(message.author.id);
            const rowButtons = createEventShopButtons(
                message.author.id,
                isAutoRollActive
            );

            await message.channel.send({ embeds: [embed], components: [rowButtons] });
        } catch (err) {
            await logEvent(`Main command error for ${message.author.id}: ${err.message}`, 'error');
            await message.reply('Database error. Please try again later.');
        }
    });

    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        const userId = getValidatedUserId(interaction);
        const action = interaction.customId.split('_')[0];

        const validButtons = [
            'eventbuy1fumo', 'eventbuy10fumos', 'eventbuy100fumos',
            'continue1', 'continue10', 'continue100',
            'startEventAuto', 'stopEventAuto'
        ];

        if (!validButtons.includes(action)) return;

        const expectedCustomId = `${action}_${userId}`;
        if (!interaction.customId.startsWith(expectedCustomId)) {
            return interaction.reply({
                content: "❌ You can't use someone else's button. Use `.eventgacha` yourself.",
                ephemeral: true
            });
        }

        if (!isEventActive()) {
            if (isEventAutoRollActive(userId)) {
                stopEventAutoRoll(userId);
            }
            return interaction.reply({
                content: '🎍 The New Year 2026 Banner has closed. All auto-rolls have been stopped.',
                ephemeral: true
            });
        }

        if (action === 'startEventAuto') {
            const cooldownCheck = await checkAndSetCooldown(userId, 'eventgacha');
            if (cooldownCheck.onCooldown) {
                return interaction.reply({
                    content: `🕒 Please wait ${cooldownCheck.remaining}s before clicking again.`,
                    ephemeral: true
                });
            }

            try {
                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');

                const choiceRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`eventAutoRollProceed_${userId}`)
                        .setLabel('Normal Auto Roll')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`eventAutoRollAutoSell_${userId}`)
                        .setLabel('Enable AutoSell')
                        .setStyle(ButtonStyle.Success)
                );

                const choiceEmbed = new EmbedBuilder()
                    .setTitle('🤖 Choose Your Event Auto Roll Mode')
                    .setDescription(
                        'How would you like to proceed?\n\n' +
                        '**Normal Auto Roll:**\n' +
                        '→ Rolls 100 fumos every 30 seconds\n' +
                        '→ Keeps all fumos\n\n' +
                        '**Enable AutoSell:**\n' +
                        '→ Rolls 100 fumos every 30 seconds\n' +
                        '→ **Automatically sells Common, Uncommon, Rare fumos for coins**\n' +
                        '→ Keeps ??? and TRANSCENDENT\n\n' +
                        '💎 Will continue until you run out of gems or stop manually'
                    )
                    .setColor(Colors.Blue);

                await interaction.reply({
                    embeds: [choiceEmbed],
                    components: [choiceRow],
                    ephemeral: true
                });

                const filter = i => i.user.id === userId &&
                    (i.customId === `eventAutoRollProceed_${userId}` || i.customId === `eventAutoRollAutoSell_${userId}`);

                const collector = interaction.channel.createMessageComponentCollector({
                    filter,
                    time: 15000,
                    max: 1
                });

                collector.on('collect', async i => {
                    await i.deferUpdate();
                    const autoSell = i.customId.startsWith('eventAutoRollAutoSell_');

                    const result = await startEventAutoRoll(userId, autoSell);

                    if (!result.success) {
                        const errorMessages = {
                            'ALREADY_RUNNING': 'Auto roll is already running!',
                            'NO_FANTASY_BOOK': 'You need FantasyBook(M) to use auto-roll.'
                        };
                        return await i.followUp({
                            content: errorMessages[result.error] || 'Failed to start auto-roll.',
                            ephemeral: true
                        });
                    }

                    return await i.followUp({
                        embeds: [{
                            title: autoSell ? '🤖 Event Auto Roll + AutoSell Started!' : '🤖 Event Auto Roll Started!',
                            description: autoSell
                                ? `Rolling **100 fumos every ${result.interval / 1000} seconds**\n` +
                                `💰 Auto-selling all **Common**, **Uncommon**, and **Rare** fumos for coins\n` +
                                `📦 Keeping: ???, TRANSCENDENT\n\n` +
                                `Use the 🛑 Stop button to cancel.`
                                : `Rolling **100 fumos every ${result.interval / 1000} seconds** until you run out of gems.\n\n` +
                                `Use the 🛑 Stop button to cancel.`,
                            color: autoSell ? 0x00AA00 : 0x00FF00,
                            footer: { text: autoSell ? 'Auto-sell: Common, Uncommon, Rare' : 'No roll limit - rolls until stopped or out of gems' }
                        }],
                        ephemeral: true
                    });
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({
                            content: '⏱️ Auto Roll setup timed out.',
                            components: [],
                            embeds: []
                        }).catch(() => { });
                    }
                });

                return;
            } catch (err) {
                await logEvent(`Auto-roll start error for ${userId}: ${err.message}`, 'error');
                return interaction.reply({
                    content: 'Failed to start auto-roll.',
                    ephemeral: true
                });
            }
        }

        if (action === 'stopEventAuto') {
            try {
                const result = stopEventAutoRoll(userId);

                if (!result.success) {
                    return interaction.reply({
                        content: 'You don\'t have an active auto-roll.',
                        ephemeral: true
                    });
                }

                const summary = createEventAutoRollSummary(result.summary, userId);

                return interaction.reply({
                    embeds: [summary.embed],
                    components: summary.components,
                    ephemeral: true
                });
            } catch (err) {
                await logEvent(`Auto-roll stop error for ${userId}: ${err.message}`, 'error');
                return interaction.reply({
                    content: 'Failed to stop auto-roll.',
                    ephemeral: true
                });
            }
        }

        const cooldownCheck = await checkAndSetCooldown(userId, 'eventgacha');
        if (cooldownCheck.onCooldown) {
            return interaction.reply({
                content: `🕒 Please wait ${cooldownCheck.remaining}s before clicking again.`,
                ephemeral: true
            });
        }

        if (isEventAutoRollActive(userId)) {
            return interaction.reply({
                content: '⚠️ You cannot manually roll while Auto Roll is active. Please stop it first.',
                ephemeral: true
            });
        }

        try {
            const userData = await getEventUserRollData(userId);
            if (!userData) {
                return interaction.reply({
                    content: 'User data not found. Please try again later.',
                    ephemeral: true
                });
            }

            let { rollsInCurrentWindow, lastRollTime } = userData;
            rollsInCurrentWindow = rollsInCurrentWindow || 0;
            lastRollTime = lastRollTime || Date.now();

            if (isWindowExpired(lastRollTime)) {
                rollsInCurrentWindow = 0;
                lastRollTime = Date.now();
                await run(
                    `UPDATE userCoins SET rollsInCurrentWindow = 0, lastRollTime = ? WHERE userId = ?`,
                    [lastRollTime, userId]
                );
            }

            await interaction.deferReply({ ephemeral: true });

            let numSummons;
            if (action === 'eventbuy1fumo' || action === 'continue1') numSummons = 1;
            else if (action === 'eventbuy10fumos' || action === 'continue10') numSummons = 10;
            else if (action === 'eventbuy100fumos' || action === 'continue100') numSummons = 100;
            else numSummons = 1;

            const result = await performEventSummon(userId, numSummons);

            if (!result.success) {
                const errorMessages = {
                    'INSUFFICIENT_GEMS': `Oops! It seems like you need more gems to unlock ${numSummons} fumos.`,
                    'NO_FANTASY_BOOK': 'You are not allowed to use this command until you enable **FantasyBook(M)**.'
                };
                return interaction.editReply({
                    content: errorMessages[result.error] || 'An error occurred during summoning.'
                });
            }

            const embed = createEventResultEmbed(
                result,
                numSummons,
                rollsInCurrentWindow + numSummons,
                getRollResetTime(lastRollTime)
            );

            const continueButton = createContinueButton(
                userId,
                numSummons
            );

            await interaction.editReply({ embeds: [embed], components: [continueButton] });

            await logEvent(
                `${userId} summoned ${numSummons} fumos. Total rolls: ${userData.totalRolls + numSummons}`,
                'info'
            );
        } catch (err) {
            await logEvent(`Button interaction error for ${userId}: ${err.message}`, 'error');

            const errorContent = {
                content: 'An error occurred. Please try again.',
                ephemeral: true
            };

            try {
                if (interaction.deferred) {
                    await interaction.editReply(errorContent);
                } else if (!interaction.replied) {
                    await interaction.reply(errorContent);
                }
            } catch (replyErr) {
                console.error('Failed to send error message:', replyErr);
            }
        }
    });

    setInterval(() => {
        if (!isEventActive()) {
            const autoRollMap = getEventAutoRollMap();
            if (autoRollMap.size > 0) {
                console.log(`Event ended - stopping ${autoRollMap.size} active auto-rolls`);
                for (const userId of autoRollMap.keys()) {
                    stopEventAutoRoll(userId);
                }
            }
        }
    }, 60000);
};