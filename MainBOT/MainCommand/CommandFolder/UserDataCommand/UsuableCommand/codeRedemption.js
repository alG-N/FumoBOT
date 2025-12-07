const { Events } = require('discord.js');
const CodeRedemptionService = require('../../../Service/UserDataService/CodeRedemptionService/CodeRedemptionService');
const CodeRedemptionUI = require('../../../Service/UserDataService/CodeRedemptionService/CodeRedemptionUI');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../../Middleware/rateLimiter');

const COOLDOWN_MS = 3000;

async function handleCodeInfo(message) {
    const userId = message.author.id;
    const isAdmin = CodeRedemptionService.isAdmin(userId);

    const response = CodeRedemptionUI.createInfoEmbed(userId, isAdmin);
    return message.channel.send(response);
}

async function handleCodeRedemption(message, code) {
    const userId = message.author.id;

    const cooldownCheck = await checkAndSetCooldown(userId, 'code_redeem', COOLDOWN_MS);
    if (cooldownCheck.onCooldown) {
        return message.reply({
            content: `⏰ Please wait ${cooldownCheck.remaining}s before redeeming another code.`,
            allowedMentions: { repliedUser: false }
        });
    }

    const result = await CodeRedemptionService.redeemCode(code, userId);

    if (!result.success) {
        const errorEmbed = CodeRedemptionUI.createErrorEmbed(result.error, result.message);
        return message.channel.send({ embeds: [errorEmbed] });
    }

    const successEmbed = CodeRedemptionUI.createSuccessEmbed(code, result.rewards);
    await message.channel.send({ embeds: [successEmbed] });

    try {
        await message.author.send({ embeds: [successEmbed] });
    } catch (dmError) {
        // User has DMs disabled, ignore
    }
}

async function handleCodeList(message) {
    const userId = message.author.id;
    const response = await CodeRedemptionUI.createHistoryEmbed(userId);
    return message.channel.send(response);
}

async function handleAdminList(message) {
    const userId = message.author.id;

    if (!CodeRedemptionService.isAdmin(userId)) {
        return message.reply({
            content: '❌ You do not have permission to use this command.',
            allowedMentions: { repliedUser: false }
        });
    }

    const response = await CodeRedemptionUI.createAdminListEmbed(userId);
    return message.channel.send(response);
}

async function handleCodeStats(message, code) {
    const userId = message.author.id;

    if (!CodeRedemptionService.isAdmin(userId)) {
        return message.reply({
            content: '❌ You do not have permission to use this command.',
            allowedMentions: { repliedUser: false }
        });
    }

    if (!code) {
        return message.reply({
            content: '❌ Please specify a code to view statistics for.\nUsage: `.code stats <code>`',
            allowedMentions: { repliedUser: false }
        });
    }

    const response = await CodeRedemptionUI.createStatsEmbed(code);
    return message.channel.send(response);
}

function registerCodeRedemption(client) {
    client.on(Events.MessageCreate, async message => {
        if (message.author.bot) return;

        const content = message.content.trim();

        if (!content.startsWith('.code')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({
                embeds: [restriction.embed],
                allowedMentions: { repliedUser: false }
            });
        }

        // Now handle the command
        if (content === '.code') {
            return handleCodeInfo(message);
        }

        if (content.startsWith('.code ')) {
            const args = content.slice(6).trim().split(/\s+/);
            const subcommand = args[0]?.toLowerCase();

            switch (subcommand) {
                case 'list':
                case 'history':
                    return handleCodeList(message);

                case 'admin':
                    return handleAdminList(message);

                case 'stats':
                    return handleCodeStats(message, args[1]);

                default:
                    const code = args[0];
                    if (code) {
                        return handleCodeRedemption(message, code);
                    }
                    return handleCodeInfo(message);
            }
        }
    });

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isButton()) return;

        const restriction = checkRestrictions(interaction.user.id);
        if (restriction.blocked) {
            return interaction.reply({
                embeds: [restriction.embed],
                ephemeral: true
            });
        }

        if (interaction.customId.startsWith('code_')) {
            try {
                await CodeRedemptionUI.handleButtonInteraction(interaction);
            } catch (error) {
                console.error('[CODE_REDEMPTION] Button interaction error:', error);

                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ An error occurred. Please try again.',
                        ephemeral: true
                    }).catch(() => { });
                }
            }
        }
    });

    console.log('✅ Code redemption system registered');
}

module.exports = {
    registerCodeRedemption
};