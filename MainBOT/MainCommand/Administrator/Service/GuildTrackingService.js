/**
 * Guild Tracking Service
 * Handles guild join/leave tracking and statistics
 */

const { EmbedBuilder, Colors } = require('discord.js');
const { GUILD_LOG_CHANNEL_ID, GUILD_FEATURES_MAP, BOOST_TIERS } = require('../Config/adminConfig');
const { getAge } = require('../Utils/adminUtils');

// ═══════════════════════════════════════════════════════════════
// GUILD STATISTICS HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Format member statistics for a guild
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Member stats object
 */
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

/**
 * Get guild age information
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Age info object
 */
function getGuildAge(guild) {
    return getAge(guild.createdAt);
}

/**
 * Format guild features
 * @param {Guild} guild - Discord guild
 * @returns {string} - Formatted features string
 */
function formatGuildFeatures(guild) {
    if (!guild.features || guild.features.length === 0) {
        return 'None';
    }
    
    return guild.features
        .map(f => GUILD_FEATURES_MAP[f] || f)
        .slice(0, 10)
        .join('\n') || 'None';
}

/**
 * Format boost information
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Boost info object
 */
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

/**
 * Get channel statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Channel stats object
 */
function getChannelStats(guild) {
    const channels = guild.channels.cache;
    
    const text = channels.filter(c => c.type === 0).size;
    const voice = channels.filter(c => c.type === 2).size;
    const category = channels.filter(c => c.type === 4).size;
    const forum = channels.filter(c => c.type === 15).size;
    const stage = channels.filter(c => c.type === 13).size;
    
    let formatted = `💬 ${text} • 🔊 ${voice} • 📁 ${category}`;
    if (forum > 0) formatted += ` • 📋 ${forum}`;
    if (stage > 0) formatted += ` • 🎤 ${stage}`;
    
    return {
        total: channels.size,
        text,
        voice,
        category,
        forum,
        stage,
        formatted
    };
}

/**
 * Get role statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Role stats object
 */
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

/**
 * Get emoji statistics
 * @param {Guild} guild - Discord guild
 * @returns {Object} - Emoji stats object
 */
function getEmojiStats(guild) {
    const emojis = guild.emojis.cache;
    const animated = emojis.filter(e => e.animated).size;
    const staticCount = emojis.size - animated;
    
    return {
        total: emojis.size,
        static: staticCount,
        animated,
        formatted: `${emojis.size} (😀 ${staticCount} • <a:emoji:1> ${animated})`
    };
}

// ═══════════════════════════════════════════════════════════════
// EMBED CREATION
// ═══════════════════════════════════════════════════════════════

/**
 * Create embed for guild join event
 * @param {Guild} guild - Discord guild
 * @returns {EmbedBuilder} - Guild join embed
 */
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

/**
 * Create embed for guild leave event
 * @param {Guild} guild - Discord guild
 * @returns {EmbedBuilder} - Guild leave embed
 */
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

/**
 * Create embed for bot server statistics
 * @param {Client} client - Discord client
 * @returns {EmbedBuilder} - Stats embed
 */
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

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION HANDLING
// ═══════════════════════════════════════════════════════════════

/**
 * Send guild notification to log channel
 * @param {Client} client - Discord client
 * @param {Guild} guild - Discord guild
 * @param {string} type - 'join' or 'leave'
 */
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

// ═══════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════

/**
 * Get overall guild statistics
 * @param {Client} client - Discord client
 * @returns {Object} - Statistics object
 */
function getGuildStatistics(client) {
    const guilds = client.guilds.cache;
    const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
    const avgMembers = guilds.size > 0 ? Math.floor(totalMembers / guilds.size) : 0;
    
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

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize guild tracking on client
 * @param {Client} client - Discord client
 */
function initializeGuildTracking(client) {
    client.on('guildCreate', async (guild) => {
        console.log(`🎉 Joined new server: ${guild.name} (${guild.id})`);
        console.log(`   - Members: ${guild.memberCount}`);
        console.log(`   - Owner: ${guild.ownerId}`);
        
        // Send notification to admin log channel
        await sendGuildNotification(client, guild, 'join');
        
        // Send welcome message to the server
        await sendWelcomeMessage(guild);
    });
    
    client.on('guildDelete', async (guild) => {
        console.log(`👋 Left server: ${guild.name} (${guild.id})`);
        
        await sendGuildNotification(client, guild, 'leave');
    });
    
    console.log('✅ Guild tracking initialized');
    console.log(`   - Log channel: ${GUILD_LOG_CHANNEL_ID}`);
}

/**
 * Create welcome embed for new servers
 * @returns {EmbedBuilder} - Welcome embed
 */
function createWelcomeEmbed() {
    return new EmbedBuilder()
        .setTitle('🎉 Thanks for inviting FumoBOT!')
        .setColor(0xFFB6C1) // Light pink - Fumo themed
        .setDescription(
            'Hello! I\'m **FumoBOT** - your gateway to collecting adorable Fumo plushies and more!\n\n' +
            'Here\'s a quick guide to get you started:'
        )
        .addFields(
            {
                name: '🎴 __Main Commands (Fumo Collection)__',
                value: 
                    '`/start` - Begin your Fumo journey!\n' +
                    '`/pray` - Pray for Fumos (free daily!)\n' +
                    '`/collection` - View your Fumo collection\n' +
                    '`/daily` - Claim daily rewards\n' +
                    '`/shop` - Buy items and upgrades\n' +
                    '`/trade` - Trade Fumos with others\n' +
                    '`/craft` - Craft special items\n' +
                    '`/library` - View all available Fumos',
                inline: false
            },
            {
                name: '🔧 __Sub Commands (Utilities)__',
                value: 
                    '`/pixiv` - Search Pixiv artwork\n' +
                    '`/video` - Download videos (requires Cobalt)\n' +
                    '`/music` - Play music in voice channels\n' +
                    '`/avatar` - Get user avatars\n' +
                    '`/serverinfo` - Server information',
                inline: false
            },
            {
                name: '💡 __Pro Tips__',
                value: 
                    '• Use `/tutorial` to learn the game mechanics\n' +
                    '• Join events for exclusive limited Fumos!\n' +
                    '• Complete quests for bonus rewards\n' +
                    '• Farm coins with `/farm` commands',
                inline: false
            },
            {
                name: '🔗 __Links__',
                value: 
                    '[Support Server](https://discord.gg/fumobot) • ' +
                    '[Invite Bot](https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID) • ' +
                    '[GitHub](https://github.com/alG-N/FumoBOT)',
                inline: false
            }
        )
        .setImage('https://i.imgur.com/placeholder.png') // Replace with actual Fumo banner
        .setFooter({ text: 'Use /help for full command list • Have fun collecting!' })
        .setTimestamp();
}

/**
 * Send welcome message to a newly joined guild
 * @param {Guild} guild - Discord guild
 */
async function sendWelcomeMessage(guild) {
    try {
        // Try to find a suitable channel to send the welcome message
        const systemChannel = guild.systemChannel;
        const publicChannels = guild.channels.cache
            .filter(c => 
                c.type === 0 && // Text channel
                c.permissionsFor(guild.members.me)?.has(['SendMessages', 'EmbedLinks'])
            )
            .sort((a, b) => a.position - b.position);
        
        // Priority: System channel > General-like channels > First available
        let targetChannel = systemChannel;
        
        if (!targetChannel || !targetChannel.permissionsFor(guild.members.me)?.has(['SendMessages', 'EmbedLinks'])) {
            // Look for common welcome/general channel names
            const commonNames = ['general', 'chat', 'welcome', 'lobby', 'main', 'bot-commands', 'bots'];
            targetChannel = publicChannels.find(c => 
                commonNames.some(name => c.name.toLowerCase().includes(name))
            );
        }
        
        if (!targetChannel) {
            targetChannel = publicChannels.first();
        }
        
        if (!targetChannel) {
            console.log(`⚠️ Could not find suitable channel to send welcome message in ${guild.name}`);
            return;
        }
        
        const welcomeEmbed = createWelcomeEmbed();
        await targetChannel.send({ embeds: [welcomeEmbed] });
        
        console.log(`✅ Sent welcome message to ${guild.name} in #${targetChannel.name}`);
    } catch (error) {
        console.error(`❌ Failed to send welcome message to ${guild.name}:`, error.message);
    }
}

module.exports = {
    // Initialization
    initializeGuildTracking,
    
    // Statistics helpers
    formatMemberStats,
    getGuildAge,
    formatGuildFeatures,
    formatBoostInfo,
    getChannelStats,
    getRoleStats,
    getEmojiStats,
    
    // Embed creation
    createGuildJoinEmbed,
    createGuildLeaveEmbed,
    createGuildStatsEmbed,
    createWelcomeEmbed,
    
    // Notifications
    sendGuildNotification,
    sendWelcomeMessage,
    
    // Statistics
    getGuildStatistics,
    
    // Constants
    GUILD_LOG_CHANNEL_ID
};
