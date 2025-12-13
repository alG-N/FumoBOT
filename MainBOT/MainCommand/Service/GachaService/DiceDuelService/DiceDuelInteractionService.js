const { Events } = require('discord.js');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { DICE_TIMEOUTS } = require('../../../Configuration/diceDuelConfig');
const { processDiceResult } = require('./DiceDuelGameService');
const {
    createResultEmbed,
    createPlayAgainButton,
    createTimeoutEmbed,
    createErrorEmbed
} = require('./DiceDuelUIService');

async function handleDiceInteraction(message, userId, gameResult, activeSessions, client, balance) {
    const { result, mode, betAmount, currency } = gameResult;

    const processResult = await processDiceResult(userId, result, betAmount, currency, balance);

    if (!processResult.success) {
        const errorEmbed = createErrorEmbed(processResult.error);
        await message.reply({ embeds: [errorEmbed] });
        activeSessions.delete(userId);
        return;
    }

    const resultEmbed = createResultEmbed(
        result,
        mode,
        betAmount,
        currency,
        message.author.username
    );

    const playAgainButton = createPlayAgainButton(userId);

    const msg = await message.reply({
        embeds: [resultEmbed],
        components: [playAgainButton]
    });

    handlePlayAgain(msg, userId, mode, betAmount, currency, activeSessions, client);
}

function handlePlayAgain(msg, userId, mode, betAmount, currency, activeSessions, client) {
    const playAgainCollector = msg.createMessageComponentCollector({
        filter: i => i.customId === `dice_play_again_${userId}`,
        max: 1,
        time: DICE_TIMEOUTS.PLAY_AGAIN
    });

    playAgainCollector.on('collect', async (interaction) => {
        if (!await checkButtonOwnership(interaction, 'dice_play_again', null, false)) {
            return;
        }

        await interaction.deferUpdate();
        activeSessions.delete(userId);

        const replayMessage = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            content: `.diceduel ${mode.toLowerCase()} ${betAmount} ${currency}`,
            reply: (options) => interaction.channel.send(options)
        };

        client.emit(Events.MessageCreate, replayMessage);
    });

    playAgainCollector.on('end', () => {
        activeSessions.delete(userId);
    });
}

module.exports = {
    handleDiceInteraction,
    handlePlayAgain
};