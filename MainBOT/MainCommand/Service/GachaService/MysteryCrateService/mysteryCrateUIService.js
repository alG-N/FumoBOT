const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');
const { CRATE_LIMITS } = require('../../../Configuration/mysteryCrateConfig');

function createTutorialEmbed() {
    return new EmbedBuilder()
        .setTitle('🎰 Mystery Crate Tutorial 🎰')
        .setDescription(
            [
                "Welcome to the Mystery Crate game! Here's how to play:\n",
                "1️⃣ **Command Format:** `.mysteryCrate <number_of_crates> <bet_amount> <currency>`",
                `   - \`<number_of_crates>\`: Choose between **${CRATE_LIMITS.MIN_CRATES} and ${CRATE_LIMITS.MAX_CRATES}** crates.`,
                "   - \`<bet_amount>\`: Enter the amount you want to bet.",
                "   - \`<currency>\`: Specify `coins` or `gems`.\n",
                "2️⃣ **Example:** `.mysteryCrate 3 100 coins`\n",
                "3️⃣ **Goal:** Pick a crate and see if luck is on your side! 🎁\n",
                "May luck be in your favor!"
            ].join("\n")
        )
        .setColor(Colors.Gold)
        .setFooter({ text: 'Use the command to start playing!' });
}

function createCrateSelectionEmbed(username, avatarURL) {
    return new EmbedBuilder()
        .setTitle('🎰 Mystery Crate 🎰')
        .setDescription('Pick one of the crates to see your reward!')
        .setColor(Colors.Gold)
        .setFooter({ text: 'May luck be in your favor!', iconURL: avatarURL });
}

function createCrateButtons(userId, numCrates) {
    const rows = [];
    
    for (let i = 0; i < numCrates; i += 5) {
        const row = new ActionRowBuilder();
        
        for (let j = i; j < Math.min(i + 5, numCrates); j++) {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId(`crate_${j}`, userId))
                    .setLabel(`Crate ${j + 1}`)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        
        rows.push(row);
    }
    
    return rows;
}

function createResultEmbed(crateResults, selectedIndex, netReward, currency) {
    const resultMessages = crateResults.map((result, idx) =>
        `${result.emoji} Crate ${idx + 1}: ${result.description} → ${
            result.outcome.multiplier === -1
                ? `All ${currency} lost!`
                : `${formatNumber(result.reward)} ${currency}`
        }`
    );

    const selectedCrate = crateResults[selectedIndex];

    const embed = new EmbedBuilder()
        .setTitle('🎰 Mystery Crate Results 🎰')
        .setDescription(resultMessages.join('\n'))
        .addFields(
            {
                name: 'Your Choice:',
                value: `${selectedCrate.emoji} Crate ${selectedIndex + 1}: ${selectedCrate.description} → ${
                    selectedCrate.outcome.multiplier === -1
                        ? `All ${currency} lost!`
                        : `${formatNumber(selectedCrate.reward)} ${currency}`
                }`
            },
            {
                name: 'Net Result:',
                value: `${netReward >= 0 ? '✅ Profit' : '❌ Loss'} of ${formatNumber(Math.abs(netReward))} ${currency}`
            }
        )
        .setColor(netReward >= 0 ? Colors.Green : Colors.Red)
        .setTimestamp();

    return embed;
}

function createPlayAgainButton(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('play_again', userId))
            .setLabel('🔄 Play Again')
            .setStyle(ButtonStyle.Success)
    );
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        INSUFFICIENT_ARGS: '❌ Usage: `.mysteryCrate <number_of_crates> <bet_amount> <currency>`\nExample: `.mysteryCrate 3 100 coins`',
        INVALID_CRATE_COUNT: `❌ Please specify a valid number of crates (${CRATE_LIMITS.MIN_CRATES} to ${CRATE_LIMITS.MAX_CRATES}).`,
        INVALID_BET_AMOUNT: '❌ Please specify a valid bet amount.',
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        NO_ACCOUNT: `❌ You don't have any ${details.currency} yet. Earn some before playing!`,
        INSUFFICIENT_BALANCE: `❌ You don't have enough ${details.currency}. Your current balance is ${formatNumber(details.balance)} ${details.currency}.`,
        DATABASE_ERROR: '⚠️ An error occurred while retrieving your balance. Please try again later.',
        GAME_ERROR: '⚠️ An error occurred while starting the game. Please try again.',
        PROCESSING_ERROR: '⚠️ An error occurred while updating your balance.'
    };

    return new EmbedBuilder()
        .setDescription(errorMessages[errorType] || '❌ An unknown error occurred.')
        .setColor(Colors.Red);
}

function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setDescription('⏳ You took too long to pick a crate!')
        .setColor(Colors.Orange);
}

module.exports = {
    createTutorialEmbed,
    createCrateSelectionEmbed,
    createCrateButtons,
    createResultEmbed,
    createPlayAgainButton,
    createErrorEmbed,
    createTimeoutEmbed
};