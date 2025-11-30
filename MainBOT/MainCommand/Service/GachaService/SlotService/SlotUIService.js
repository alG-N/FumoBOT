const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { SLOT_CONFIG } = require('../../../Configuration/slotConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createTutorialEmbed(coins, gems) {
    return new EmbedBuilder()
        .setTitle('🎰 **Hosuh\'s Slot Machine** 🎰')
        .setColor(0xFFD700)
        .setDescription(`
**💎 Welcome to Hosuh's Casino!**
*Where Hosuh will happily take all your money 🎉*

🔸 **Your Balances:**
🪙 **Coins**: ${formatNumber(coins)}
💎 **Gems**: ${formatNumber(gems)}

💰 **Minimum Bets:**
- 🪙 **Coins**: 100k
- 💎 **Gems**: 10k

🎁 **Possible Rewards:**
- 7️⃣ **3x 7**: 50x Bet
- 💎 **3x Diamonds**: 25x Bet
- 🔔 **3x Bells**: 15x Bet
- 🍋 **3x Lemons**: 10x Bet
- 🍒 **3x Cherries**: 5x Bet
- 🍉 **3x Watermelons**: 3x Bet
- 🪙 **3x Coins**: 2x Bet
- 🔢 **2 Matching Symbols**: 1.5x Bet

🎲 **How to Play:**
Use: \`.slot <currency> <bet>\`
*Example: \`.slot coins 100k\`, \`.slot gems 10k\`*
        `)
        .setThumbnail('https://i.pinimg.com/1200x/00/7b/9f/007b9f17c7905f9a9e0d845ee0b116b8.jpg')
        .setImage('https://preview.redd.it/my-fumo-collection-so-far-all-authentic-v0-4b6o9g748ova1.jpg?width=640&crop=smart&auto=webp&s=6afe02354fd23eac68531c043815acdf65039846')
        .setFooter({
            text: '🎰 Good luck and have fun!',
            iconURL: 'https://preview.redd.it/lc4b8xugpqv91.png?auto=webp&s=892a5d0a53f30239c1a1e2bbed545f698dc7a5ea'
        });
}

function createAnimationEmbed(spinResult, step) {
    const descriptions = [
        `🎰 | ${spinResult[0]} - ❓ - ❓`,
        `🎰 | ${spinResult[0]} - ${spinResult[1]} - ❓`,
        `🎰 | ${spinResult.join(' - ')}`
    ];

    return new EmbedBuilder()
        .setDescription(descriptions[step])
        .setColor('#FFD700');
}

function createResultEmbed(result) {
    const { spinResult, winInfo, totalWin, currency } = result;

    const description = 
        `🎰 | ${spinResult.join(' - ')}\n\n${winInfo.message} ${
            totalWin > 0
                ? `🎉 WON ${formatNumber(totalWin)} ${currency}!`
                : '😞 Better luck next time!'
        }`;

    return new EmbedBuilder()
        .setDescription(description)
        .setColor('#FFD700');
}

function createPlayAgainButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('playAgain')
            .setLabel('Play Again')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('autoSpin')
            .setLabel('Auto Spin x5')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        INVALID_BET: '🤔 Your bet must be a positive number.',
        NO_ACCOUNT: '😞 You do not have an account yet. Please register first.',
        BELOW_MINIMUM: `😞 You need at least ${formatNumber(details.minBet || 0)} ${details.currency || 'currency'} to play.`,
        INSUFFICIENT_BALANCE: `😞 Not enough ${details.currency || 'currency'} for this bet. Try a smaller amount.`,
        DATABASE_ERROR: '⚠️ Database error. Please try again later.'
    };

    return new EmbedBuilder()
        .setDescription(errorMessages[errorType] || errorMessages.DATABASE_ERROR)
        .setColor('Red');
}

module.exports = {
    createTutorialEmbed,
    createAnimationEmbed,
    createResultEmbed,
    createPlayAgainButtons,
    createErrorEmbed
};