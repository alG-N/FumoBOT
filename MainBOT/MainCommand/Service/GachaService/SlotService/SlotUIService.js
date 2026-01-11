const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { SLOT_CONFIG } = require('../../../Configuration/gamblingConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createTutorialEmbed(coins, gems) {
    return new EmbedBuilder()
        .setTitle('🎰 **Hosuh\'s Slot Machine** 🎰')
        .setColor(0xFFD700)
        .setDescription(`
**💎 Welcome to Hosuh's Casino!**
*Where the house always has an edge 🎰*

🔸 **Your Balances:**
🪙 **Coins**: ${formatNumber(coins)}
💎 **Gems**: ${formatNumber(gems)}

💰 **Bet Limits:**
- 🪙 **Coins**: 100k - 10M
- 💎 **Gems**: 10k - 1M

🎁 **Possible Rewards:**
- 7️⃣ **3x 7**: 10x Bet (JACKPOT!)
- 💎 **3x Diamonds**: 5x Bet
- 🔔 **3x Bells**: 3x Bet
- 🍋 **3x Lemons**: 2x Bet
- 🍒 **3x Cherries**: 1.5x Bet
- 🍉 **3x Watermelons**: 1x Bet (Break Even)
- 🪙 **3x Coins**: 0.5x Bet
- 🔢 **2 Matching**: No Payout

🎲 **How to Play:**
Use: \`.slot <currency> <bet>\`
*Example: \`.slot coins 100k\`, \`.slot gems 10k\`*

⚠️ **Remember: The house always wins in the long run!**
        `)
        .setThumbnail('https://i.pinimg.com/1200x/00/7b/9f/007b9f17c7905f9a9e0d845ee0b116b8.jpg')
        .setImage('https://preview.redd.it/my-fumo-collection-so-far-all-authentic-v0-4b6o9g748ova1.jpg?width=640&crop=smart&auto=webp&s=6afe02354fd23eac68531c043815acdf65039846')
        .setFooter({
            text: '🎰 Gamble responsibly!',
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
    const { spinResult, winInfo, totalWin, totalBet, netProfit, spinsCompleted, currency } = result;

    let description = `🎰 | ${spinResult.join(' - ')}\n\n${winInfo.message}`;
    
    if (spinsCompleted > 1) {
        description += `\n\n📊 **Auto-Spin Summary (${spinsCompleted} spins)**`;
        description += `\n💰 Total Bet: ${formatNumber(totalBet)} ${currency}`;
        description += `\n🎁 Total Won: ${formatNumber(totalWin)} ${currency}`;
        description += netProfit >= 0 
            ? `\n✅ **Net Profit: +${formatNumber(netProfit)} ${currency}** 🎉`
            : `\n❌ **Net Loss: ${formatNumber(netProfit)} ${currency}** 😞`;
    } else {
        description += totalWin > 0
            ? `\n\n🎉 **WON ${formatNumber(totalWin)} ${currency}!**`
            : '\n\n😞 Better luck next time!';
    }

    return new EmbedBuilder()
        .setDescription(description)
        .setColor(totalWin > 0 ? '#00FF00' : '#FFD700');
}

function createPlayAgainButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('playAgain')
            .setLabel('Play Again (1x)')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('autoSpin')
            .setLabel('Auto Spin (5x)')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('cancel')
            .setLabel('Cash Out')
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
        BET_TOO_HIGH: `⚠️ Maximum bet is ${formatNumber(details.maxBet || 0)} ${details.currency || 'currency'}.`,
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