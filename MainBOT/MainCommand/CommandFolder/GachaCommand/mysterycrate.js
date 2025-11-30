const { Events } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { parseMysteryCrateArgs } = require('../../Ultility/mysteryCrateParser');
const { createTutorialEmbed, createErrorEmbed } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateUIService');
const { validateCrateRequest, executeCrateGame } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateGameService');
const { handleCrateInteraction } = require('../../Service/GachaService/MysteryCrateService/mysteryCrateInteractionService');

module.exports = async (client) => {
    const activeSessions = new Map();

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

        if (activeSessions.has(userId)) {
            return message.reply('You already have an ongoing Mystery Crate session. Please complete it before starting another.');
        }

        const cooldownCheck = await checkAndSetCooldown(userId, 'mysterycrate', 3000);
        if (cooldownCheck.onCooldown) {
            return message.reply(`⏳ Please wait ${cooldownCheck.remaining}s before opening another crate.`);
        }

        const validation = await validateCrateRequest(userId, parsed.numCrates, parsed.betAmount, parsed.currency);
        if (!validation.success) {
            const errorEmbed = createErrorEmbed(validation.error, validation);
            return message.reply({ embeds: [errorEmbed] });
        }

        const gameResult = await executeCrateGame(
            userId,
            parsed.numCrates,
            parsed.betAmount,
            parsed.currency,
            validation.balance
        );

        if (!gameResult.success) {
            const errorEmbed = createErrorEmbed(gameResult.error);
            return message.reply({ embeds: [errorEmbed] });
        }

        activeSessions.set(userId, {
            numCrates: parsed.numCrates,
            betAmount: parsed.betAmount,
            currency: parsed.currency,
            crateResults: gameResult.crateResults
        });

        await handleCrateInteraction(
            message,
            userId,
            gameResult,
            activeSessions,
            client
        );
    });
};