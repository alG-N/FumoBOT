const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');
const { CRATE_TIERS } = require('../../../Configuration/mysteryCrateConfig');

function createTutorialEmbed() {
    const tierList = Object.entries(CRATE_TIERS)
        .map(([key, tier]) => `${tier.emoji} **${tier.name}** - ${formatNumber(tier.minBet)}+ bet`)
        .join('\n');
    
    return new EmbedBuilder()
        .setTitle('🎰 Mystery Crate - New System! 🎰')
        .setDescription(
            [
                "**How to Play:**",
                "`.mysterycrate <num_crates> <bet_amount> <currency>`\n",
                "**Crate Tiers:**",
                tierList + "\n",
                "**Special Features:**",
                "🎲 **Special Events** - Random chance for bonuses!",
                "🔥 **Win Streaks** - Consecutive wins boost rewards!",
                "💫 **Session Tracking** - Track your gambling session!\n",
                "**Example:** `.mysterycrate 5 1000 coins`",
                "Pick 3-5 crates and choose one to open!"
            ].join("\n")
        )
        .setColor(Colors.Gold)
        .setFooter({ text: 'Higher bets unlock better crate tiers!' });
}

function createGameEmbed(tier, numCrates, betAmount, currency, username, avatarURL, specialEvent = null, comboBonus = null) {
    const embed = new EmbedBuilder()
        .setTitle(`${tier.emoji} ${tier.name} - Pick Your Crate! ${tier.emoji}`)
        .setDescription(
            `**Number of Crates:** ${numCrates}\n` +
            `**Bet Amount:** ${formatNumber(betAmount)} ${currency}\n` +
            `**Tier Minimum:** ${formatNumber(tier.minBet)} ${currency}\n\n` +
            `Choose wisely... only one crate contains your fate!`
        )
        .setColor(tier.color)
        .setFooter({ text: `${username}'s game`, iconURL: avatarURL });
    
    if (specialEvent) {
        embed.addFields({
            name: `${specialEvent.emoji} Special Event: ${specialEvent.name}`,
            value: specialEvent.description,
            inline: false
        });
    }
    
    if (comboBonus) {
        embed.addFields({
            name: `${comboBonus.emoji} Combo Bonus Active!`,
            value: `${comboBonus.description} (Streak: ${comboBonus.threshold})`,
            inline: false
        });
    }
    
    return embed;
}

function createCrateButtons(userId, numCrates) {
    const rows = [];
    
    for (let i = 0; i < numCrates; i++) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId(`crate_pick_${i}`, userId))
                .setLabel(`📦 Crate ${i + 1}`)
                .setStyle(ButtonStyle.Primary)
        );
        rows.push(row);
    }
    
    return rows;
}

function createResultEmbed(selectedCrate, tier, betAmount, currency, username, avatarURL, processResult) {
    const { outcome } = selectedCrate;
    const { reward, netChange, won, comboBonus, specialEvent, cursedTriggered } = processResult;
    
    let outcomeText = `${outcome.emoji} **${outcome.text}**\n\n`;
    outcomeText += `**Multiplier:** x${outcome.multiplier}\n`;
    
    if (comboBonus?.active) {
        outcomeText += `**Combo Bonus:** x${comboBonus.multiplier.toFixed(2)}\n`;
    }
    
    outcomeText += `**Base Reward:** ${formatNumber(reward.baseReward)} ${currency}\n`;
    outcomeText += `**Final Reward:** ${formatNumber(reward.finalAmount)} ${currency}`;
    
    const embed = new EmbedBuilder()
        .setTitle(`${tier.emoji} ${tier.name} Result ${tier.emoji}`)
        .setDescription(outcomeText)
        .setColor(won ? Colors.Green : Colors.Red)
        .addFields(
            {
                name: won ? '✅ You Won!' : '❌ You Lost',
                value: `**Net Change:** ${netChange >= 0 ? '+' : ''}${formatNumber(netChange)} ${currency}\n` +
                       `**New Balance:** ${formatNumber(processResult.newBalance)} ${currency}`,
                inline: false
            }
        )
        .setFooter({ text: `${username}'s result`, iconURL: avatarURL })
        .setTimestamp();
    
    if (specialEvent) {
        embed.addFields({
            name: `${specialEvent.emoji} ${specialEvent.name}`,
            value: specialEvent.description,
            inline: false
        });
    }
    
    if (cursedTriggered) {
        embed.addFields({
            name: '💀 CURSE ACTIVATED!',
            value: 'You lost everything from getting 0x!',
            inline: false
        });
    }
    
    return embed;
}

function createActionButtons(userId, hasBalance) {
    const row = new ActionRowBuilder();
    
    if (hasBalance) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('crate_again', userId))
                .setLabel('🔄 Play Again')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('crate_change', userId))
                .setLabel('💰 Change Bet')
                .setStyle(ButtonStyle.Primary)
        );
    }
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('crate_stats', userId))
            .setLabel('📊 Session Stats')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('crate_quit', userId))
            .setLabel('🚪 Quit')
            .setStyle(ButtonStyle.Danger)
    );
    
    return row;
}

function createSessionStatsEmbed(stats, currency, username, avatarURL) {
    const profitColor = stats.netProfit >= 0 ? Colors.Green : Colors.Red;
    const profitEmoji = stats.netProfit >= 0 ? '📈' : '📉';
    
    return new EmbedBuilder()
        .setTitle('📊 Session Statistics 📊')
        .setDescription(`${profitEmoji} **Net Profit:** ${stats.netProfit >= 0 ? '+' : ''}${formatNumber(stats.netProfit)} ${currency}`)
        .setColor(profitColor)
        .addFields(
            {
                name: '🎮 Games Played',
                value: `**Total:** ${stats.totalGames}\n**Wins:** ${stats.wins}\n**Losses:** ${stats.losses}`,
                inline: true
            },
            {
                name: '📈 Performance',
                value: `**Win Rate:** ${stats.winRate}%\n**Current Streak:** ${stats.currentStreak}\n**Biggest Win:** ${formatNumber(stats.biggestWin)}`,
                inline: true
            },
            {
                name: '💰 Money Flow',
                value: `**Total Won:** ${formatNumber(stats.totalWon)}\n**Total Lost:** ${formatNumber(stats.totalLost)}`,
                inline: false
            }
        )
        .setFooter({ text: `${username}'s session`, iconURL: avatarURL })
        .setTimestamp();
}

function createErrorEmbed(errorType, details = {}) {
    const errorMessages = {
        INSUFFICIENT_ARGS: '❌ Usage: `.mysterycrate <num_crates> <bet_amount> <currency>`\nExample: `.mysterycrate 5 1000 coins`',
        INVALID_CRATE_COUNT: `❌ Please specify 3-5 crates.`,
        INVALID_BET_AMOUNT: '❌ Please specify a valid bet amount.',
        INVALID_CURRENCY: '❌ Invalid currency. Use `coins` or `gems`.',
        NO_ACCOUNT: `❌ You don't have any ${details.currency} yet. Earn some before playing!`,
        BELOW_MINIMUM: `❌ Minimum bet for this tier is ${formatNumber(details.minBet)} ${details.currency}.`,
        INSUFFICIENT_BALANCE: `❌ You don't have enough ${details.currency}. Balance: ${formatNumber(details.balance)} ${details.currency}`,
        DATABASE_ERROR: '⚠️ An error occurred while retrieving your balance. Please try again later.',
        GAME_ERROR: '⚠️ An error occurred while starting the game. Please try again.',
        PROCESSING_ERROR: '⚠️ An error occurred while updating your balance.',
        SESSION_LIMIT: `❌ Maximum ${details.limit} games per session reached!`
    };

    return new EmbedBuilder()
        .setDescription(errorMessages[errorType] || '❌ An unknown error occurred.')
        .setColor(Colors.Red);
}

function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setDescription('⏳ Session timed out!')
        .setColor(Colors.Orange);
}

function createTierInfoEmbed(tier) {
    const outcomeList = tier.outcomes
        .map(o => `${o.emoji} ${o.text} - **x${o.multiplier}** (${o.weight}% chance)`)
        .join('\n');
    
    return new EmbedBuilder()
        .setTitle(`${tier.emoji} ${tier.name} Info ${tier.emoji}`)
        .setDescription(`**Minimum Bet:** ${formatNumber(tier.minBet)}\n\n**Possible Outcomes:**\n${outcomeList}`)
        .setColor(tier.color);
}

module.exports = {
    createTutorialEmbed,
    createGameEmbed,
    createCrateButtons,
    createResultEmbed,
    createActionButtons,
    createSessionStatsEmbed,
    createErrorEmbed,
    createTimeoutEmbed,
    createTierInfoEmbed
};