const { EmbedBuilder, Colors } = require('discord.js');
const { DAILY_CONFIG } = require('../../../Configuration/dailyConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const { formatDuration } = require('../../../Ultility/balanceFormatter');

function createProgressBar(current, max = 7) {
    const filled = Math.min(current, max);
    const empty = Math.max(0, max - current);
    return '■'.repeat(filled) + '□'.repeat(empty);
}

function getStreakText(streak) {
    const { MAX_STREAK_DISPLAY } = DAILY_CONFIG;
    
    if (streak >= MAX_STREAK_DISPLAY) {
        return `MAX Streak (${streak} days) 🔥`;
    }
    
    return `${streak}/${MAX_STREAK_DISPLAY} days\nKeep going for even better rewards!`;
}

function createDailyEmbed(reward, streak, username) {
    const progressBar = createProgressBar(streak);
    const streakText = getStreakText(streak);
    
    return new EmbedBuilder()
        .setTitle(`🎁 ${username}'s Daily Bonus 🎁`)
        .setDescription(reward.description)
        .addFields(
            { 
                name: '💰 Coins', 
                value: `${formatNumber(reward.coins)} coins`, 
                inline: true 
            },
            { 
                name: '💎 Gems', 
                value: `${formatNumber(reward.gems)} gems`, 
                inline: true 
            },
            { 
                name: '🪙 Spirit Tokens', 
                value: `${reward.spiritTokens} token${reward.spiritTokens > 1 ? 's' : ''}`, 
                inline: true 
            },
            { 
                name: '🔥 Daily Streak', 
                value: `[${progressBar}] ${streakText}`, 
                inline: false 
            }
        )
        .setColor(reward.color || Colors.Blue)
        .setThumbnail(reward.thumbnail)
        .setFooter({ text: 'Remember to claim your daily bonus every day to maximize your rewards!' })
        .setTimestamp();
}

function createCooldownEmbed(timeRemaining, streak, username) {
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
    
    const timerMessage = 
        `You have already claimed your daily bonus today. ` +
        `Please wait **${hours}h ${minutes}m ${seconds}s** until you can claim it again.\n\n` +
        `Remember: Tomorrow's rewards will be even better if you maintain your streak!`;
    
    const progressBar = createProgressBar(streak);
    
    return new EmbedBuilder()
        .setTitle(`⏳ ${username}, you have already claimed your daily bonus! ⏳`)
        .setDescription(timerMessage)
        .addFields({
            name: '🔥 Current Streak',
            value: `[${progressBar}] ${streak} day${streak !== 1 ? 's' : ''}`,
            inline: false
        })
        .setColor(Colors.Red)
        .setFooter(DAILY_CONFIG.COOLDOWN_FOOTER)
        .setTimestamp();
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
        return `${medal} **${username}** - ${entry.streak} day${entry.streak !== 1 ? 's' : ''}`;
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
    getStreakText
};