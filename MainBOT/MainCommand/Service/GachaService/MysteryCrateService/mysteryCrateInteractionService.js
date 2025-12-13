const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { CRATE_LIMITS, CRATE_TIMEOUTS } = require('../../../Configuration/mysteryCrateConfig');
const { executeCrateGame, processCrateSelection, generateSessionStats } = require('./mysteryCrateGameService');
const { getUserBalance } = require('./mysteryCrateStorageService');
const {
    createGameEmbed,
    createCrateButtons,
    createResultEmbed,
    createActionButtons,
    createSessionStatsEmbed,
    createErrorEmbed
} = require('./mysteryCrateUIService');

async function handleCrateSession(message, userId, numCrates, betAmount, currency, activeSessions, client) {
    const session = activeSessions.get(userId) || {
        games: [],
        winStreak: 0,
        totalWon: 0,
        totalLost: 0,
        biggestWin: 0,
        startTime: Date.now(),
        currentBet: betAmount,
        currentCrates: numCrates
    };

    if (session.games.length >= CRATE_LIMITS.MAX_SESSION_GAMES) {
        const errorEmbed = createErrorEmbed('SESSION_LIMIT', { limit: CRATE_LIMITS.MAX_SESSION_GAMES });
        return message.reply({ embeds: [errorEmbed] });
    }

    const balance = await getUserBalance(userId, currency);
    const gameResult = await executeCrateGame(userId, numCrates, betAmount, currency, balance);

    if (!gameResult.success) {
        const errorEmbed = createErrorEmbed(gameResult.error);
        return message.reply({ embeds: [errorEmbed] });
    }

    const gameEmbed = createGameEmbed(
        gameResult.tier,
        numCrates,
        betAmount,
        currency,
        message.author.username,
        message.author.displayAvatarURL({ dynamic: true }),
        gameResult.specialEvent,
        gameResult.comboBonus
    );

    const crateButtons = createCrateButtons(userId, numCrates);

    const msg = await message.channel.send({
        embeds: [gameEmbed],
        components: crateButtons
    });

    const collector = msg.createMessageComponentCollector({
        filter: i => i.customId.startsWith('crate_pick_') && i.user.id === userId,
        max: 1,
        time: CRATE_TIMEOUTS.SELECTION
    });

    collector.on('collect', async (interaction) => {
        if (!checkButtonOwnership(interaction)) {
            return interaction.reply({ content: "⛔ This isn't your game!", ephemeral: true });
        }

        await interaction.deferUpdate().catch(err => {
            console.error('[Mystery Crate] Failed to defer update:', err);
        });

        try {
            const selectedIndex = parseInt(interaction.customId.split('_')[2]);

            const selectedCrate = gameResult.crateResults[selectedIndex];
            selectedCrate.specialEvent = gameResult.specialEvent;

            const processResult = await processCrateSelection(
                userId,
                selectedIndex,
                gameResult.crateResults,
                betAmount,
                currency,
                balance,
                session
            );

            if (!processResult.success) {
                const errorEmbed = createErrorEmbed(processResult.error);
                return interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
            }

            session.games.push({
                betAmount,
                won: processResult.won,
                netChange: processResult.netChange,
                timestamp: Date.now()
            });
            session.winStreak = processResult.newWinStreak;
            session.currentBet = betAmount;
            session.currentCrates = numCrates;

            if (processResult.won) {
                session.totalWon += Math.abs(processResult.netChange);
                if (processResult.netChange > session.biggestWin) {
                    session.biggestWin = processResult.netChange;
                }
            } else {
                session.totalLost += Math.abs(processResult.netChange);
            }

            activeSessions.set(userId, session);

            const resultEmbed = createResultEmbed(
                selectedCrate,
                gameResult.tier,
                betAmount,
                currency,
                message.author.username,
                message.author.displayAvatarURL({ dynamic: true }),
                processResult
            );

            const hasBalance = processResult.newBalance >= betAmount;
            const actionButtons = createActionButtons(userId, hasBalance);

            await interaction.editReply({ 
                embeds: [resultEmbed], 
                components: [actionButtons] 
            }).catch(err => {
                console.error('[Mystery Crate] Failed to update message:', err);
            });

            handleSessionActions(msg, userId, currency, session, activeSessions, client);

        } catch (error) {
            console.error('[Mystery Crate] Error processing crate selection:', error);
            const errorEmbed = createErrorEmbed('PROCESSING_ERROR');
            await interaction.editReply({ 
                embeds: [errorEmbed], 
                components: [] 
            }).catch(() => {});
        }
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            msg.edit({
                embeds: [createErrorEmbed('TIMEOUT')],
                components: []
            }).catch(() => { });
            activeSessions.delete(userId);
        }
    });

    const blockCollector = msg.createMessageComponentCollector({
        filter: i => i.user.id !== userId,
        time: CRATE_TIMEOUTS.SELECTION
    });

    blockCollector.on('collect', async (i) => {
        await i.reply({ content: "⛔ This isn't your Mystery Crate session!", ephemeral: true }).catch(() => {});
    });
}

function handleSessionActions(msg, userId, currency, session, activeSessions, client) {
    const collector = msg.createMessageComponentCollector({
        filter: i => i.customId.startsWith('crate_') && i.user.id === userId,
        time: CRATE_TIMEOUTS.NEXT_GAME
    });

    collector.on('collect', async (interaction) => {
        if (!checkButtonOwnership(interaction)) {
            return interaction.reply({ content: "⛔ This isn't your game!", ephemeral: true }).catch(() => {});
        }

        const action = interaction.customId.split('_')[1];

        switch (action) {
            case 'again':
                await interaction.deferUpdate().catch(err => {
                    console.error('[Mystery Crate] Failed to defer play again:', err);
                });

                try {
                    const balance = await getUserBalance(userId, currency);
                    if (balance < session.currentBet) {
                        await interaction.followUp({
                            content: `❌ Insufficient balance. You need ${formatNumber(session.currentBet)} ${currency}.`,
                            ephemeral: true
                        }).catch(() => {});
                        break;
                    }

                    await handleCrateSession(
                        {
                            guild: interaction.guild,
                            channel: interaction.channel,
                            author: interaction.user,
                            reply: (options) => interaction.channel.send(options)
                        },
                        userId,
                        session.currentCrates,
                        session.currentBet,
                        currency,
                        activeSessions,
                        client
                    );
                } catch (error) {
                    console.error('[Mystery Crate] Error playing again:', error);
                }
                break;

            case 'change':
                await interaction.reply({
                    content: `💰 Enter new bet: \`.mysterycrate <crates> <amount> ${currency}\``,
                    ephemeral: true
                }).catch(() => {});
                activeSessions.delete(userId);
                break;

            case 'stats':
                const stats = generateSessionStats(session);
                const statsEmbed = createSessionStatsEmbed(
                    stats,
                    currency,
                    interaction.user.username,
                    interaction.user.displayAvatarURL({ dynamic: true })
                );
                await interaction.reply({ embeds: [statsEmbed], ephemeral: true }).catch(() => {});
                break;

            case 'quit':
                activeSessions.delete(userId);
                const stats2 = generateSessionStats(session);
                const finalEmbed = createSessionStatsEmbed(
                    stats2,
                    currency,
                    interaction.user.username,
                    interaction.user.displayAvatarURL({ dynamic: true })
                );
                await interaction.update({ embeds: [finalEmbed], components: [] }).catch(() => {});
                collector.stop();
                break;
        }
    });

    collector.on('end', () => {
        if (activeSessions.has(userId)) {
            activeSessions.delete(userId);
        }
    });
}

function formatNumber(num) {
    return num.toLocaleString();
}

module.exports = {
    handleCrateSession,
    handleSessionActions
};