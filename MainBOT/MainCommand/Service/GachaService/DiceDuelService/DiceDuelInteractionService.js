const { Events } = require('discord.js');
const { checkButtonOwnership, sendOwnershipError } = require('../../../Middleware/buttonOwnership');
const { DICE_TIMEOUTS } = require('../../../Configuration/diceDuelConfig');
const { processDiceResult } = require('./DiceDuelGameService');
const {
    createResultEmbed,
    createPlayAgainButton,
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

    const collector = msg.createMessageComponentCollector({
        filter: i => i.customId === `dice_play_again_${userId}`,
        max: 1,
        time: DICE_TIMEOUTS.PLAY_AGAIN
    });

    collector.on('collect', async (interaction) => {
        if (!checkButtonOwnership(interaction, 'dice_play_again')) {
            await sendOwnershipError(interaction);
            return;
        }

        await interaction.deferUpdate();
        
        await msg.edit({ components: [] }).catch(() => {});
        
        activeSessions.delete(userId);

        const replayMessage = {
            guild: interaction.guild,
            channel: interaction.channel,
            author: interaction.user,
            content: `.diceduel ${mode.toLowerCase()} ${betAmount} ${currency}`,
            reply: (options) => interaction.channel.send(options),
            mentions: {
                users: new Map(),
                roles: new Map(),
                everyone: false,
                repliedUser: null
            }
        };

        client.emit(Events.MessageCreate, replayMessage);
    });

    collector.on('end', async (collected, reason) => {
        activeSessions.delete(userId);
        await msg.edit({ components: [] }).catch(() => {});
    });
}

module.exports = {
    handleDiceInteraction
};