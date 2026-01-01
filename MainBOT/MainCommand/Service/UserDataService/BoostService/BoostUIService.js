const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatTime } = require('./BoostFormatterService');

/**
 * Creates the main boost overview embed with summary stats
 */
function createBoostEmbed(boostData, category = null) {
    const { boosts, totals } = boostData;
    const now = Date.now();

    // If a category is selected, show that category's details
    if (category) {
        return createCategoryEmbed(boosts, category, now);
    }

    // Main overview embed
    const embed = new EmbedBuilder()
        .setTitle("⚡ Active Boosts Overview")
        .setColor(0x5865F2)
        .setTimestamp();

    // Build summary
    const summaryLines = [];
    
    if (totals.coin > 1) {
        const percent = ((totals.coin - 1) * 100).toFixed(1);
        summaryLines.push(`💰 **Coin:** +${percent}% (×${totals.coin.toFixed(2)})`);
    }
    if (totals.gem > 1) {
        const percent = ((totals.gem - 1) * 100).toFixed(1);
        summaryLines.push(`💎 **Gem:** +${percent}% (×${totals.gem.toFixed(2)})`);
    }
    if (totals.luck > 1) {
        summaryLines.push(`🍀 **Luck:** ×${totals.luck.toFixed(2)}`);
    }

    // Count boosts per category
    const counts = {
        coin: boosts.coin?.length || 0,
        gem: boosts.gem?.length || 0,
        luck: boosts.luck?.length || 0,
        special: boosts.special?.length || 0,
        sanae: boosts.sanae?.length || 0,
        cooldown: boosts.cooldown?.length || 0,
        debuff: boosts.debuff?.length || 0,
        yuyuko: boosts.yuyukoRolls?.length || 0
    };

    const totalBoosts = Object.values(counts).reduce((a, b) => a + b, 0);

    if (summaryLines.length > 0) {
        embed.setDescription(
            `*Click a button below to view category details*\n\n` +
            `**📊 Totals:**\n${summaryLines.join('\n')}`
        );
    } else {
        embed.setDescription(
            `*You have no active boosts.*\n\n` +
            `Use items, prayers, or other features to gain boosts!`
        );
    }

    // Quick category overview
    const categoryOverview = [];
    if (counts.coin > 0) categoryOverview.push(`💰 Coin: ${counts.coin}`);
    if (counts.gem > 0) categoryOverview.push(`💎 Gem: ${counts.gem}`);
    if (counts.luck > 0) categoryOverview.push(`🍀 Luck: ${counts.luck}`);
    if (counts.special > 0) categoryOverview.push(`🔮 Special: ${counts.special}`);
    if (counts.sanae > 0) categoryOverview.push(`⛩️ Divine: ${counts.sanae}`);
    if (counts.cooldown > 0) categoryOverview.push(`⚡ Speed: ${counts.cooldown}`);
    if (counts.yuyuko > 0) categoryOverview.push(`🌸 Yuyuko: ${counts.yuyuko}`);
    if (counts.debuff > 0) categoryOverview.push(`⚠️ Debuff: ${counts.debuff}`);

    if (categoryOverview.length > 0) {
        embed.addFields({
            name: '📋 Active Categories',
            value: categoryOverview.join(' • '),
            inline: false
        });
    }

    embed.setFooter({ text: `${totalBoosts} total boosts active` });

    return embed;
}

/**
 * Creates a detailed embed for a specific category
 */
function createCategoryEmbed(boosts, category, now) {
    const categoryConfig = {
        coin: { name: '💰 Coin Boosts', color: 0xFFD700, key: 'coin' },
        gem: { name: '💎 Gem Boosts', color: 0x00FFFF, key: 'gem' },
        luck: { name: '🍀 Luck Boosts', color: 0x57F287, key: 'luck' },
        special: { name: '🔮 Special Effects', color: 0x8B00FF, key: 'special' },
        sanae: { name: '⛩️ Divine Blessings', color: 0x9B59B6, key: 'sanae' },
        cooldown: { name: '⚡ Speed Boosts', color: 0x5865F2, key: 'cooldown' },
        yuyuko: { name: '🌸 Yuyuko Rolls', color: 0xFF69B4, key: 'yuyukoRolls' },
        debuff: { name: '⚠️ Active Penalties', color: 0xED4245, key: 'debuff' }
    };

    const config = categoryConfig[category];
    if (!config) {
        return new EmbedBuilder()
            .setTitle("❓ Unknown Category")
            .setDescription("Invalid category selected.")
            .setColor(0xFF0000);
    }

    const categoryBoosts = boosts[config.key] || [];
    
    const embed = new EmbedBuilder()
        .setTitle(config.name)
        .setColor(config.color)
        .setTimestamp();

    if (categoryBoosts.length === 0) {
        embed.setDescription(`*No active ${category} boosts*`);
        return embed;
    }

    // Format each boost in a clean way
    const boostLines = categoryBoosts.map(boost => formatBoostLine(boost, now));
    embed.setDescription(boostLines.join('\n'));

    // Count temporary vs permanent
    const temporary = categoryBoosts.filter(b => b.expiresAt).length;
    const permanent = categoryBoosts.filter(b => !b.expiresAt).length;

    const stats = [];
    if (temporary > 0) stats.push(`⏱️ Temporary: ${temporary}`);
    if (permanent > 0) stats.push(`♾️ Permanent: ${permanent}`);

    if (stats.length > 0) {
        embed.setFooter({ text: stats.join(' • ') });
    }

    return embed;
}

/**
 * Format a single boost line in the old clean format
 */
function formatBoostLine(boost, now) {
    const { type, source, multiplier, expiresAt, uses, displayValue } = boost;
    const timeLeft = expiresAt ? formatTime(expiresAt - now) : '∞';

    // Use custom displayValue if available (Sanae blessings)
    if (displayValue) {
        return `• **${source}** — ${displayValue}${expiresAt ? ` (${timeLeft})` : ''}`;
    }

    // Yuyuko Rolls
    if (type === 'yuyukoRolls') {
        return `• **Yuyuko** — ${uses} bonus rolls remaining`;
    }

    // Rarity Override (Nullified)
    if (type === 'rarityOverride') {
        return `• **${source}** — Equal odds for ${uses} rolls`;
    }

    // Lumina
    if (type === 'luckEvery10') {
        return `• **${source}** — ×${multiplier} luck every 10th roll (${timeLeft})`;
    }

    // Speed boosts
    if (type === 'summonCooldown' || type === 'summonSpeed') {
        const speedPercent = Math.round(multiplier * 100);
        return `• **${source}** — ${speedPercent}% faster (${timeLeft})`;
    }

    if (type === 'rollSpeed') {
        return `• **${source}** — ×${multiplier.toFixed(2)} roll speed (${timeLeft})`;
    }

    // Debuffs
    if (type === 'sellPenalty') {
        const penalty = Math.round((1 - multiplier) * 100);
        return `• **${source}** — -${penalty}% sell value (${timeLeft})`;
    }

    // === SPECIAL EFFECTS ===
    
    // VOID Trait
    if (type === 'voidTrait') {
        const chance = (multiplier * 100).toFixed(2);
        return `• **${source}** — 🌀 VOID Trait: ${chance}% chance (${timeLeft})`;
    }

    // GLITCHED Trait  
    if (type === 'glitchedTrait') {
        const chance = multiplier > 0 ? `1 in ${Math.round(1/multiplier).toLocaleString()}` : 'Enabled';
        return `• **${source}** — 🔮 GLITCHED Trait: ${chance} (${timeLeft})`;
    }

    // Variant/Trait Luck
    if (type === 'traitLuck' || type === 'variantLuck') {
        return `• **${source}** — ×${multiplier.toFixed(2)} variant luck (${timeLeft})`;
    }

    // Sell Value
    if (type === 'sell' || type === 'sellValue' || type === 'sellvalue') {
        const percent = Math.round(multiplier * 100);
        return `• **${source}** — +${percent}% sell value (${timeLeft})`;
    }

    // Reimu Luck
    if (type === 'reimuLuck' || type === 'reimuluck') {
        const percent = Math.round((multiplier - 1) * 100);
        return `• **${source}** — +${percent}% luck (${timeLeft})`;
    }

    // Astral Block
    if (type === 'astralBlock' || type === 'astralblock') {
        return `• **${source}** — No ASTRAL+ duplicates (${timeLeft})`;
    }

    // Nullified Rolls
    if (type === 'nullifiedRolls' || type === 'nullifiedrolls') {
        let info = 'Active';
        try {
            const extra = JSON.parse(boost.extra || '{}');
            if (extra.remaining !== undefined) {
                info = `${extra.remaining}/${extra.total || 10} left`;
            }
        } catch {}
        return `• **${source}** — Nullified rolls: ${info} (${timeLeft})`;
    }

    // === LUCK BOOSTS ===
    if (type === 'luck') {
        if (boost.isDynamic) {
            return `• **${source}** — ×${multiplier.toFixed(4)} this hour (${timeLeft})`;
        }
        return `• **${source}** — ×${multiplier.toFixed(2)} luck (${timeLeft})`;
    }

    // === DEFAULT: Coin/Gem ===
    const percent = Math.round((multiplier - 1) * 100);
    const sign = percent >= 0 ? '+' : '';
    const stack = boost.stack ? ` [${boost.stack}x]` : '';
    return `• **${source}**${stack} — ${sign}${percent}% (${timeLeft})`;
}

/**
 * Creates navigation buttons for boost categories
 */
function createBoostButtons(userId, currentCategory = null) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`boost_overview_${userId}`)
            .setLabel('Overview')
            .setEmoji('📊')
            .setStyle(currentCategory === null ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_coin_${userId}`)
            .setLabel('Coin')
            .setEmoji('💰')
            .setStyle(currentCategory === 'coin' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_gem_${userId}`)
            .setLabel('Gem')
            .setEmoji('💎')
            .setStyle(currentCategory === 'gem' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_luck_${userId}`)
            .setLabel('Luck')
            .setEmoji('🍀')
            .setStyle(currentCategory === 'luck' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`boost_special_${userId}`)
            .setLabel('Special')
            .setEmoji('🔮')
            .setStyle(currentCategory === 'special' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_sanae_${userId}`)
            .setLabel('Divine')
            .setEmoji('⛩️')
            .setStyle(currentCategory === 'sanae' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_cooldown_${userId}`)
            .setLabel('Speed')
            .setEmoji('⚡')
            .setStyle(currentCategory === 'cooldown' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`boost_refresh_${userId}`)
            .setLabel('Refresh')
            .setEmoji('🔄')
            .setStyle(ButtonStyle.Success)
    );

    return [row1, row2];
}

module.exports = {
    createBoostEmbed,
    createCategoryEmbed,
    createBoostButtons,
    formatBoostLine
};