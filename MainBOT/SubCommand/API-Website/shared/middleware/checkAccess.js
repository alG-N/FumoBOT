const { EmbedBuilder } = require('discord.js');
const path = require('path');

// Dynamic import to handle different project structures
let maintenance = 'no';
let developerID = '';
let isBanned = async () => null;

try {
    const maintenanceConfig = require(path.join(__dirname, '../../../MainCommand/Configuration/maintenanceConfig.js'));
    maintenance = maintenanceConfig.maintenance;
    developerID = maintenanceConfig.developerID;
} catch (err) {
    console.log('[checkAccess] Could not load maintenance config, using defaults');
}

try {
    const Administrator = require(path.join(__dirname, '../../../MainCommand/Administrator'));
    isBanned = Administrator.isBanned;
} catch (err) {
    console.log('[checkAccess] Could not load Administrator module, bans disabled');
}

async function checkAccess(interaction) {
    const banData = await isBanned(interaction.user.id);

    if ((maintenance === 'yes' && interaction.user.id !== developerID) || banData) {
        let description = '';
        let footerText = '';
        let title = '';

        if (maintenance === 'yes' && interaction.user.id !== developerID) {
            title = '🚧 Maintenance Mode';
            description = "The bot is currently in maintenance mode. Please try again later.\nFumoBOT's Developer: alterGolden";
            footerText = 'Thank you for your patience';
        } else if (banData) {
            title = '⛔ You Are Banned';
            description = `You are banned from using this bot.\n\n**Reason:** ${banData.reason || 'No reason provided'}`;

            if (banData.expiresAt) {
                const remaining = banData.expiresAt - Date.now();
                const timeString = formatRemainingTime(remaining);
                description += `\n**Time Remaining:** ${timeString}`;
            } else {
                description += `\n**Ban Type:** Permanent`;
            }

            footerText = 'Ban enforced by developer';
        }

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(title)
            .setDescription(description)
            .setFooter({ text: footerText })
            .setTimestamp();

        console.log(`[${new Date().toISOString()}] Blocked user (${interaction.user.id}) due to ${maintenance === 'yes' ? 'maintenance' : 'ban'}.`);

        return { blocked: true, embed };
    }

    return { blocked: false };
}

function formatRemainingTime(remaining) {
    if (remaining <= 0) return 'Expired';

    const seconds = Math.floor((remaining / 1000) % 60);
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));

    return [
        days ? `${days}d` : '',
        hours ? `${hours}h` : '',
        minutes ? `${minutes}m` : '',
        seconds ? `${seconds}s` : ''
    ].filter(Boolean).join(' ') || '< 1s';
}

module.exports = { checkAccess, formatRemainingTime };
