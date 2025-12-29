const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BOOST_CATEGORIES, BOOST_COLORS } = require('../../../Configuration/boostConfig');
const { formatTime, formatBoostLabel } = require('./BoostFormatterService');

/**
 * Creates a modern, visually appealing boost overview embed
 */
function createBoostEmbed(boostData, detailsType = null) {
    const { boosts, totals } = boostData;
    const now = Date.now();

    if (detailsType) {
        return createDetailsEmbed(boosts, detailsType, now);
    }

    // Modern gradient color scheme
    const embed = new EmbedBuilder()
        .setTitle("⚡ Active Boost Dashboard")
        .setDescription("*Your current performance multipliers and enhancements*")
        .setColor(0x5865F2) // Discord blurple
        .setTimestamp();

    // Summary stats section with modern formatting
    const summarySection = buildSummarySection(totals, boosts);
    if (summarySection) {
        embed.addFields({
            name: '📊 Performance Overview',
            value: summarySection,
            inline: false
        });
    }

    // Active boosts grouped by category
    const categoryFields = buildModernBoostFields(boosts, now);
    
    if (categoryFields.length > 0) {
        embed.addFields(categoryFields);
        
        // Add visual separator
        embed.addFields({
            name: '\u200B',
            value: '━━━━━━━━━━━━━━━━━━━━',
            inline: false
        });
    } else {
        embed.setDescription(
            "```diff\n" +
            "- No active boosts\n" +
            "```\n" +
            "*Use boost items or complete prayers to gain multipliers!*"
        );
    }

    // Modern footer with tips
    const boostCount = Object.values(boosts).reduce((sum, arr) => sum + arr.length, 0);
    embed.setFooter({ 
        text: `${boostCount} active • Use .boost details <type> for more info • Boosts stack multiplicatively` 
    });

    return embed;
}

/**
 * Creates a detailed view for a specific boost category
 */
function createDetailsEmbed(boosts, detailsType, now) {
    const categoryMap = {
        coin: { name: "🪙 Coin Boosts", color: 0xFFD700, emoji: "💰" },
        gem: { name: "💎 Gem Boosts", color: 0x00FFFF, emoji: "💎" },
        luck: { name: "🍀 Luck Boosts", color: 0x57F287, emoji: "✨" },
        cooldown: { name: "⏱️ Cooldown Reductions", color: 0x5865F2, emoji: "⚡" },
        debuff: { name: "⚠️ Active Debuffs", color: 0xED4245, emoji: "🔻" },
        yuyuko: { name: "🌸 Yuyuko Rolls", color: 0xFF69B4, emoji: "🎲" },
        sanae: { name: "⛩️ Sanae Blessings", color: 0x9B59B6, emoji: "🌊" }
    };

    const categoryKey = detailsType === 'yuyuko' ? 'yuyukoRolls' : detailsType;
    const category = categoryMap[detailsType];

    if (!category) {
        return new EmbedBuilder()
            .setTitle("❓ Unknown Category")
            .setDescription(
                "**Valid categories:**\n" +
                Object.keys(categoryMap).map(k => `\`${k}\``).join(' • ')
            )
            .setColor(0x5865F2)
            .setTimestamp();
    }

    const categoryBoosts = boosts[categoryKey] || [];
    const embed = new EmbedBuilder()
        .setTitle(`${category.name} Details`)
        .setColor(category.color)
        .setTimestamp();

    if (categoryBoosts.length === 0) {
        embed.setDescription(
            "```diff\n" +
            `- No active ${detailsType} boosts\n` +
            "```\n" +
            `*${getBoostTip(detailsType)}*`
        );
    } else {
        // Group boosts by source for better organization
        const groupedBoosts = groupBoostsBySource(categoryBoosts);
        
        let description = "";
        for (const [source, boostList] of Object.entries(groupedBoosts)) {
            description += `\n**${category.emoji} ${source}**\n`;
            
            boostList.forEach(boost => {
                const timeLeft = boost.expiresAt 
                    ? formatTime(boost.expiresAt - now) 
                    : "∞ Permanent";
                const label = formatBoostLabel(boost, timeLeft);
                description += `${label}\n`;
            });
        }

        embed.setDescription(description.trim());

        // Add helpful stats
        const stats = calculateCategoryStats(categoryBoosts, now);
        if (stats) {
            embed.addFields({
                name: '📈 Category Stats',
                value: stats,
                inline: false
            });
        }
    }

    embed.setFooter({ 
        text: 'Use .boost to return to overview' 
    });

    return embed;
}

/**
 * Builds a modern summary section showing total multipliers
 */
function buildSummarySection(totals, boosts) {
    const sections = [];

    if (totals.coin > 1) {
        const percent = ((totals.coin - 1) * 100).toFixed(1);
        sections.push(`💰 **Coin:** \`+${percent}%\` (×${totals.coin.toFixed(2)})`);
    }

    if (totals.gem > 1) {
        const percent = ((totals.gem - 1) * 100).toFixed(1);
        sections.push(`💎 **Gem:** \`+${percent}%\` (×${totals.gem.toFixed(2)})`);
    }

    if (totals.luck > 1) {
        sections.push(`🍀 **Luck:** \`×${totals.luck.toFixed(2)}\``);
    }

    // Check for special boosts
    if (boosts.yuyukoRolls?.length > 0) {
        const rolls = boosts.yuyukoRolls[0].uses;
        sections.push(`🌸 **Yuyuko:** \`${rolls} rolls left\``);
    }

    if (boosts.sanae?.length > 0) {
        const faithBoost = boosts.sanae.find(b => b.type === 'faithPoints');
        if (faithBoost) {
            sections.push(`⛩️ **Faith:** \`${faithBoost.uses}/20 points\``);
        }
    }

    return sections.length > 0 
        ? sections.join('\n')
        : "*No active multipliers*";
}

/**
 * Builds modern boost field entries with better visual hierarchy
 */
function buildModernBoostFields(boosts, now) {
    const fields = [];
    
    const categories = [
        { key: 'coin', name: '💰 Coin Multipliers', icon: '🪙' },
        { key: 'gem', name: '💎 Gem Multipliers', icon: '💎' },
        { key: 'luck', name: '✨ Luck Enhancements', icon: '🍀' },
        { key: 'cooldown', name: '⚡ Speed Boosts', icon: '⏱️' },
        { key: 'sanae', name: '🌊 Divine Blessings', icon: '⛩️' },
        { key: 'yuyukoRolls', name: '🎲 Special Rolls', icon: '🌸' },
        { key: 'debuff', name: '🔻 Active Penalties', icon: '⚠️' }
    ];

    for (const { key, name, icon } of categories) {
        const categoryBoosts = boosts[key];
        if (!categoryBoosts || categoryBoosts.length === 0) continue;

        // Build compact list with modern formatting
        const boostList = categoryBoosts.map(boost => {
            const timeLeft = boost.expiresAt 
                ? formatTime(boost.expiresAt - now) 
                : "∞";
            return formatModernBoostLine(boost, timeLeft);
        }).join('\n');

        fields.push({
            name: `${name} (${categoryBoosts.length})`,
            value: boostList,
            inline: false
        });
    }

    return fields;
}

/**
 * Formats a single boost line with modern styling
 */
function formatModernBoostLine(boost, timeLeft) {
    const { type, source, multiplier, uses, displayValue } = boost;

    // Use custom display if available (Sanae blessings)
    if (displayValue) {
        if (uses !== undefined && uses !== null && type !== 'faithPoints') {
            return `└─ **${displayValue}**`;
        }
        return `└─ **${displayValue}** \`${timeLeft}\``;
    }

    // Special formatting for different boost types
    if (type === 'yuyukoRolls') {
        return `└─ **${uses} Rolls Available** • Yuyuko's Gift`;
    }

    if (type === 'rarityOverride') {
        return `└─ **Equal Odds Mode** \`${uses} rolls\` • ${source}`;
    }

    if (type === 'luckEvery10') {
        return `└─ **×${multiplier} Every 10th Roll** \`${timeLeft}\` • ${source}`;
    }

    if (type === 'summonCooldown') {
        const reduction = Math.round((1 - multiplier) * 100);
        return `└─ **-${reduction}% Cooldown** \`${timeLeft}\` • ${source}`;
    }

    if (type === 'sellPenalty') {
        const penalty = Math.round((1 - multiplier) * 100);
        return `└─ **-${penalty}% Sell Value** \`${timeLeft}\` • ${source}`;
    }

    if (type === 'luck') {
        const isDynamic = boost.isDynamic;
        const prefix = isDynamic ? 'this hour' : 'active';
        return `└─ **×${multiplier.toFixed(2)} Luck** \`${prefix}\` \`${timeLeft}\` • ${source}`;
    }

    // Generic boost format
    const percent = Math.round((multiplier - 1) * 100);
    const sign = percent >= 0 ? '+' : '';
    return `└─ **${sign}${percent}%** \`${timeLeft}\` • ${source}`;
}

/**
 * Groups boosts by their source for better organization
 */
function groupBoostsBySource(boosts) {
    const grouped = {};
    
    for (const boost of boosts) {
        const source = boost.source || 'Unknown';
        if (!grouped[source]) {
            grouped[source] = [];
        }
        grouped[source].push(boost);
    }
    
    return grouped;
}

/**
 * Calculates statistics for a boost category
 */
function calculateCategoryStats(boosts, now) {
    const stats = [];
    
    // Count temporary vs permanent
    const temporary = boosts.filter(b => b.expiresAt && b.expiresAt > now).length;
    const permanent = boosts.filter(b => !b.expiresAt).length;
    
    if (temporary > 0) {
        stats.push(`⏱️ Temporary: **${temporary}**`);
    }
    if (permanent > 0) {
        stats.push(`♾️ Permanent: **${permanent}**`);
    }

    // Find soonest expiring boost
    const soonestExpiry = boosts
        .filter(b => b.expiresAt)
        .sort((a, b) => a.expiresAt - b.expiresAt)[0];
    
    if (soonestExpiry) {
        const timeLeft = formatTime(soonestExpiry.expiresAt - now);
        stats.push(`⏰ Next Expiry: **${timeLeft}**`);
    }

    return stats.length > 0 ? stats.join(' • ') : null;
}

/**
 * Provides helpful tips based on boost type
 */
function getBoostTip(boostType) {
    const tips = {
        coin: "Use coin potions or farm with high-rarity fumos to increase coin gains!",
        gem: "Gem potions and certain prayers can boost your gem income.",
        luck: "Mysterious Dice and Sanae blessings provide powerful luck multipliers.",
        cooldown: "Time Clock items reduce your summon cooldowns significantly.",
        debuff: "Some items or prayers may temporarily reduce your rewards.",
        yuyuko: "Pray to Yuyuko to receive bonus rolls with luck multipliers.",
        sanae: "Build faith points with Sanae to unlock powerful divine blessings!"
    };
    
    return tips[boostType] || "Use various items and prayers to gain boosts!";
}

/**
 * Creates interactive buttons for boost management (optional enhancement)
 */
function createBoostButtons(userId) {
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`boost_refresh_${userId}`)
                .setLabel('Refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`boost_details_${userId}`)
                .setLabel('View All Categories')
                .setEmoji('📋')
                .setStyle(ButtonStyle.Primary)
        );
    
    return row;
}

module.exports = {
    createBoostEmbed,
    createDetailsEmbed,
    createBoostButtons,
    buildSummarySection,
    formatModernBoostLine
};