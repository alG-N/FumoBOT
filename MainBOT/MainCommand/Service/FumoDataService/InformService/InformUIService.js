const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    coinBannerChances, 
    gemBannerChances, 
    ReimuChances, 
    VARIANT_CONFIG,
    formatChanceAsOneInX,
    parsePercentage,
    getVariantChanceInfo
} = require('../../../Configuration/informConfig');

const RARITY_COLORS = {
    'Common': 0x808080,
    'UNCOMMON': 0x1ABC9C,
    'RARE': 0x3498DB,
    'EPIC': 0x9B59B6,
    'OTHERWORLDLY': 0xE91E63,
    'LEGENDARY': 0xF39C12,
    'MYTHICAL': 0xE74C3C,
    'EXCLUSIVE': 0xFF69B4,
    '???': 0x2C3E50,
    'ASTRAL': 0x00CED1,
    'CELESTIAL': 0xFFD700,
    'INFINITE': 0x8B00FF,
    'ETERNAL': 0x00FF00,
    'TRANSCENDENT': 0xFFFFFF
};

/**
 * Create the main inform embed for a fumo
 */
function createInformEmbed(fumoData, userData = null) {
    const { name, rarity, image, lore, series } = fumoData;
    
    const embed = new EmbedBuilder()
        .setTitle(`📖 ${name}`)
        .setColor(RARITY_COLORS[rarity] || 0x808080)
        .setThumbnail(image);
    
    // Basic info
    embed.addFields(
        { name: '⭐ Rarity', value: rarity, inline: true },
        { name: '📚 Series', value: series || 'Unknown', inline: true }
    );
    
    // Lore
    if (lore) {
        embed.setDescription(lore);
    }
    
    // Ownership info if available
    if (userData) {
        const ownedCount = userData.normalCount || 0;
        const shinyCount = userData.shinyCount || 0;
        const algCount = userData.algCount || 0;
        const voidCount = userData.voidCount || 0;
        const glitchedCount = userData.glitchedCount || 0;
        
        let ownershipText = `📦 **Normal:** ${ownedCount}`;
        if (shinyCount > 0) ownershipText += `\n✨ **SHINY:** ${shinyCount}`;
        if (algCount > 0) ownershipText += `\n🌟 **alG:** ${algCount}`;
        if (voidCount > 0) ownershipText += `\n🌀 **VOID:** ${voidCount}`;
        if (glitchedCount > 0) ownershipText += `\n🔮 **GLITCHED:** ${glitchedCount}`;
        
        embed.addFields({ name: '🎒 Your Collection', value: ownershipText, inline: false });
    }
    
    embed.setFooter({ text: 'Use buttons below to view more details' });
    embed.setTimestamp();
    
    return embed;
}

/**
 * Create the chances embed showing all summon rates
 */
function createChancesEmbed(fumoData) {
    const { name, rarity, image } = fumoData;
    
    const embed = new EmbedBuilder()
        .setTitle(`🎲 ${name} - Summon Chances`)
        .setColor(RARITY_COLORS[rarity] || 0x808080)
        .setThumbnail(image);
    
    // Get base chances
    const coinChance = coinBannerChances[rarity];
    const gemChance = gemBannerChances[rarity?.toUpperCase()];
    const reimuChance = ReimuChances[rarity];
    
    // Format chances as "1 in X (Y%)"
    let chancesText = '**📍 Where to Find:**\n\n';
    
    if (coinChance) {
        const coinPercent = parsePercentage(coinChance);
        chancesText += `💰 **Coins Banner:** ${formatChanceAsOneInX(coinPercent)}\n`;
    }
    
    if (gemChance) {
        const gemPercent = parsePercentage(gemChance);
        chancesText += `💎 **Gems Banner:** ${formatChanceAsOneInX(gemPercent)}\n`;
    }
    
    if (reimuChance) {
        const reimuPercent = parsePercentage(reimuChance);
        chancesText += `⛩️ **Reimu Prayer:** ${formatChanceAsOneInX(reimuPercent)}\n`;
    }
    
    chancesText += `\n🏪 **Market:** Available from other players`;
    
    embed.setDescription(chancesText);
    embed.setFooter({ text: 'Chances shown are base rates without boosts' });
    embed.setTimestamp();
    
    return embed;
}

/**
 * Create the variants embed showing all variant chances
 */
function createVariantsEmbed(fumoData, hasBoosts = {}) {
    const { name, rarity, image } = fumoData;
    
    const embed = new EmbedBuilder()
        .setTitle(`✨ ${name} - Variant Chances`)
        .setColor(RARITY_COLORS[rarity] || 0x808080)
        .setThumbnail(image);
    
    // Get base rarity chance for combined calculation
    const baseRarityChance = parsePercentage(coinBannerChances[rarity] || '100%');
    
    let variantsText = '**🎭 Available Variants:**\n\n';
    
    // Normal variant
    variantsText += `📦 **Normal**\n`;
    variantsText += `└ Chance: ${formatChanceAsOneInX(baseRarityChance)}\n\n`;
    
    // SHINY variant
    const shinyInfo = getVariantChanceInfo('SHINY', baseRarityChance);
    variantsText += `${shinyInfo.emoji} **${shinyInfo.tag}**\n`;
    variantsText += `├ Variant Rate: ${shinyInfo.variantChance}\n`;
    variantsText += `├ Combined Rate: ${shinyInfo.combinedChance}\n`;
    variantsText += `└ ${shinyInfo.description}\n\n`;
    
    // alG variant
    const algInfo = getVariantChanceInfo('ALG', baseRarityChance);
    variantsText += `${algInfo.emoji} **${algInfo.tag}**\n`;
    variantsText += `├ Variant Rate: ${algInfo.variantChance}\n`;
    variantsText += `├ Combined Rate: ${algInfo.combinedChance}\n`;
    variantsText += `└ ${algInfo.description}\n\n`;
    
    // VOID variant
    const voidInfo = getVariantChanceInfo('VOID', baseRarityChance);
    const voidStatus = hasBoosts.hasVoidBoost ? '🟢 Active' : '🔴 Requires Boost';
    variantsText += `${voidInfo.emoji} **${voidInfo.tag}** (${voidStatus})\n`;
    variantsText += `├ Variant Rate: ${voidInfo.variantChance}\n`;
    variantsText += `├ Combined Rate: ${voidInfo.combinedChance}\n`;
    variantsText += `├ Boost Sources: ${voidInfo.boostSources.join(', ')}\n`;
    variantsText += `└ ${voidInfo.description}\n\n`;
    
    // GLITCHED variant
    const glitchedInfo = getVariantChanceInfo('GLITCHED', baseRarityChance);
    const glitchedStatus = hasBoosts.hasGlitchedBoost ? '🟢 Active' : '🔴 Requires Boost';
    variantsText += `${glitchedInfo.emoji} **${glitchedInfo.tag}** (${glitchedStatus})\n`;
    variantsText += `├ Variant Rate: ${glitchedInfo.variantChance}\n`;
    variantsText += `├ Combined Rate: ${glitchedInfo.combinedChance}\n`;
    variantsText += `├ Boost Sources: ${glitchedInfo.boostSources.join(', ')}\n`;
    variantsText += `└ ${glitchedInfo.description}\n`;
    
    embed.setDescription(variantsText);
    
    // Footer with boost info
    let footerText = 'VOID requires VoidCrystal • GLITCHED requires CosmicCore or S!gil';
    if (hasBoosts.hasVoidBoost || hasBoosts.hasGlitchedBoost) {
        footerText = `Your active boosts: ${hasBoosts.hasVoidBoost ? '🌀VOID ' : ''}${hasBoosts.hasGlitchedBoost ? '🔮GLITCHED' : ''}`;
    }
    embed.setFooter({ text: footerText });
    embed.setTimestamp();
    
    return embed;
}

/**
 * Create the market value embed
 */
function createMarketEmbed(fumoData, marketData = null) {
    const { name, rarity, image } = fumoData;
    
    const embed = new EmbedBuilder()
        .setTitle(`💰 ${name} - Market Value`)
        .setColor(RARITY_COLORS[rarity] || 0x808080)
        .setThumbnail(image);
    
    // Base sell values
    const FUMO_PRICES = require('../../../Configuration/prayConfig').FUMO_PRICES;
    const baseValue = FUMO_PRICES[rarity] || 100;
    
    let valueText = '**📊 Sell Values:**\n\n';
    valueText += `📦 **Normal:** ${baseValue.toLocaleString()} coins\n`;
    valueText += `✨ **SHINY:** ${Math.floor(baseValue * 2).toLocaleString()} coins\n`;
    valueText += `🌟 **alG:** ${Math.floor(baseValue * 10).toLocaleString()} coins\n`;
    valueText += `🌀 **VOID:** ${Math.floor(baseValue * 5).toLocaleString()} coins\n`;
    valueText += `🔮 **GLITCHED:** ${Math.floor(baseValue * 25).toLocaleString()} coins\n`;
    
    if (marketData) {
        valueText += '\n**🏪 Market Listings:**\n';
        if (marketData.listings && marketData.listings.length > 0) {
            valueText += `├ Lowest Price: ${marketData.lowestPrice?.toLocaleString() || 'N/A'} coins\n`;
            valueText += `├ Average Price: ${marketData.avgPrice?.toLocaleString() || 'N/A'} coins\n`;
            valueText += `└ Listings: ${marketData.listings.length}`;
        } else {
            valueText += '└ No active listings';
        }
    }
    
    embed.setDescription(valueText);
    embed.setFooter({ text: 'Sell values may be affected by boosts' });
    embed.setTimestamp();
    
    return embed;
}

/**
 * Create navigation buttons for inform command
 */
function createInformButtons(userId, fumoName) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`inform_main_${userId}_${fumoName}`)
            .setLabel('📖 Info')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`inform_chances_${userId}_${fumoName}`)
            .setLabel('🎲 Chances')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`inform_variants_${userId}_${fumoName}`)
            .setLabel('✨ Variants')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`inform_market_${userId}_${fumoName}`)
            .setLabel('💰 Market')
            .setStyle(ButtonStyle.Secondary)
    );
    
    return row;
}

/**
 * Create a compact chance display for tooltips/quick view
 */
function formatCompactChance(rarity, variant = 'NORMAL') {
    const baseChance = parsePercentage(coinBannerChances[rarity] || '100%');
    const variantConfig = VARIANT_CONFIG[variant];
    
    if (!variantConfig) return 'N/A';
    
    const finalChance = baseChance * variantConfig.multiplier;
    return formatChanceAsOneInX(finalChance);
}

/**
 * Create summary text for all variants of a rarity
 */
function createVariantSummary(rarity) {
    const baseChance = parsePercentage(coinBannerChances[rarity] || '100%');
    
    const summary = [];
    summary.push(`📦 Normal: ${formatChanceAsOneInX(baseChance)}`);
    summary.push(`✨ SHINY: ${formatChanceAsOneInX(baseChance * 0.01)}`);
    summary.push(`🌟 alG: ${formatChanceAsOneInX(baseChance * 0.00001)}`);
    summary.push(`🌀 VOID: ${formatChanceAsOneInX(baseChance * 0.001)} (boost required)`);
    summary.push(`🔮 GLITCHED: ${formatChanceAsOneInX(baseChance * 0.000002)} (boost required)`);
    
    return summary.join('\n');
}

module.exports = {
    createInformEmbed,
    createChancesEmbed,
    createVariantsEmbed,
    createMarketEmbed,
    createInformButtons,
    formatCompactChance,
    createVariantSummary,
    RARITY_COLORS
};