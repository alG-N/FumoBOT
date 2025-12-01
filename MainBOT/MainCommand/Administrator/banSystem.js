const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const BAN_FILE_PATH = path.join(__dirname, 'BannedList/Banned.json');

if (!fs.existsSync(BAN_FILE_PATH)) {
    const dir = path.dirname(BAN_FILE_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BAN_FILE_PATH, JSON.stringify([], null, 2));
}

function parseDuration(durationStr) {
    const regex = /^(\d+)([smhdwy])$/i;
    const match = durationStr.match(regex);
    if (!match) return null;

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000
    };

    return num * multipliers[unit];
}

function banUser(userId, reason, durationMs = null) {
    const banList = JSON.parse(fs.readFileSync(BAN_FILE_PATH, 'utf8'));
    const expiresAt = durationMs ? Date.now() + durationMs : null;

    const existingIndex = banList.findIndex(b => b.userId === userId);
    if (existingIndex !== -1) {
        banList[existingIndex] = { userId, reason, expiresAt };
    } else {
        banList.push({ userId, reason, expiresAt });
    }

    fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(banList, null, 2));
}

function unbanUser(userId) {
    const banList = JSON.parse(fs.readFileSync(BAN_FILE_PATH, 'utf8'));
    const newList = banList.filter(ban => ban.userId !== userId);
    fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(newList, null, 2));
}

function isUserBanned(userId) {
    const banList = JSON.parse(fs.readFileSync(BAN_FILE_PATH, 'utf8'));
    const ban = banList.find(b => b.userId === userId);
    
    if (!ban) return null;
    
    if (ban.expiresAt && Date.now() > ban.expiresAt) {
        unbanUser(userId);
        return null;
    }
    
    return ban;
}

async function handleBanCommand(message, args, developerID) {
    if (message.author.id !== developerID) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You do not have permission to use this command.')
            .setColor('Red');
        return message.reply({ embeds: [embed] });
    }

    const userId = args[0];

    if (!userId || !/^\d{17,19}$/.test(userId)) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Invalid Input')
            .setDescription('Please provide a valid user ID.')
            .setColor('Yellow');
        return message.reply({ embeds: [embed] });
    }

    if (userId === message.author.id) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Action Forbidden')
            .setDescription('You cannot ban yourself.')
            .setColor('Red');
        return message.reply({ embeds: [embed] });
    }

    if (userId === message.client.user.id) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Action Forbidden')
            .setDescription('You cannot ban the bot.')
            .setColor('Red');
        return message.reply({ embeds: [embed] });
    }

    const durationStr = args.find(arg => /^(\d+)([smhdwy])$/i.test(arg));
    const durationMs = durationStr ? parseDuration(durationStr) : null;

    const reason = args
        .filter(arg => arg !== userId && arg !== durationStr)
        .join(' ') || 'No reason';

    banUser(userId, reason, durationMs);

    const embed = new EmbedBuilder()
        .setTitle('✅ User Banned')
        .addFields(
            { name: 'User ID', value: `<@${userId}>`, inline: true },
            { name: 'Reason', value: reason, inline: true },
            { name: 'Duration', value: durationMs ? durationStr : 'Permanent', inline: true }
        )
        .setColor('DarkRed');
    return message.reply({ embeds: [embed] });
}

async function handleUnbanCommand(message, args, developerID) {
    if (message.author.id !== developerID) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You do not have permission to use this command.')
            .setColor('Red');
        return message.reply({ embeds: [embed] });
    }

    const userId = args[0];

    if (!userId || !/^\d{17,19}$/.test(userId)) {
        const embed = new EmbedBuilder()
            .setTitle('⚠️ Invalid Input')
            .setDescription('Please provide a valid user ID to unban.')
            .setColor('Yellow');
        return message.reply({ embeds: [embed] });
    }

    unbanUser(userId);

    const embed = new EmbedBuilder()
        .setTitle('✅ User Unbanned')
        .setDescription(`Successfully unbanned <@${userId}>.`)
        .setColor('Green');
    return message.reply({ embeds: [embed] });
}

function registerBanSystem(client, developerID) {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;

        const prefix = '.';
        if (!message.content.startsWith(prefix)) return;

        const fullCommand = message.content.slice(prefix.length).trim();
        const [command, ...args] = fullCommand.split(/ +/);
        const lowerCommand = command?.toLowerCase();

        if (lowerCommand === 'ban') {
            await handleBanCommand(message, args, developerID);
        } else if (lowerCommand === 'unban') {
            await handleUnbanCommand(message, args, developerID);
        }
    });
}

module.exports = {
    registerBanSystem,
    banUser,
    unbanUser,
    isUserBanned,
    parseDuration
};