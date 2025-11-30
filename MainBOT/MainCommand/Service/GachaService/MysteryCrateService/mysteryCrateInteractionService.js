const { Events } = require('discord.js');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { CRATE_TIMEOUTS } = require('../../../Configuration/mysteryCrateConfig');
const { processCrateSelection } = require('./mysteryCrateGameService');
const { getUserBalance } = require('../MysteryCrateService/mysteryCrateStorageService');
const {
    createCrateSelectionEmbed,
    createCrateButtons,
    createResultEmbed,
    createPlayAgainButton,
    createTimeoutEmbed,
    createErrorEmbed
} = require('./mysteryCrateUIService');

async function handleCrateInteraction(message, userId, gameResult, activeSessions, client) {
    const { crateResults, numCrates, betAmount, currency } = gameResult;

    const selectionEmbed = createCrateSelectionEmbed(
        message.author.username,
        message.author.displayAvatarURL({ dynamic: true })
    );

    const crateButtons = createCrateButtons(userId, numCrates);

    const msg = await message.channel.send({
        embeds: [selectionEmbed],
        components: crateButtons
    });

    const balance = await getUserBalance(userId, currency);

    const collector = msg.createMessageComponentCollector({
        filter: i => i.customId.startsWith('crate_') && i.customId.endsWith(`_${userId}`),
        max: 1,
        time: CRATE_TIMEOUTS.SELECTION
    });

    collector.on('collect', async (interaction) => {
        if (!await checkButtonOwnership(interaction, null, null, false)) {
            return;
        }

        const customIdParts = interaction.customId.split('_');
        const selectedIndex = parseInt(customIdParts[1], 10);

        const result = await processCrateSelection(
            userId,
            selectedIndex,
            crateResults,
            betAmount,
            currency,
            balance
        );

        if (!result.success) {
            const errorEmbed = createErrorEmbed(result.error);
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            activeSessions.delete(userId);
            return;
        }

        const resultEmbed = createResultEmbed(
            crateResults,
            selectedIndex,
            result.netReward,
            currency
        );

        const playAgainButton = createPlayAgainButton(userId);

        await interaction.update({
            embeds: [resultEmbed],
            components: [playAgainButton]
        });

        handlePlayAgain(msg, userId, numCrates, betAmount, currency, activeSessions, client);
    });

    collector.on('end', collected => {
        if (collected.size === 0) {
            const timeoutEmbed = createTimeoutEmbed();
            msg.edit({ embeds: [timeoutEmbed], components: [] });
            activeSessions.delete(userId);
        }
    });

    const blockCollector = msg.createMessageComponentCollector({
        filter: i => i.user.id !== userId,
        time: CRATE_TIMEOUTS.SELECTION
    });

    blockCollector.on('collect', async (i) => {
        await i.reply({ content: "⛔ This isn't your Mystery Crate session!", ephemeral: true });
    });
}

function handlePlayAgain(msg, userId, numCrates, betAmount, currency, activeSessions, client) {
    const playAgainCollector = msg.createMessageComponentCollector({
        filter: i => i.customId === `play_again_${userId}`,
        max: 1,
        time: CRATE_TIMEOUTS.PLAY_AGAIN
    });

    playAgainCollector.on('collect', async (interaction) => {
        if (!await checkButtonOwnership(interaction, 'play_again', null, false)) {
            return;
        }

        await interaction.deferUpdate();
        activeSessions.delete(userId);

        const replayMessage = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            content: `.mysterycrate ${numCrates} ${betAmount} ${currency}`,
            reply: (options) => interaction.channel.send(options)
        };

        client.emit(Events.MessageCreate, replayMessage);
    });

    playAgainCollector.on('end', () => {
        activeSessions.delete(userId);
    });
}

module.exports = {
    handleCrateInteraction,
    handlePlayAgain
};