const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');
const { DICE_MODES, formatDiceRolls } = require('../../../Configuration/diceDuelConfig');

function createTutorialEmbed() {
    const modes = Object.entries(DICE_MODES).map(([key, config]) => 
        `${config.emoji} **${config.name}** - ${config.description}\n   Win: **x${config.winMultiplier}** your bet`
    ).join('\n\n');

    return new EmbedBuilder()
        .setTitle('🎲 Dice Duel Tutorial 🎲')
        .setDescription(
            `Roll dice against the house and win big!\n\n` +
            `**Usage:** \`.diceduel <mode> <bet> <currency>\`\n` +
            `**Example:** \`.diceduel medium 1000 coins\`\n\n` +
            `**Game Modes:**\n${modes}\n\n` +
            `**Rules:**\n` +
            `• Higher total wins\n` +
            `• Tie = bet returned\n` +
            `• Win = bet × multiplier`
        )
        .setColor(Colors.Gold)
        .setFooter({ text: 'May the dice be in your favor!' });
}

function createModeSelectionEmbed(username, avatarURL) {
    return new EmbedBuilder()
        .setTitle('🎲 Dice Duel - Choose Your Mode 🎲')
        .setDescription('Select a difficulty mode to begin!')
        .setColor(Colors.Gold)
        .setFooter({ text: `${username}, pick wisely!`, iconURL: avatarURL });
}

function createModeButtons(userId) {
    const rows = [];
    const modes = Object.entries(DICE_MODES);
    
    for (let i = 0; i < modes.length; i += 5) {
        const row = new ActionRowBuilder();
        
        for (let j = i; j < Math.min(i + 5, modes.length); j++) {
            const [key, config] = modes[j];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId(`dice_${key.toLowerCase()}`, userId))
                    .setLabel(`${config.name} (x${config.winMultiplier})`)
                    .setEmoji(config.emoji)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row);
    }
    
    return rows;
}

function createResultEmbed(result, mode, betAmount, currency, username) {
    const modeConfig = DICE_MODES[mode];
    
    const playerDice = formatDiceRolls(result.playerRolls);
    const houseDice = formatDiceRolls(result.houseRolls);
    
    let color, title, description;
    
    if (result.outcome === 'WIN') {
        color = Colors.Green;
        title = '🎉 YOU WIN! 🎉';
        description = `You rolled higher and won **${formatNumber(result.netChange)} ${currency}**!`;
    } else if (result.outcome === 'LOSS') {
        color = Colors.Red;
        title = '💔 YOU LOSE 💔';
        description = `The house rolled higher. You lost **${formatNumber(betAmount)} ${currency}**.`;
    } else {
        color = Colors.Orange;
        title = '🤝 TIE 🤝';
        description = `Both rolled the same! Your bet is returned.`;
    }

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .addFields(
            {
                name: `${username}'s Roll`,
                value: `${playerDice}\n**Total: ${result.playerTotal}**`,
                inline: true
            },
            {
                name: 'House Roll',
                value: `${houseDice}\n**Total: ${result.houseTotal}**`,
                inline: true
            },
            {
                name: 'Mode',
                value: `${modeConfig.emoji} ${modeConfig.name}\n**Multiplier: x${modeConfig.winMultiplier}**`,
                inline: false
            }
        )
        .setTimestamp();

    return embed;
}

function createPlayAgainButton(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('dice_play_again', userId))
            .setLabel('🔄 Play Again')
            .setStyle(ButtonStyle.Success)
    );
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        INSUFFICIENT_ARGS: '❌ Usage: `.diceduel <mode> <bet> <currency>`\nExample: `.diceduel medium 1000 coins`',
        INVALID_MODE: `❌ Invalid mode: \`${details.mode}\`\nValid modes: easy, medium, hard, extreme, legend`,
        INVALID_BET_AMOUNT: '❌ Please specify a valid bet amount.',
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        NO_ACCOUNT: `❌ You don't have any ${details.currency} yet.`,
        INSUFFICIENT_BALANCE: `❌ Not enough ${details.currency}. You have ${formatNumber(details.balance)} ${details.currency}.`,
        DATABASE_ERROR: '⚠️ Database error. Try again later.',
        GAME_ERROR: '⚠️ Game error. Try again.',
        PROCESSING_ERROR: '⚠️ Processing error. Try again.'
    };

    return new EmbedBuilder()
        .setDescription(errorMessages[errorType] || '❌ Unknown error.')
        .setColor(Colors.Red);
}

function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setDescription('⏳ You took too long to choose!')
        .setColor(Colors.Orange);
}

module.exports = {
    createTutorialEmbed,
    createModeSelectionEmbed,
    createModeButtons,
    createResultEmbed,
    createPlayAgainButton,
    createErrorEmbed,
    createTimeoutEmbed
};