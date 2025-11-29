const { EmbedBuilder, Colors } = require('discord.js');
const { MULTIPLIERS } = require('../../../Configuration/flipConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createHelpEmbed() {
    const multiplierInfo = Object.entries(MULTIPLIERS)
        .map(([mult, { win, loss }]) => `🔹 **x${mult}:** Win ${win}×, lose ${loss}×`)
        .join('\n');
    
    return new EmbedBuilder()
        .setTitle('🎲 Flip the Coin')
        .setDescription(
            "**Usage:** `.flip (heads/tails) (coins/gems) (bet) (x?)`\n" +
            "**Example:** `.flip heads gems 100k x2`\n\n" +
            "Test your luck with a simple coin flip! Choose heads or tails, " +
            "pick your bet amount, and select a multiplier for higher risks and rewards."
        )
        .addFields({
            name: '📈 Multipliers',
            value: multiplierInfo
        })
        .setColor(Colors.Blue)
        .setFooter({ text: 'Good luck! 🍀' })
        .setTimestamp();
}

function createSingleFlipEmbed(result, currency, bet, multiplier) {
    const { won, choice, result: coinResult, amount, balance, stats } = result;
    
    const embed = new EmbedBuilder()
        .setTitle('🎲 Flip the Coin')
        .setDescription(
            `You chose **${choice}**. The coin landed on **${coinResult}**.`
        )
        .addFields(
            {
                name: '🔔 Result',
                value: won
                    ? `🎉 **You won ${formatNumber(amount)} ${currency}!**\n` +
                      `Balance: **${formatNumber(balance)} ${currency}**`
                    : `😞 **You lost ${formatNumber(amount)} ${currency}.**\n` +
                      `Balance: **${formatNumber(balance)} ${currency}**`
            },
            {
                name: '📊 Stats',
                value: `Wins: ${formatNumber(stats.wins)} | Losses: ${formatNumber(stats.losses)}`
            }
        )
        .setColor(won ? Colors.Green : Colors.Red)
        .setFooter({ text: `Multiplier: x${multiplier}` })
        .setTimestamp();
    
    return embed;
}

function createBatchFlipEmbed(result, choice, currency, bet, multiplier) {
    const { count, winCount, lossCount, totalWon, totalLost, netChange, balance } = result;
    
    const won = netChange > 0;
    const totalBet = bet * count;
    const winRate = ((winCount / count) * 100).toFixed(2);
    
    const embed = new EmbedBuilder()
        .setTitle(`🎲 Batch Flip Results (${count} flips)`)
        .setDescription(
            `You chose **${choice}** for all flips.\n` +
            `Total bet: **${formatNumber(totalBet)} ${currency}**`
        )
        .addFields(
            {
                name: '📊 Summary',
                value: 
                    `✅ **Wins:** ${winCount} (${winRate}%)\n` +
                    `❌ **Losses:** ${lossCount} (${(100 - winRate).toFixed(2)}%)\n` +
                    `💰 **Won:** ${formatNumber(totalWon)} ${currency}\n` +
                    `💸 **Lost:** ${formatNumber(totalLost)} ${currency}`,
                inline: true
            },
            {
                name: '🔔 Net Result',
                value: netChange >= 0
                    ? `🎉 **+${formatNumber(netChange)} ${currency}**`
                    : `😞 **${formatNumber(netChange)} ${currency}**`,
                inline: true
            },
            {
                name: '💼 Balance',
                value: `**${formatNumber(balance)} ${currency}**`,
                inline: true
            }
        )
        .setColor(won ? Colors.Green : Colors.Red)
        .setFooter({ text: `Multiplier: x${multiplier}` })
        .setTimestamp();
    
    return embed;
}

function createLeaderboardEmbed(entries, category, userRank = null) {
    const categoryTitles = {
        coins: '💰 Top Coin Holders',
        gems: '💎 Top Gem Holders',
        wins: '🏆 Top Winners',
        winrate: '📈 Best Win Rates',
        games: '🎮 Most Games Played'
    };
    
    const title = categoryTitles[category] || '🏆 Leaderboard';
    
    const description = entries
        .map(entry => `**${entry.rank}.** ${entry.userTag} — ${entry.value}`)
        .join('\n');
    
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description || 'No data available.')
        .setColor(Colors.Gold)
        .setTimestamp();
    
    if (userRank) {
        embed.setFooter({ text: `Your rank: #${userRank}` });
    }
    
    return embed;
}

function createStatsEmbed(username, stats, ranks = {}) {
    const embed = new EmbedBuilder()
        .setTitle(`📊 Flip Statistics for ${username}`)
        .addFields(
            {
                name: '💰 Currency',
                value: 
                    `**Coins:** ${formatNumber(stats.coins)}\n` +
                    `**Gems:** ${formatNumber(stats.gems)}`,
                inline: true
            },
            {
                name: '🎮 Game Stats',
                value: 
                    `**Total Games:** ${formatNumber(stats.totalGames)}\n` +
                    `**Wins:** ${formatNumber(stats.wins)}\n` +
                    `**Losses:** ${formatNumber(stats.losses)}`,
                inline: true
            },
            {
                name: '📈 Performance',
                value: 
                    `**Win Rate:** ${stats.winRate}%\n` +
                    `**W/L Ratio:** ${stats.totalGames > 0 ? (stats.wins / Math.max(1, stats.losses)).toFixed(2) : '0.00'}`,
                inline: true
            }
        )
        .setColor(Colors.Blue)
        .setTimestamp();
    
    if (Object.keys(ranks).length > 0) {
        const rankText = Object.entries(ranks)
            .filter(([_, rank]) => rank !== null)
            .map(([category, rank]) => `**${category}:** #${rank}`)
            .join('\n');
        
        if (rankText) {
            embed.addFields({
                name: '🏆 Rankings',
                value: rankText,
                inline: false
            });
        }
    }
    
    return embed;
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        INVALID_AMOUNT: '❌ Invalid bet amount.',
        BELOW_MINIMUM: `❌ Bet amount is below minimum (${formatNumber(details.minBet || 0)}).`,
        ABOVE_MAXIMUM: `❌ Bet amount exceeds maximum (${formatNumber(details.maxBet || 0)}).`,
        INSUFFICIENT_BALANCE: '❌ Insufficient balance.',
        INVALID_CHOICE: '❌ Invalid choice. Use `heads` or `tails`.',
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        INVALID_MULTIPLIER: '❌ Invalid multiplier. Use x2, x3, x5, x10, or x100.',
        INVALID_COUNT: '❌ Invalid count. Must be between 1 and 100.',
        COOLDOWN: `❌ Please wait ${details.remaining || '0'}s before flipping again.`,
        GENERIC: '❌ An error occurred. Please try again.'
    };
    
    return new EmbedBuilder()
        .setDescription(errorMessages[errorType] || errorMessages.GENERIC)
        .setColor(Colors.Red);
}

module.exports = {
    createHelpEmbed,
    createSingleFlipEmbed,
    createBatchFlipEmbed,
    createLeaderboardEmbed,
    createStatsEmbed,
    createErrorEmbed
};