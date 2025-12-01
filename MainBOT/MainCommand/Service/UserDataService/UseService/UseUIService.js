const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');

function sendErrorEmbed(message, title, description) {
    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
    return message.reply({ embeds: [embed] });
}

function formatDuration(hours) {
    return `**${hours} hour${hours > 1 ? 's' : ''}**`;
}

function createBoostEmbed(color, title, itemName, quantity, boost, duration, source, extra = '') {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
            `You used **${itemName}** x${quantity}!\n\n` +
            `> 📹 **${boost}**\n` +
            `> ⏳ Duration: ${formatDuration(duration)}\n` +
            extra
        )
        .setFooter({ text: `Boost Source: ${source}` })
        .setTimestamp();
}

function createSuccessEmbed(title, description, color = 0x00FF00) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();
}

function createConfirmationEmbed(title, description, footerText = null) {
    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (footerText) {
        embed.setFooter({ text: footerText });
    }

    return embed;
}

function createStackEmbed(itemName, currentStack, maxStack, multiplier, color = 0xFFD700) {
    const percentage = (multiplier * 100).toFixed(0);
    
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(`✨ ${itemName} Stacked!`)
        .setDescription(
            `You used **${itemName}**!\n\n` +
            `📹 **Stack:** ${currentStack}/${maxStack}\n` +
            `💰 **Boost:** +${percentage}%`
        )
        .setTimestamp();
}

module.exports = {
    sendErrorEmbed,
    formatDuration,
    createBoostEmbed,
    createSuccessEmbed,
    createConfirmationEmbed,
    createStackEmbed
};