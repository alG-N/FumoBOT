const { EmbedBuilder, Colors } = require('discord.js');
const { DAILY_CONFIG } = require('../../../Configuration/dailyConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { formatDuration } = require('../../../Ultility/balanceFormatter');

function createProgressBar(current, max = 7) {
    const filled = Math.max(0, Math.min(current, max));
    const empty = Math.max(0, max - filled);
    return '█'.repeat(filled) + '░'.repeat(empty);
}

function getStreakEmoji(streak) {
    if (streak >= 100) return '🏆';
    if (streak >= 60) return '💎';
    if (streak >= 30) return '👑';
    if (streak >= 14) return '⭐';
    if (streak >= 7) return '🔥';
    return '✨';
}

function createDailyEmbed(result, username) {
    const { rewards, streak, milestone, nextMilestone, streakReset } = result;
    const streakEmoji = getStreakEmoji(streak);
    
    const embed = new EmbedBuilder()
        .setTitle(`🎁 ${username}'s Daily Bonus 🎁`)
        .setColor(milestone ? '#FFD700' : '#00AAFF')
        .setThumbnail(DAILY_CONFIG.DEFAULT_THUMBNAIL)
        .setTimestamp();
    
    // Build description
    let description = '';
    
    if (streakReset) {
        description += `⚠️ *Your streak was reset due to missed days!*\n\n`;
    }
    
    if (rewards.luckyBonus) {
        description += `${DAILY_CONFIG.LUCKY_BONUS.message}\n\n`;
    }
    
    if (rewards.weekendBonus) {
        description += `${DAILY_CONFIG.WEEKEND_BONUS.message}\n\n`;
    }
    
    description += `**Rewards Received:**`;
    embed.setDescription(description);
    
    // Reward fields
    embed.addFields(
        { name: '💰 Coins', value: `+${formatNumber(rewards.coins)}`, inline: true },
        { name: '💎 Gems', value: `+${formatNumber(rewards.gems)}`, inline: true },
        { name: '🪙 Spirit Tokens', value: `+${rewards.spiritTokens}`, inline: true }
    );
    
    // Milestone celebration
    if (milestone) {
        embed.addFields({
            name: `${milestone.emoji} ${milestone.name} Achieved!`,
            value: `${milestone.message}\n` +
                   `**Bonus:** +${formatNumber(milestone.bonusCoins)} coins, +${formatNumber(milestone.bonusGems)} gems` +
                   (milestone.bonusItem ? `\n🎁 **${milestone.bonusItem.name}** x${milestone.bonusItem.quantity}` : ''),
            inline: false
        });
    }
    
    // Streak display
    const progressMax = nextMilestone ? nextMilestone.day : 100;
    const progressCurrent = Math.min(streak, progressMax);
    const progressBar = createProgressBar(progressCurrent % 7 || 7, 7);
    
    let streakText = `${streakEmoji} **${streak} day${streak !== 1 ? 's' : ''}**`;
    if (nextMilestone) {
        streakText += ` (${progressCurrent}/${nextMilestone.day} to ${nextMilestone.name})`;
    }
    
    embed.addFields({
        name: '🔥 Daily Streak',
        value: `[${progressBar}] ${streakText}\n` +
               `📈 Multiplier: **${rewards.multiplier.toFixed(2)}x**`,
        inline: false
    });
    
    embed.setFooter({ text: 'Claim daily rewards every day to build your streak!' });
    
    return embed;
}

function createCooldownEmbed(timeRemaining, streak, nextMilestone, username) {
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
    
    const streakEmoji = getStreakEmoji(streak);
    const progressBar = createProgressBar(streak % 7 || 7, 7);
    
    const embed = new EmbedBuilder()
        .setTitle(`⏳ ${username}, Already Claimed! ⏳`)
        .setDescription(
            `You've already claimed your daily bonus today.\n` +
            `**Come back in:** \`${hours}h ${minutes}m ${seconds}s\`\n\n` +
            `*Don't break your streak! Claim within 48h of your last claim.*`
        )
        .setColor(Colors.Orange)
        .addFields({
            name: '🔥 Current Streak',
            value: `[${progressBar}] ${streakEmoji} **${streak} day${streak !== 1 ? 's' : ''}**`,
            inline: false
        })
        .setFooter(DAILY_CONFIG.COOLDOWN_FOOTER)
        .setTimestamp();
    
    if (nextMilestone) {
        embed.addFields({
            name: `${nextMilestone.emoji} Next Milestone`,
            value: `**${nextMilestone.name}** in ${nextMilestone.day - streak} day${nextMilestone.day - streak !== 1 ? 's' : ''}`,
            inline: false
        });
    }
    
    return embed;
}

function createNoAccountEmbed() {
    return new EmbedBuilder()
        .setTitle('❌ No Account Found')
        .setDescription('You need to use `.starter` first to begin your journey!')
        .setColor(Colors.Red)
        .setFooter({ text: 'Use .starter to create your account' })
        .setTimestamp();
}

function createErrorEmbed(error) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while accessing your data. Please try again later.')
        .setColor(Colors.Red)
        .setFooter({ text: 'If this persists, contact support' })
        .setTimestamp();
}

function createLeaderboardEmbed(leaderboard, client) {
    if (!leaderboard || leaderboard.length === 0) {
        return new EmbedBuilder()
            .setTitle('🏆 Daily Streak Leaderboard')
            .setDescription('No one has claimed their daily yet!')
            .setColor(Colors.Blue)
            .setTimestamp();
    }
    
    const medals = ['🥇', '🥈', '🥉'];
    const description = leaderboard.map((entry, index) => {
        const medal = medals[index] || `**${entry.rank}.**`;
        const user = client.users.cache.get(entry.userId);
        const username = user ? user.username : `User ${entry.userId.slice(0, 8)}`;
        const emoji = getStreakEmoji(entry.streak);
        return `${medal} **${username}** - ${emoji} ${entry.streak} day${entry.streak !== 1 ? 's' : ''}`;
    }).join('\n');
    
    return new EmbedBuilder()
        .setTitle('🏆 Daily Streak Leaderboard')
        .setDescription(description)
        .setColor(Colors.Gold)
        .setFooter({ text: 'Keep your streak going to climb the ranks!' })
        .setTimestamp();
}

module.exports = {
    createDailyEmbed,
    createCooldownEmbed,
    createNoAccountEmbed,
    createErrorEmbed,
    createLeaderboardEmbed,
    createProgressBar,
    getStreakEmoji
};