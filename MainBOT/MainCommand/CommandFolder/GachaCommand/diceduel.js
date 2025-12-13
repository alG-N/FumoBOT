const { Events } = require('discord.js');
const { checkRestrictions } = require('../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../Middleware/rateLimiter');
const { parseDiceDuelArgs } = require('../../Ultility/diceDuelParser');
const { createTutorialEmbed, createErrorEmbed } = require('../../Service/GachaService/DiceDuelService/DiceDuelUIService');
const { validateDiceRequest, executeDiceGame } = require('../../Service/GachaService/DiceDuelService/DiceDuelGameService');
const { handleDiceInteraction } = require('../../Service/GachaService/DiceDuelService/DiceDuelInteractionService');

module.exports = async (client) => {
    const activeSessions = new Map();

    client.on(Events.MessageCreate, async (message) => {
        if (!message.guild || message.author.bot) return;
        
        const content = message.content.toLowerCase();
        if (!content.startsWith('.diceduel') && !content.startsWith('.dd')) return;

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

        const parsed = parseDiceDuelArgs(args);
        if (!parsed.valid) {
            const errorEmbed = createErrorEmbed(parsed.error, parsed);
            return message.reply({ embeds: [errorEmbed] });
        }

        if (activeSessions.has(userId)) {
            return message.reply('You already have an ongoing Dice Duel session. Please complete it first.');
        }

        const cooldownCheck = await checkAndSetCooldown(userId, 'diceduel', 3000);
        if (cooldownCheck.onCooldown) {
            return message.reply(`⏳ Please wait ${cooldownCheck.remaining}s before starting another duel.`);
        }

        const validation = await validateDiceRequest(userId, parsed.betAmount, parsed.currency);
        if (!validation.success) {
            const errorEmbed = createErrorEmbed(validation.error, validation);
            return message.reply({ embeds: [errorEmbed] });
        }

        const gameResult = await executeDiceGame(
            userId,
            parsed.mode,
            parsed.betAmount,
            parsed.currency,
            validation.balance
        );

        if (!gameResult.success) {
            const errorEmbed = createErrorEmbed(gameResult.error);
            return message.reply({ embeds: [errorEmbed] });
        }

        activeSessions.set(userId, {
            mode: parsed.mode,
            betAmount: parsed.betAmount,
            currency: parsed.currency,
            result: gameResult.result
        });

        await handleDiceInteraction(
            message,
            userId,
            gameResult,
            activeSessions,
            client,
            validation.balance
        );
    });
};