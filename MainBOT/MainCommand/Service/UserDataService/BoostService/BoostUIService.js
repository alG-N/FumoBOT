const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatTime } = require('./BoostFormatterService');

/**
 * Creates the main boost overview embed with summary stats
 */
function createBoostEmbed(boostData, category = null) {
    const { boosts, totals, disabledBoosts, sigilActive } = boostData;
    const now = Date.now();

    // If a category is selected, show that category's details
    if (category) {
        return createCategoryEmbed(boosts, category, now, disabledBoosts, sigilActive);
    }

    // Main overview embed
    const embed = new EmbedBuilder()
        .setTitle(sigilActive ? "⚡ Active Boosts Overview (S!gil Active)" : "⚡ Active Boosts Overview")
        .setColor(sigilActive ? 0x8B00FF : 0x5865F2)
        .setTimestamp();

    // Build summary
    const summaryLines = [];
    
    if (totals.coin > 1) {
        const percent = (totals.coin * 100).toFixed(0);
        summaryLines.push(`💰 **Coin:** +${percent}% (×${totals.coin.toFixed(2)})`);
    }
    if (totals.gem > 1) {
        const percent = (totals.gem * 100).toFixed(0);
        summaryLines.push(`💎 **Gem:** +${percent}% (×${totals.gem.toFixed(2)})`);
    }
    if (totals.luck > 1) {
        summaryLines.push(`🍀 **Luck:** ×${totals.luck.toFixed(2)}`);
    }

    // Count boosts per category (Yuyuko is now part of Divine/sanae)
    const counts = {
        coin: boosts.coin?.length || 0,
        gem: boosts.gem?.length || 0,
        luck: boosts.luck?.length || 0,
        special: boosts.special?.length || 0,
        sanae: boosts.sanae?.length || 0,
        cooldown: boosts.cooldown?.length || 0,
        debuff: boosts.debuff?.length || 0
    };

    // Count disabled boosts if S!gil is active
    const disabledCounts = {
        coin: disabledBoosts?.coin?.length || 0,
        gem: disabledBoosts?.gem?.length || 0,
        luck: disabledBoosts?.luck?.length || 0,
        special: disabledBoosts?.special?.length || 0,
        sanae: disabledBoosts?.sanae?.length || 0,
        cooldown: disabledBoosts?.cooldown?.length || 0,
        debuff: disabledBoosts?.debuff?.length || 0
    };

    const totalBoosts = Object.values(counts).reduce((a, b) => a + b, 0);
    const totalDisabled = Object.values(disabledCounts).reduce((a, b) => a + b, 0);

    if (summaryLines.length > 0) {
        let description = `*Click a button below to view category details*\n\n` +
            `**📊 Totals:**\n${summaryLines.join('\n')}`;
        
        if (sigilActive && totalDisabled > 0) {
            description += `\n\n⚠️ *${totalDisabled} boosts are temporarily disabled by S!gil*`;
        }
        
        embed.setDescription(description);
    } else {
        embed.setDescription(
            `*You have no active boosts.*\n\n` +
            `Use items, prayers, or other features to gain boosts!`
        );
    }

    // Quick category overview
    const categoryOverview = [];
    if (counts.coin > 0 || disabledCounts.coin > 0) categoryOverview.push(`💰 Coin: ${counts.coin}${disabledCounts.coin > 0 ? ` (+${disabledCounts.coin} ⏸️)` : ''}`);
    if (counts.gem > 0 || disabledCounts.gem > 0) categoryOverview.push(`💎 Gem: ${counts.gem}${disabledCounts.gem > 0 ? ` (+${disabledCounts.gem} ⏸️)` : ''}`);
    if (counts.luck > 0 || disabledCounts.luck > 0) categoryOverview.push(`🍀 Luck: ${counts.luck}${disabledCounts.luck > 0 ? ` (+${disabledCounts.luck} ⏸️)` : ''}`);
    if (counts.special > 0 || disabledCounts.special > 0) categoryOverview.push(`🔮 Special: ${counts.special}${disabledCounts.special > 0 ? ` (+${disabledCounts.special} ⏸️)` : ''}`);
    if (counts.sanae > 0 || disabledCounts.sanae > 0) categoryOverview.push(`⛩️ Divine: ${counts.sanae}${disabledCounts.sanae > 0 ? ` (+${disabledCounts.sanae} ⏸️)` : ''}`);
    if (counts.cooldown > 0 || disabledCounts.cooldown > 0) categoryOverview.push(`⚡ Speed: ${counts.cooldown}${disabledCounts.cooldown > 0 ? ` (+${disabledCounts.cooldown} ⏸️)` : ''}`);
    if (counts.debuff > 0) categoryOverview.push(`⚠️ Debuff: ${counts.debuff}`);

    if (categoryOverview.length > 0) {
        embed.addFields({
            name: '📋 Active Categories',
            value: categoryOverview.join(' • '),
            inline: false
        });
    }

    embed.setFooter({ text: `${totalBoosts} total boosts active${totalDisabled > 0 ? ` • ${totalDisabled} disabled by S!gil` : ''}` });

    return embed;
}

/**
 * Creates a detailed embed for a specific category
 */
function createCategoryEmbed(boosts, category, now, disabledBoosts = null, sigilActive = false) {
    const categoryConfig = {
        coin: { name: '💰 Coin Boosts', color: 0xFFD700, key: 'coin' },
        gem: { name: '💎 Gem Boosts', color: 0x00FFFF, key: 'gem' },
        luck: { name: '🍀 Luck Boosts', color: 0x57F287, key: 'luck' },
        special: { name: '🔮 Special Effects', color: 0x8B00FF, key: 'special' },
        sanae: { name: '⛩️ Divine Blessings (Pray)', color: 0x9B59B6, key: 'sanae' },
        cooldown: { name: '⚡ Speed Boosts', color: 0x5865F2, key: 'cooldown' },
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
    const categoryDisabled = disabledBoosts?.[config.key] || [];
    
    const embed = new EmbedBuilder()
        .setTitle(sigilActive ? `${config.name} (S!gil Active)` : config.name)
        .setColor(config.color)
        .setTimestamp();

    if (categoryBoosts.length === 0 && categoryDisabled.length === 0) {
        embed.setDescription(`*No active ${category} boosts*`);
        return embed;
    }

    // Format each boost in a clean way
    const boostLines = categoryBoosts.map(boost => formatBoostLine(boost, now));
    
    // Add disabled boosts with DISABLED tag (timer shows as FROZEN)
    if (sigilActive && categoryDisabled.length > 0) {
        boostLines.push(''); // Empty line separator
        boostLines.push('**⏸️ Disabled by S!gil:**');
        categoryDisabled.forEach(boost => {
            boostLines.push(formatDisabledBoostLine(boost));
        });
    }
    
    embed.setDescription(boostLines.join('\n'));

    // Count temporary vs permanent
    const temporary = categoryBoosts.filter(b => b.expiresAt).length;
    const permanent = categoryBoosts.filter(b => !b.expiresAt).length;

    const stats = [];
    if (temporary > 0) stats.push(`⏱️ Temporary: ${temporary}`);
    if (permanent > 0) stats.push(`♾️ Permanent: ${permanent}`);
    if (categoryDisabled.length > 0) stats.push(`⏸️ Disabled: ${categoryDisabled.length}`);

    if (stats.length > 0) {
        embed.setFooter({ text: stats.join(' • ') });
    }

    return embed;
}

/**
 * Format a disabled boost line with FROZEN timer
 */
function formatDisabledBoostLine(boost) {
    const { type, source, multiplier, expiresAt, uses, displayValue, extra } = boost;
    
    // Extract frozen time remaining from extra if available
    let frozenTimer = '';
    if (extra) {
        try {
            const extraData = typeof extra === 'string' ? JSON.parse(extra) : extra;
            if (extraData.frozenTimeRemaining && extraData.frozenTimeRemaining > 0) {
                frozenTimer = ` (${formatTime(extraData.frozenTimeRemaining)})`;
            }
        } catch (e) {
            // Silently ignore parse errors
        }
    }

    // Use custom displayValue if available
    if (displayValue) {
        return `• ~~**${source}**~~ — ${displayValue}${frozenTimer} (**FROZEN**)`;
    }

    // Yuyuko Rolls
    if (type === 'yuyukoRolls') {
        return `• ~~**Yuyuko**~~ — ${uses} bonus rolls${frozenTimer} (**FROZEN**)`;
    }

    // Rarity Override (Nullified)
    if (type === 'rarityOverride') {
        return `• ~~**${source}**~~ — Equal odds for ${uses} rolls${frozenTimer} (**FROZEN**)`;
    }

    // Lumina
    if (type === 'luckEvery10') {
        return `• ~~**${source}**~~ — ×${multiplier} luck every 10th roll${frozenTimer} (**FROZEN**)`;
    }

    // Speed boosts
    if (type === 'summonCooldown' || type === 'summonSpeed') {
        const speedPercent = Math.round(multiplier * 100);
        return `• ~~**${source}**~~ — ${speedPercent}% faster${frozenTimer} (**FROZEN**)`;
    }

    if (type === 'rollSpeed') {
        return `• ~~**${source}**~~ — ×${multiplier.toFixed(2)} roll speed${frozenTimer} (**FROZEN**)`;
    }

    // VOID Trait - use 1 in X format
    if (type === 'voidTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• ~~**${source}**~~ — 🌀 VOID Trait: 1 in ${oneInX}${frozenTimer} (**FROZEN**)`;
    }

    // GLITCHED Trait  
    if (type === 'glitchedTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• ~~**${source}**~~ — 🔮 GLITCHED Trait: 1 in ${oneInX}${frozenTimer} (**FROZEN**)`;
    }

    // Variant/Trait Luck
    if (type === 'traitLuck' || type === 'variantLuck') {
        return `• ~~**${source}**~~ — ×${multiplier.toFixed(2)} variant luck${frozenTimer} (**FROZEN**)`;
    }

    // Default format for coin/gem boosts
    const percent = Math.round(multiplier * 100);
    const formattedMult = multiplier.toFixed(2);
    return `• ~~**${source}**~~ — +${percent}% (×${formattedMult})${frozenTimer} (**FROZEN**)`;
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
    
    // VOID Trait - use 1 in X format
    if (type === 'voidTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• **${source}** — 🌀 VOID Trait: 1 in ${oneInX} (${timeLeft})`;
    }

    // GLITCHED Trait  
    if (type === 'glitchedTrait') {
        const oneInX = multiplier > 0 ? Math.round(1 / multiplier).toLocaleString() : '?';
        return `• **${source}** — 🔮 GLITCHED Trait: 1 in ${oneInX} (${timeLeft})`;
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
    const percent = Math.round(multiplier * 100);
    const sign = '+';
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