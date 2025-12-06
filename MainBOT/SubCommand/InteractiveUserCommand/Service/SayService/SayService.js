const { EmbedBuilder } = require('discord.js');
const { TYPE_COLORS, OWNER_ID } = require('../../Configuration/Say/sayConfig');

class SayService {
    sanitizeMessage(message) {
        return message
            .replace(/@everyone/g, '[everyone]')
            .replace(/@here/g, '[here]');
    }

    buildCreditText(userId, userTag, showCredit) {
        if (userId === OWNER_ID) {
            return showCredit ? `Requested by Owner (${userTag})` : '';
        }
        return `Requested by ${userTag}`;
    }

    buildEmbed(message, type, creditText) {
        const embed = new EmbedBuilder()
            .setDescription(message)
            .setColor(TYPE_COLORS[type] || TYPE_COLORS.normal)
            .setTimestamp();

        if (creditText) {
            embed.setFooter({ text: creditText });
        }

        return embed;
    }

    buildPlainMessage(message, creditText) {
        return message + (creditText ? `\n\n— ${creditText}` : '');
    }

    async sendMessage(channel, content, useEmbed, message, type, creditText) {
        if (useEmbed) {
            const embed = this.buildEmbed(message, type, creditText);
            return await channel.send({ embeds: [embed] });
        } else {
            const plainMessage = this.buildPlainMessage(message, creditText);
            return await channel.send({ content: plainMessage });
        }
    }

    validateChannel(channel) {
        return channel.isTextBased();
    }
}

module.exports = new SayService();