const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { STARTER_CONFIG } = require('../../../Configuration/starterConfig');
const { formatNumber } = require('../../../Ultility/formatting');

/**
 * Create path selection embed with buttons
 */
function createPathSelectionEmbed() {
    const { EMBED_CONFIG, PATHS } = STARTER_CONFIG;
    
    const embed = new EmbedBuilder()
        .setTitle(EMBED_CONFIG.selectionTitle)
        .setDescription(
            `Welcome to **FumoBOT**! 🎉\n\n` +
            `Choose your starting path below. Each path gives you different resources and items to begin your journey.\n\n` +
            Object.values(PATHS).map(path => 
                `${path.name}\n` +
                `└ ${path.description}\n` +
                `└ 💰 ${formatNumber(path.coins)} coins | 💎 ${formatNumber(path.gems)} gems`
            ).join('\n\n')
        )
        .setColor('#FFD700')
        .setThumbnail(EMBED_CONFIG.thumbnail)
        .setFooter({ text: 'Choose wisely! You can only pick once.' })
        .setTimestamp();
    
    return embed;
}

/**
 * Create path selection buttons
 */
function createPathButtons() {
    const { PATHS } = STARTER_CONFIG;
    
    const row = new ActionRowBuilder()
        .addComponents(
            Object.values(PATHS).map(path => 
                new ButtonBuilder()
                    .setCustomId(`starter_${path.id}`)
                    .setLabel(path.name)
                    .setStyle(
                        path.id === 'gambler' ? ButtonStyle.Danger :
                        path.id === 'devotee' ? ButtonStyle.Primary :
                        ButtonStyle.Success
                    )
            )
        );
    
    return row;
}

/**
 * Create success embed after claiming
 */
function createStarterEmbed(result, username) {
    const { EMBED_CONFIG } = STARTER_CONFIG;
    const { path, rewards } = result;
    
    const embed = new EmbedBuilder()
        .setTitle(EMBED_CONFIG.title)
        .setDescription(
            `**${username}** has joined as **${path.name}**!\n\n` +
            `${path.welcomeMessage}\n\n` +
            `**You received:**`
        )
        .setColor(path.color || Colors.Gold)
        .setThumbnail(EMBED_CONFIG.thumbnail)
        .addFields(
            { name: '💰 Coins', value: formatNumber(rewards.coins), inline: true },
            { name: '💎 Gems', value: formatNumber(rewards.gems), inline: true },
            { name: '🪙 Spirit Tokens', value: `${rewards.spiritTokens}`, inline: true }
        )
        .setFooter({ text: EMBED_CONFIG.footer })
        .setTimestamp();
    
    // Add items field
    if (rewards.items && rewards.items.length > 0) {
        const itemsList = rewards.items.map(item => `• ${item.name} x${item.quantity}`).join('\n');
        embed.addFields({ name: '🎁 Starter Items', value: itemsList, inline: false });
    }
    
    return embed;
}

/**
 * Create already claimed embed
 */
function createAlreadyClaimedEmbed() {
    return new EmbedBuilder()
        .setTitle('⚠️ Starter Pack Already Claimed!')
        .setDescription(
            'You have already received your starter pack!\n\n' +
            '**Try these commands instead:**\n' +
            '• `.daily` - Claim daily rewards\n' +
            '• `.balance` - Check your resources\n' +
            '• `.help` - See all commands'
        )
        .setColor(Colors.Orange)
        .setFooter({ text: 'Use .starter stats to see your journey progress' })
        .setTimestamp();
}

/**
 * Create error embed
 */
function createErrorEmbed(error) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('An error occurred while processing your starter pack. Please try again later.')
        .setColor(Colors.Red)
        .setFooter({ text: 'If this persists, contact support' })
        .setTimestamp();
}

/**
 * Create timeout embed
 */
function createTimeoutEmbed() {
    return new EmbedBuilder()
        .setTitle('⏰ Selection Timed Out')
        .setDescription('You didn\'t select a path in time. Use `.starter` again to try again!')
        .setColor(Colors.Grey)
        .setTimestamp();
}

/**
 * Create stats embed
 */
function createStatsEmbed(stats, username) {
    if (!stats) {
        return new EmbedBuilder()
            .setTitle('📊 Starter Pack Stats')
            .setDescription('You haven\'t claimed your starter pack yet! Use `.starter` to begin.')
            .setColor(Colors.Blue);
    }
    
    const pathInfo = STARTER_CONFIG.PATHS[stats.starterPath];
    const pathName = pathInfo ? pathInfo.name : 'Unknown Path';
    
    return new EmbedBuilder()
        .setTitle(`📊 ${username}'s Journey Stats`)
        .addFields(
            { name: '🛤️ Starter Path', value: pathName, inline: true },
            { name: '📅 Join Date', value: new Date(stats.joinDate).toLocaleDateString(), inline: true },
            { name: '⏱️ Days Played', value: `${stats.daysPlayed} days`, inline: true },
            { name: '💰 Current Coins', value: formatNumber(stats.currentCoins), inline: true },
            { name: '💎 Current Gems', value: formatNumber(stats.currentGems), inline: true },
            { name: '\u200b', value: '\u200b', inline: true },
            { name: '📈 Level', value: `${stats.level}`, inline: true },
            { name: '🔄 Rebirth', value: `${stats.rebirth}`, inline: true }
        )
        .setColor(pathInfo?.color || Colors.Blue)
        .setTimestamp();
}

module.exports = {
    createPathSelectionEmbed,
    createPathButtons,
    createStarterEmbed,
    createAlreadyClaimedEmbed,
    createErrorEmbed,
    createTimeoutEmbed,
    createStatsEmbed
};
