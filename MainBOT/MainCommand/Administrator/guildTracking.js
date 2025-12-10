const { EmbedBuilder, Colors } = require('discord.js');

const GUILD_LOG_CHANNEL_ID = '1366324387967533057';

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

function getGuildAge(guild) {
    const createdAt = guild.createdAt;
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const ageYears = Math.floor(ageDays / 365);
    const ageMonths = Math.floor((ageDays % 365) / 30);
    
    const parts = [];
    if (ageYears > 0) parts.push(`${ageYears}y`);
    if (ageMonths > 0) parts.push(`${ageMonths}m`);
    if (parts.length === 0) parts.push(`${ageDays}d`);
    
    return {
        timestamp: createdAt.getTime(),
        formatted: parts.join(' '),
        fullDate: createdAt.toLocaleDateString()
    };
}

function formatGuildFeatures(guild) {
    if (!guild.features || guild.features.length === 0) {
        return 'None';
    }
    
    const featureMap = {
        'ANIMATED_ICON': '🎬 Animated Icon',
        'BANNER': '🖼️ Banner',
        'COMMERCE': '🛒 Commerce',
        'COMMUNITY': '🏘️ Community',
        'DISCOVERABLE': '🔍 Discoverable',
        'FEATURABLE': '⭐ Featurable',
        'INVITE_SPLASH': '💦 Invite Splash',
        'MEMBER_VERIFICATION_GATE_ENABLED': '✅ Verification Gate',
        'NEWS': '📰 News Channels',
        'PARTNERED': '🤝 Partnered',
        'PREVIEW_ENABLED': '👁️ Preview',
        'VANITY_URL': '🔗 Vanity URL',
        'VERIFIED': '✅ Verified',
        'VIP_REGIONS': '🌐 VIP Regions',
        'WELCOME_SCREEN_ENABLED': '👋 Welcome Screen'
    };
    
    return guild.features
        .map(f => featureMap[f] || f)
        .slice(0, 10)
        .join('\n') || 'None';
}

function formatBoostInfo(guild) {
    const tier = guild.premiumTier || 0;
    const boosts = guild.premiumSubscriptionCount || 0;
    
    const tierEmojis = ['⚪', '🥉', '🥈', '🥇', '💎'];
    const tierNames = ['None', 'Tier 1', 'Tier 2', 'Tier 3'];
    
    return {
        tier,
        boosts,
        emoji: tierEmojis[tier] || '⚪',
        name: tierNames[tier] || 'None',
        formatted: `${tierEmojis[tier]} ${tierNames[tier]} (${boosts} boosts)`
    };
}

function getChannelStats(guild) {
    const channels = guild.channels.cache;
    
    const text = channels.filter(c => c.type === 0).size;
    const voice = channels.filter(c => c.type === 2).size;
    const category = channels.filter(c => c.type === 4).size;
    const forum = channels.filter(c => c.type === 15).size;
    const stage = channels.filter(c => c.type === 13).size;
    
    return {
        total: channels.size,
        text,
        voice,
        category,
        forum,
        stage,
        formatted: `💬 ${text} • 🔊 ${voice} • 📁 ${category}${forum > 0 ? ` • 📋 ${forum}` : ''}${stage > 0 ? ` • 🎤 ${stage}` : ''}`
    };
}

function getRoleStats(guild) {
    const roles = guild.roles.cache;
    const managed = roles.filter(r => r.managed).size;
    const hoisted = roles.filter(r => r.hoist).size;
    
    return {
        total: roles.size,
        managed,
        hoisted,
        formatted: `${roles.size} roles (🤖 ${managed} managed • 📌 ${hoisted} hoisted)`
    };
}

function getEmojiStats(guild) {
    const emojis = guild.emojis.cache;
    const animated = emojis.filter(e => e.animated).size;
    const static = emojis.size - animated;
    
    return {
        total: emojis.size,
        static,
        animated,
        formatted: `${emojis.size} (😀 ${static} • <a:emoji:1> ${animated})`
    };
}

function createGuildJoinEmbed(guild) {
    const owner = guild.members.cache.get(guild.ownerId);
    const memberStats = formatMemberStats(guild);
    const guildAge = getGuildAge(guild);
    const boostInfo = formatBoostInfo(guild);
    const channelStats = getChannelStats(guild);
    const roleStats = getRoleStats(guild);
    const emojiStats = getEmojiStats(guild);
    
    const embed = new EmbedBuilder()
        .setTitle('🎉 Joined New Server!')
        .setColor(Colors.Green)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
            {
                name: '📝 Server Name',
                value: guild.name,
                inline: true
            },
            {
                name: '🆔 Server ID',
                value: `\`${guild.id}\``,
                inline: true
            },
            {
                name: '👑 Owner',
                value: owner ? `${owner.user.tag}\n\`${guild.ownerId}\`` : `\`${guild.ownerId}\``,
                inline: true
            },
            {
                name: '👥 Members',
                value: memberStats.formatted,
                inline: true
            },
            {
                name: '📅 Created',
                value: `${guildAge.fullDate}\n(${guildAge.formatted} ago)`,
                inline: true
            },
            {
                name: '🚀 Boost Status',
                value: boostInfo.formatted,
                inline: true
            },
            {
                name: '📺 Channels',
                value: channelStats.formatted,
                inline: false
            },
            {
                name: '🎭 Roles',
                value: roleStats.formatted,
                inline: true
            },
            {
                name: '😀 Emojis',
                value: emojiStats.formatted,
                inline: true
            }
        )
        .setFooter({
            text: `Total Servers: ${guild.client.guilds.cache.size}`
        })
        .setTimestamp();
    
    const features = formatGuildFeatures(guild);
    if (features !== 'None') {
        embed.addFields({
            name: '⭐ Server Features',
            value: features,
            inline: false
        });
    }
    
    if (guild.banner) {
        embed.setImage(guild.bannerURL({ size: 512 }));
    }
    
    return embed;
}

function createGuildLeaveEmbed(guild) {
    const memberStats = formatMemberStats(guild);
    const guildAge = getGuildAge(guild);
    
    const embed = new EmbedBuilder()
        .setTitle('👋 Left Server')
        .setColor(Colors.Red)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .addFields(
            {
                name: '📝 Server Name',
                value: guild.name,
                inline: true
            },
            {
                name: '🆔 Server ID',
                value: `\`${guild.id}\``,
                inline: true
            },
            {
                name: '👥 Had Members',
                value: memberStats.formatted,
                inline: true
            },
            {
                name: '📅 Server Age',
                value: `${guildAge.fullDate}\n(${guildAge.formatted} old)`,
                inline: true
            }
        )
        .setFooter({
            text: `Total Servers: ${guild.client.guilds.cache.size}`
        })
        .setTimestamp();
    
    return embed;
}

async function sendGuildNotification(client, guild, type = 'join') {
    try {
        const channel = await client.channels.fetch(GUILD_LOG_CHANNEL_ID).catch(() => null);
        
        if (!channel || !channel.isTextBased()) {
            console.warn('⚠️ Guild log channel not found or not text-based');
            return;
        }
        
        const embed = type === 'join' 
            ? createGuildJoinEmbed(guild)
            : createGuildLeaveEmbed(guild);
        
        await channel.send({ embeds: [embed] });
        
        console.log(`📤 Sent guild ${type} notification for: ${guild.name} (${guild.id})`);
    } catch (error) {
        console.error(`❌ Failed to send guild ${type} notification:`, error.message);
    }
}

function initializeGuildTracking(client) {
    client.on('guildCreate', async (guild) => {
        console.log(`🎉 Joined new server: ${guild.name} (${guild.id})`);
        console.log(`   - Members: ${guild.memberCount}`);
        console.log(`   - Owner: ${guild.ownerId}`);
        
        await sendGuildNotification(client, guild, 'join');
    });
    
    client.on('guildDelete', async (guild) => {
        console.log(`👋 Left server: ${guild.name} (${guild.id})`);
        
        await sendGuildNotification(client, guild, 'leave');
    });
    
    console.log('✅ Guild tracking initialized');
    console.log(`   - Log channel: ${GUILD_LOG_CHANNEL_ID}`);
}

function getGuildStatistics(client) {
    const guilds = client.guilds.cache;
    const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
    const avgMembers = Math.floor(totalMembers / guilds.size);
    
    const partnered = guilds.filter(g => g.features.includes('PARTNERED')).size;
    const verified = guilds.filter(g => g.features.includes('VERIFIED')).size;
    const community = guilds.filter(g => g.features.includes('COMMUNITY')).size;
    
    const boostLevels = {
        0: guilds.filter(g => g.premiumTier === 0).size,
        1: guilds.filter(g => g.premiumTier === 1).size,
        2: guilds.filter(g => g.premiumTier === 2).size,
        3: guilds.filter(g => g.premiumTier === 3).size
    };
    
    return {
        total: guilds.size,
        totalMembers,
        avgMembers,
        partnered,
        verified,
        community,
        boostLevels
    };
}

function createGuildStatsEmbed(client) {
    const stats = getGuildStatistics(client);
    
    const embed = new EmbedBuilder()
        .setTitle('📊 Bot Server Statistics')
        .setColor(Colors.Blue)
        .addFields(
            {
                name: '🌐 Total Servers',
                value: stats.total.toLocaleString(),
                inline: true
            },
            {
                name: '👥 Total Members',
                value: stats.totalMembers.toLocaleString(),
                inline: true
            },
            {
                name: '📊 Avg Members/Server',
                value: stats.avgMembers.toLocaleString(),
                inline: true
            },
            {
                name: '⭐ Special Servers',
                value: `🤝 ${stats.partnered} Partnered\n✅ ${stats.verified} Verified\n🏘️ ${stats.community} Community`,
                inline: true
            },
            {
                name: '🚀 Boost Distribution',
                value: `⚪ ${stats.boostLevels[0]} (None)\n🥉 ${stats.boostLevels[1]} (T1)\n🥈 ${stats.boostLevels[2]} (T2)\n🥇 ${stats.boostLevels[3]} (T3)`,
                inline: true
            }
        )
        .setFooter({
            text: `${client.user.username} • Server Tracking`
        })
        .setTimestamp();
    
    return embed;
}

module.exports = {
    initializeGuildTracking,
    sendGuildNotification,
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    getGuildStatistics,
    createGuildStatsEmbed,
    GUILD_LOG_CHANNEL_ID
};