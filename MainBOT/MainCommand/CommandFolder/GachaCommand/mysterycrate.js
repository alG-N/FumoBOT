const { Events } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { parseMysteryCrateArgs } = require('../../Ultility/mysteryCrateParser');
const { createTutorialEmbed, createErrorEmbed } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateUIService');
const { validateCrateRequest } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateGameService');
const { handleCrateSession } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateInteractionService');

module.exports = async (client) => {
    const activeSessions = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [userId, session] of activeSessions.entries()) {
            if (now - session.startTime > 300000) {
                activeSessions.delete(userId);
            }
        }
    }, 60000);

    client.on(Events.MessageCreate, async (message) => {
        if (!message.guild || message.author.bot) return;
        if (!message.content.toLowerCase().startsWith('.mysterycrate') &&
            !message.content.toLowerCase().startsWith('.mc')) return;

        const userId = message.author.id;

        const restriction = checkRestrictions(userId);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const args = message.content.trim().split(/\s+/).slice(1);

        if (args.length === 0) {
            const tutorialEmbed = createTutorialEmbed();
            return message.channel.send({ embeds: [tutorialEmbed] });
        }

        const parsed = parseMysteryCrateArgs(args);
        if (!parsed.valid) {
            const errorEmbed = createErrorEmbed(parsed.error, parsed);
            return message.reply({ embeds: [errorEmbed] });
        }

        const cooldownCheck = await checkAndSetCooldown(userId, 'mysterycrate', 2000);
        if (cooldownCheck.onCooldown) {
            return message.reply(`⏳ Please wait ${cooldownCheck.remaining}s before playing again.`);
        }

        const validation = await validateCrateRequest(userId, parsed.numCrates, parsed.betAmount, parsed.currency);
        if (!validation.success) {
            const errorEmbed = createErrorEmbed(validation.error, validation);
            return message.reply({ embeds: [errorEmbed] });
        }

        await handleCrateSession(
            message,
            userId,
            parsed.numCrates,
            parsed.betAmount,
            parsed.currency,
            activeSessions,
            client
        );
    });
};