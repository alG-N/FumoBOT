const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { parseBet } = require('../../Ultility/formatting');
const { getUserBalance, performSlotSpin } = require('../../Service/GachaService/SlotService/SlotGameService');
const { createTutorialEmbed, createErrorEmbed } = require('../../Service/GachaService/SlotService/SlotUIService');
const { playAnimationSequence, displayResult, handleButtonInteraction } = require('../../Service/GachaService/SlotService/SlotInteractionService');

module.exports = (client) => {
    const userBets = new Map();

    client.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.slot') && !message.content.startsWith('.sl')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.split(/\s+/).slice(1);
        const [currency, betStr] = args;

        if (!currency || !betStr) {
            try {
                const row = await getUserBalance(message.author.id);
                
                if (!row) {
                    return message.reply({
                        embeds: [createErrorEmbed('NO_ACCOUNT')]
                    });
                }

                return message.reply({ 
                    embeds: [createTutorialEmbed(row.coins, row.gems)] 
                });
            } catch (err) {
                console.error('[Slot] DB Error:', err);
                return message.reply({
                    embeds: [createErrorEmbed('DATABASE_ERROR')]
                });
            }
        }

        const cooldown = await checkAndSetCooldown(message.author.id, 'slot', 2000);
        if (cooldown.onCooldown) {
            return message.reply({
                content: `⏳ Please wait ${cooldown.remaining}s before spinning again.`,
                ephemeral: true
            }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 3000));
        }

        await executeSlotSpin(message, currency, betStr, 1, true, userBets);
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;

        const buttonAction = await handleButtonInteraction(interaction, userBets);
        if (!buttonAction || buttonAction.action === 'cancel') return;

        if (buttonAction.action === 'play') {
            await executeSlotSpin(
                interaction, 
                buttonAction.bet.currency, 
                buttonAction.bet.betStr, 
                buttonAction.spins,
                false,
                userBets
            );
        }
    });
};

async function executeSlotSpin(msgOrInt, currency, betStr, autoSpinCount, isTextCommand, userBets) {
    const userId = isTextCommand ? msgOrInt.author.id : msgOrInt.user.id;
    const bet = parseBet(betStr);

    const result = await performSlotSpin(userId, currency, bet, autoSpinCount);

    if (!result.success) {
        const errorEmbed = createErrorEmbed(result.error, { 
            minBet: result.minBet, 
            currency 
        });
        
        if (isTextCommand) {
            return msgOrInt.reply({ embeds: [errorEmbed] });
        } else {
            return msgOrInt.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    }

    await playAnimationSequence(msgOrInt, result.spinResult, isTextCommand);
    await displayResult(msgOrInt, result, isTextCommand);

    userBets.set(userId, { currency, betStr });
}