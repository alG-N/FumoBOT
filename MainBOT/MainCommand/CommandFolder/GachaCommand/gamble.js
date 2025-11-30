const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const GambleService = require('../../Service/GachaService/GambleService/GambleService');
const GambleUIService = require('../../Service/GachaService/GambleService/GambleUIService');
const { GAMBLE_CONFIG } = require('../../Configuration/gambleConfig');

module.exports = (client) => {
    if (!client.activeGambles) {
        client.activeGambles = new Set();
    }

    client.on('messageCreate', async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!message.content.startsWith('.gamble') && !message.content.startsWith('.g')) return;

        const userId = message.author.id;

        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.trim().split(/\s+/);
        const mentionedUser = message.mentions.users.first();
        const currency = args[2]?.toLowerCase();
        const amount = parseInt(args[3], 10);

        if (!mentionedUser || !['coins', 'gems'].includes(currency) || isNaN(amount) || amount <= 0) {
            return message.reply({ embeds: [GambleUIService.createUsageEmbed()] });
        }

        if (mentionedUser.id === userId) {
            return message.reply({ 
                embeds: [GambleUIService.createErrorEmbed('SELF_GAMBLE')] 
            });
        }

        if (mentionedUser.bot) {
            return message.reply({ 
                embeds: [GambleUIService.createErrorEmbed('BOT_GAMBLE')] 
            });
        }

        const sessionKey = [userId, mentionedUser.id].sort().join('-');
        if (client.activeGambles.has(sessionKey)) {
            return message.reply('⚠️ There is already an active gamble between you two.');
        }

        const cooldown = await checkAndSetCooldown(userId, 'gamble');
        if (cooldown.onCooldown) {
            return message.reply(`⏰ Please wait ${cooldown.remaining}s before gambling again.`);
        }

        const validation = await GambleService.validateGambleRequest(
            userId, 
            mentionedUser.id, 
            currency, 
            amount
        );

        if (!validation.success) {
            return message.reply({ 
                embeds: [GambleUIService.createErrorEmbed(validation.error)] 
            });
        }

        client.activeGambles.add(sessionKey);
        
        try {
            await startGambleSession(
                message, 
                mentionedUser, 
                currency, 
                amount, 
                sessionKey, 
                client
            );
        } catch (error) {
            console.error('Gamble error:', error);
            message.reply('❌ An error occurred during the gamble.');
        } finally {
            client.activeGambles.delete(sessionKey);
        }
    });
};

async function startGambleSession(message, mentionedUser, currency, amount, sessionKey, client) {
    const inviteResult = await GambleUIService.sendInvitation(
        message.channel,
        message.author,
        mentionedUser,
        currency,
        amount
    );

    if (!inviteResult.accepted) return;

    await GambleUIService.showCardGuide(message.channel, GAMBLE_CONFIG.GUIDE_DURATION);

    const selections = await GambleUIService.collectCardSelections(
        message.channel,
        message.author,
        mentionedUser,
        sessionKey,
        GAMBLE_CONFIG.SELECTION_DURATION
    );

    const result = await GambleService.determineWinner(
        message.author.id,
        mentionedUser.id,
        selections.user1Card,
        selections.user2Card,
        currency,
        amount
    );

    await GambleUIService.displayResult(
        message.channel,
        message.author,
        mentionedUser,
        result,
        currency,
        amount
    );
}