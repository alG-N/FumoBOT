/**
 * Bot Ban Command - Bot Owner Only
 * Ban users from using the bot entirely
 */

const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { OWNER_IDS, DEVELOPER_ID, BAN_DURATION_MULTIPLIERS, FILE_PATHS } = require('../Config/ownerConfig');
const { formatDuration } = require('../../MainCommand/Ultility/timeUtils');
const fs = require('fs');
const path = require('path');

function isAuthorized(userId) {
    return userId === DEVELOPER_ID || OWNER_IDS.includes(userId);
}

function ensureBanFileExists() {
    const dir = path.dirname(FILE_PATHS.BAN_LIST);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(FILE_PATHS.BAN_LIST)) {
        fs.writeFileSync(FILE_PATHS.BAN_LIST, JSON.stringify({ bans: [] }, null, 2));
    }
}

function getBans() {
    ensureBanFileExists();
    try {
        return JSON.parse(fs.readFileSync(FILE_PATHS.BAN_LIST, 'utf8'));
    } catch {
        return { bans: [] };
    }
}

function saveBans(data) {
    ensureBanFileExists();
    fs.writeFileSync(FILE_PATHS.BAN_LIST, JSON.stringify(data, null, 2));
}

function parseDuration(durationStr) {
    if (!durationStr) return null;
    
    const match = durationStr.match(/^(\d+)([smhdwy])$/i);
    if (!match) return null;
    
    const [, amount, unit] = match;
    const multiplier = BAN_DURATION_MULTIPLIERS[unit.toLowerCase()];
    
    return multiplier ? parseInt(amount) * multiplier : null;
}

// formatDuration is now imported from timeUtils

async function banUser(userId, reason, duration, bannedBy) {
    const data = getBans();
    const expiresAt = duration ? Date.now() + duration : null;
    
    // Remove existing ban if any
    data.bans = data.bans.filter(b => b.userId !== userId);
    
    // Add new ban
    data.bans.push({
        userId,
        reason,
        bannedAt: Date.now(),
        expiresAt,
        bannedBy
    });
    
    saveBans(data);
    return { success: true, expiresAt };
}

async function unbanUser(userId) {
    const data = getBans();
    const hadBan = data.bans.some(b => b.userId === userId);
    data.bans = data.bans.filter(b => b.userId !== userId);
    saveBans(data);
    return { success: hadBan };
}

function isUserBanned(userId) {
    const data = getBans();
    const ban = data.bans.find(b => b.userId === userId);
    
    if (!ban) return { banned: false };
    
    // Check if ban expired
    if (ban.expiresAt && Date.now() > ban.expiresAt) {
        // Remove expired ban
        data.bans = data.bans.filter(b => b.userId !== userId);
        saveBans(data);
        return { banned: false };
    }
    
    return {
        banned: true,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        bannedAt: ban.bannedAt
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botban')
        .setDescription('Manage bot-wide user bans (Owner only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Ban a user from using the bot')
            .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(true))
            .addStringOption(opt => opt.setName('duration').setDescription('Ban duration (e.g., 1d, 7d, 30d, 1y, or leave empty for permanent)').setRequired(false)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Unban a user from the bot')
            .addUserOption(opt => opt.setName('user').setDescription('User to unban').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('check')
            .setDescription('Check if a user is banned')
            .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all banned users')),

    async execute(interaction) {
        const userId = interaction.user.id;
        
        if (!isAuthorized(userId)) {
            return interaction.reply({ content: '❌ This command is restricted to bot owners only.', ephemeral: true });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            switch (subcommand) {
                case 'add': {
                    const targetUser = interaction.options.getUser('user');
                    const reason = interaction.options.getString('reason');
                    const durationStr = interaction.options.getString('duration');
                    
                    if (isAuthorized(targetUser.id)) {
                        return interaction.editReply({ content: '❌ Cannot ban bot owners.' });
                    }
                    
                    const duration = parseDuration(durationStr);
                    const result = await banUser(targetUser.id, reason, duration, interaction.user.id);
                    
                    const embed = new EmbedBuilder()
                        .setColor('DarkRed')
                        .setTitle('🔨 User Banned')
                        .addFields(
                            { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                            { name: 'Duration', value: formatDuration(duration), inline: true },
                            { name: 'Reason', value: reason, inline: false }
                        )
                        .setTimestamp();
                    
                    if (result.expiresAt) {
                        embed.addFields({ name: 'Expires', value: `<t:${Math.floor(result.expiresAt / 1000)}:R>`, inline: true });
                    }
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                
                case 'remove': {
                    const targetUser = interaction.options.getUser('user');
                    const result = await unbanUser(targetUser.id);
                    
                    const embed = new EmbedBuilder()
                        .setColor(result.success ? 'Green' : 'Orange')
                        .setTitle(result.success ? '✅ User Unbanned' : '⚠️ User Not Banned')
                        .setDescription(result.success 
                            ? `${targetUser.tag} has been unbanned from the bot.`
                            : `${targetUser.tag} was not banned.`)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                
                case 'check': {
                    const targetUser = interaction.options.getUser('user');
                    const status = isUserBanned(targetUser.id);
                    
                    const embed = new EmbedBuilder()
                        .setColor(status.banned ? 'Red' : 'Green')
                        .setTitle(status.banned ? '🚫 User is Banned' : '✅ User is Not Banned')
                        .addFields({ name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false });
                    
                    if (status.banned) {
                        embed.addFields(
                            { name: 'Reason', value: status.reason || 'No reason provided', inline: false },
                            { name: 'Banned At', value: `<t:${Math.floor(status.bannedAt / 1000)}:F>`, inline: true }
                        );
                        if (status.expiresAt) {
                            embed.addFields({ name: 'Expires', value: `<t:${Math.floor(status.expiresAt / 1000)}:R>`, inline: true });
                        } else {
                            embed.addFields({ name: 'Duration', value: 'Permanent', inline: true });
                        }
                    }
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                
                case 'list': {
                    const data = getBans();
                    const activeBans = data.bans.filter(b => !b.expiresAt || Date.now() < b.expiresAt);
                    
                    if (activeBans.length === 0) {
                        return interaction.editReply({ content: '✅ No users are currently banned.' });
                    }
                    
                    const banList = activeBans.slice(0, 25).map((ban, i) => {
                        const expires = ban.expiresAt 
                            ? `<t:${Math.floor(ban.expiresAt / 1000)}:R>`
                            : 'Never';
                        return `${i + 1}. <@${ban.userId}> - ${ban.reason.substring(0, 30)}... (Expires: ${expires})`;
                    }).join('\n');
                    
                    const embed = new EmbedBuilder()
                        .setColor('DarkRed')
                        .setTitle(`🔨 Banned Users (${activeBans.length})`)
                        .setDescription(banList)
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        } catch (error) {
            console.error('[BotBan] Error:', error);
            await interaction.editReply({ content: `❌ Error: ${error.message}` });
        }
    },
    
    // Export for use in other files
    isUserBanned,
    banUser,
    unbanUser
};
