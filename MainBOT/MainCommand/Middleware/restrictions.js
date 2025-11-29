const { EmbedBuilder, Colors } = require('discord.js');
const { maintenance, developerID } = require('../Configuration/Maintenance/maintenanceConfig');
const { isBanned } = require('../Administrator/BannedList/BanUtils');

function checkRestrictions(userId) {
    const banData = isBanned(userId);
    
    if (maintenance === "yes" && userId !== developerID) {
        return {
            blocked: true,
            embed: new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('🚧 Maintenance Mode')
                .setDescription("The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden")
                .setFooter({ text: "Thank you for your patience" })
                .setTimestamp()
        };
    }

    if (banData) {
        let description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

        if (banData.expiresAt) {
            const remaining = banData.expiresAt - Date.now();
            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((remaining / (1000 * 60)) % 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            const timeString = [
                days && `${days}d`,
                hours && `${hours}h`,
                minutes && `${minutes}m`,
                seconds && `${seconds}s`
            ].filter(Boolean).join(' ');
            description += `\n**Time Remaining:** ${timeString}`;
        } else {
            description += `\n**Ban Type:** Permanent`;
        }

        return {
            blocked: true,
            embed: new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('⛔ You Are Banned')
                .setDescription(description)
                .setFooter({ text: "Ban enforced by developer" })
                .setTimestamp()
        };
    }

    return { blocked: false };
}

module.exports = { checkRestrictions };