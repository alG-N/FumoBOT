const { EmbedBuilder, Colors } = require('discord.js');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');
const { formatNumber } = require('../../../Ultility/formatting');

function createStarterEmbed(reward, username) {
    const { EMBED_CONFIG } = STARTER_CONFIG;
    
    return new EmbedBuilder()
        .setTitle(EMBED_CONFIG.title)
        .setDescription(
            `${reward.description}\n\n` +
            `🎉 **You received:**\n` +
            `💰 **${formatNumber(reward.coins)}** coins\n` +
            `💎 **${formatNumber(reward.gems)}** gems`
        )
        .setColor(reward.color || Colors.Gold)
        .setThumbnail(EMBED_CONFIG.thumbnail)
        .setFooter({ text: EMBED_CONFIG.footer })
        .setTimestamp();
}

function createAlreadyClaimedEmbed() {
    return new EmbedBuilder()
        .setTitle('⚠️ Starter Pack Already Claimed!')
        .setDescription('You have already received your starter pack! Try `.daily` instead.')
        .setColor(Colors.Red)
        .setFooter({ text: 'Use .balance to check your current resources' })
        .setTimestamp();
}

function createErrorEmbed(error) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while processing your starter pack. Please try again later.')
        .setColor(Colors.Red)
        .setFooter({ text: 'If this persists, contact support' })
        .setTimestamp();
}

function createStatsEmbed(stats, username) {
    if (!stats) {
        return new EmbedBuilder()
            .setTitle('📊 Starter Pack Stats')
            .setDescription('You haven\'t claimed your starter pack yet! Use `.starter` to begin.')
            .setColor(Colors.Blue);
    }
    
    return new EmbedBuilder()
        .setTitle(`📊 ${username}'s Journey Stats`)
        .addFields(
            { 
                name: '📅 Join Date', 
                value: new Date(stats.joinDate).toLocaleDateString(), 
                inline: true 
            },
            { 
                name: '⏱️ Days Played', 
                value: `${stats.daysPlayed} days`, 
                inline: true 
            },
            { 
                name: '\u200b', 
                value: '\u200b', 
                inline: true 
            },
            { 
                name: '💰 Current Coins', 
                value: formatNumber(stats.currentCoins), 
                inline: true 
            },
            { 
                name: '💎 Current Gems', 
                value: formatNumber(stats.currentGems), 
                inline: true 
            },
            { 
                name: '\u200b', 
                value: '\u200b', 
                inline: true 
            },
            { 
                name: '📈 Level', 
                value: `${stats.level}`, 
                inline: true 
            },
            { 
                name: '🔄 Rebirth', 
                value: `${stats.rebirth}`, 
                inline: true 
            }
        )
        .setColor(Colors.Blue)
        .setTimestamp();
}

module.exports = {
    createStarterEmbed,
    createAlreadyClaimedEmbed,
    createErrorEmbed,
    createStatsEmbed
};