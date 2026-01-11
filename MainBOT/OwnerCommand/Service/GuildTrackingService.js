/**
 * Guild Tracking Service
 * Handles guild join/leave tracking and statistics
 */

const { EmbedBuilder, Colors } = require('discord.js');
const { GUILD_LOG_CHANNEL_ID, GUILD_FEATURES_MAP, BOOST_TIERS } = require('../Config/ownerConfig');

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getAge(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const years = Math.floor(days / 365);
    const months = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    
    const parts = [];
    if (years > 0) parts.push(`${years}y`);
    if (months > 0) parts.push(`${months}mo`);
    if (remainingDays > 0 || parts.length === 0) parts.push(`${remainingDays}d`);
    
    return {
        days,
        years,
        months,
        formatted: parts.join(' ')
    };
}

function formatMemberStats(guild) {
    const total = guild.memberCount;
    const bots = guild.members.cache.filter(m => m.user.bot).size;
    const humans = total - bots;
    
    return {
        total,
        humans,
        bots,
        formatted: `${total.toLocaleString()} (👤 ${humans} • 🤖 ${bots})`
    };
}

function formatBoostInfo(guild) {
    const tier = guild.premiumTier || 0;
    const boosts = guild.premiumSubscriptionCount || 0;
    
    return {
        tier,
        boosts,
        emoji: BOOST_TIERS.emojis[tier] || '⚪',
        name: BOOST_TIERS.names[tier] || 'None',
        formatted: `${BOOST_TIERS.emojis[tier]} ${BOOST_TIERS.names[tier]} (${boosts} boosts)`
    };
}

// ═══════════════════════════════════════════════════════════════
// EMBED CREATORS
// ═══════════════════════════════════════════════════════════════

function createGuildJoinEmbed(guild, client) {
    const age = getAge(guild.createdAt);
    const members = formatMemberStats(guild);
    const boost = formatBoostInfo(guild);
    
    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📥 New Guild Joined')
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '🏠 Guild', value: `${guild.name}\n\`${guild.id}\``, inline: true },
            { name: '👥 Members', value: members.formatted, inline: true },
            { name: '📅 Created', value: `${age.formatted} ago`, inline: true },
            { name: '🚀 Boost', value: boost.formatted, inline: true },
            { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
            { name: '🌐 Total Guilds', value: `${client.guilds.cache.size}`, inline: true }
        )
        .setTimestamp();
    
    return embed;
}

function createGuildLeaveEmbed(guild, client) {
    const members = formatMemberStats(guild);
    
    const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('📤 Guild Left')
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
            { name: '🏠 Guild', value: `${guild.name}\n\`${guild.id}\``, inline: true },
            { name: '👥 Members', value: members.formatted, inline: true },
            { name: '🌐 Total Guilds', value: `${client.guilds.cache.size}`, inline: true }
        )
        .setTimestamp();
    
    return embed;
}

function createGuildStatsEmbed(client) {
    const guilds = client.guilds.cache;
    const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
    
    const embed = new EmbedBuilder()
        .setColor(0x5DADE2)
        .setTitle('📊 Guild Statistics')
        .addFields(
            { name: '🏠 Total Guilds', value: `${guilds.size}`, inline: true },
            { name: '👥 Total Members', value: totalMembers.toLocaleString(), inline: true },
            { name: '📊 Avg Members/Guild', value: Math.round(totalMembers / guilds.size).toLocaleString(), inline: true }
        )
        .setTimestamp();
    
    return embed;
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION
// ═══════════════════════════════════════════════════════════════

async function sendGuildNotification(client, embed) {
    if (!GUILD_LOG_CHANNEL_ID) return;
    
    try {
        const channel = await client.channels.fetch(GUILD_LOG_CHANNEL_ID);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('[GuildTracking] Failed to send notification:', error.message);
    }
}

function initializeGuildTracking(client) {
    client.on('guildCreate', async (guild) => {
        console.log(`[Guild] Joined: ${guild.name} (${guild.id})`);
        const embed = createGuildJoinEmbed(guild, client);
        await sendGuildNotification(client, embed);
    });
    
    client.on('guildDelete', async (guild) => {
        console.log(`[Guild] Left: ${guild.name} (${guild.id})`);
        const embed = createGuildLeaveEmbed(guild, client);
        await sendGuildNotification(client, embed);
    });
    
    console.log('✅ Guild tracking initialized');
}

function getGuildStatistics(client) {
    const guilds = client.guilds.cache;
    return {
        totalGuilds: guilds.size,
        totalMembers: guilds.reduce((acc, g) => acc + g.memberCount, 0),
        largestGuild: guilds.sort((a, b) => b.memberCount - a.memberCount).first()
    };
}

module.exports = {
    GUILD_LOG_CHANNEL_ID,
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    createGuildStatsEmbed,
    getGuildStatistics,
    formatMemberStats,
    formatBoostInfo
};
