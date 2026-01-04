const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { formatNumber } = require('../../../Ultility/formatting');
const { RARITY_EMOJI, RARITY_COLORS, RARITY_ORDER } = require('../../../Configuration/itemConfig');

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════
const INVENTORY_THEMES = {
    default: { name: 'Treasure Trove', emoji: '🎒', color: 0x5865F2 },
    dark: { name: 'Shadow Vault', emoji: '🌑', color: 0x2C2F33 },
    gold: { name: 'Golden Treasury', emoji: '👑', color: 0xFFD700 },
    crystal: { name: 'Crystal Archive', emoji: '💎', color: 0x00D9FF }
};

const RARITY_DECORATIONS = {
    'Basic': { prefix: '▫️', bar: '░', accent: '⚫' },
    'Common': { prefix: '▪️', bar: '▒', accent: '⚪' },
    'Rare': { prefix: '🔷', bar: '▓', accent: '🔵' },
    'Epic': { prefix: '🔮', bar: '█', accent: '🟣' },
    'Legendary': { prefix: '⭐', bar: '█', accent: '🟠' },
    'Mythical': { prefix: '🌟', bar: '█', accent: '🔴' },
    'Divine': { prefix: '✨', bar: '█', accent: '💫' },
    'Secret': { prefix: '❓', bar: '█', accent: '🎭' },
    'Unknown': { prefix: '🌀', bar: '█', accent: '🌀' },
    'Prime': { prefix: '👑', bar: '█', accent: '👑' }
};

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a visual progress bar
 */
function createProgressBar(current, max, length = 10, filled = '█', empty = '░') {
    if (max === 0) return empty.repeat(length);
    const percentage = Math.min(current / max, 1);
    const filledLength = Math.round(percentage * length);
    return filled.repeat(filledLength) + empty.repeat(length - filledLength);
}

/**
 * Get the dominant rarity color from page data
 */
function getDominantRarityColor(pageData) {
    for (const rarity of [...RARITY_ORDER].reverse()) {
        if (pageData[rarity] && pageData[rarity].length > 0) {
            return RARITY_COLORS[rarity] || 0x5865F2;
        }
    }
    return 0x5865F2;
}

/**
 * Format item name for display (removes rarity suffix for cleaner look)
 */
function formatItemName(itemName) {
    // Remove the rarity suffix like (C), (R), etc.
    return itemName.replace(/\([A-Z?]+\)$/, '').trim();
}

/**
 * Get collection tier based on unique item count
 */
function getCollectionTier(uniqueItems) {
    if (uniqueItems >= 200) return { emoji: '👑', title: 'Master Collector' };
    if (uniqueItems >= 100) return { emoji: '💎', title: 'Expert Collector' };
    if (uniqueItems >= 50) return { emoji: '⭐', title: 'Seasoned Collector' };
    if (uniqueItems >= 25) return { emoji: '🔷', title: 'Aspiring Collector' };
    return { emoji: '📦', title: 'Beginner Collector' };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN INVENTORY EMBED
// ═══════════════════════════════════════════════════════════════════

function createInventoryEmbed(user, pageData, stats, currentPage, totalPages, theme = 'default') {
    const themeConfig = INVENTORY_THEMES[theme] || INVENTORY_THEMES.default;
    const collectionTier = getCollectionTier(stats.totalUniqueItems);
    const dominantColor = getDominantRarityColor(pageData);
    
    // Build header description with visual flair
    const headerLines = [
        `📦 **Items:** ${formatNumber(stats.totalItems)} 🔖 **Unique:** ${stats.totalUniqueItems} ║`,
        `${collectionTier.emoji} **${collectionTier.title}**`,
    ];

    const embed = new EmbedBuilder()
        .setTitle(`${themeConfig.emoji} ${user.username}'s ${themeConfig.name}`)
        .setDescription(headerLines.join('\n'))
        .setColor(dominantColor)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setFooter({ 
            text: `📄 Page ${currentPage + 1}/${totalPages} • 💡 Tip: Use .item <name> for details`,
            iconURL: user.displayAvatarURL({ size: 32 })
        })
        .setTimestamp();

    // Add rarity sections with enhanced formatting
    for (const [rarity, items] of Object.entries(pageData)) {
        const decoration = RARITY_DECORATIONS[rarity] || RARITY_DECORATIONS['Common'];
        const emoji = RARITY_EMOJI[rarity] || '⚪';
        const rarityStats = stats.byRarity[rarity] || { count: 0, uniqueCount: 0 };
        
        let itemList;
        if (items.length > 0) {
            // Group items and format nicely
            itemList = items.map(item => {
                const cleanName = formatItemName(item.name);
                const quantityStr = item.quantity > 1 ? ` ×${formatNumber(item.quantity)}` : '';
                return `${decoration.prefix} ${cleanName}${quantityStr}`;
            }).join('\n');
        } else {
            itemList = `*${decoration.accent} Empty - No ${rarity.toLowerCase()} items yet*`;
        }

        // Truncate if too long
        if (itemList.length > 1000) {
            const truncatedItems = items.slice(0, 15);
            itemList = truncatedItems.map(item => {
                const cleanName = formatItemName(item.name);
                const quantityStr = item.quantity > 1 ? ` ×${formatNumber(item.quantity)}` : '';
                return `${decoration.prefix} ${cleanName}${quantityStr}`;
            }).join('\n');
            itemList += `\n*...and ${items.length - 15} more items*`;
        }

        // Create header with stats
        const header = `${emoji} **${rarity}** ─ ${formatNumber(rarityStats.count)} items (${rarityStats.uniqueCount} types)`;

        embed.addFields({
            name: header,
            value: itemList || '*Empty*',
            inline: true
        });
    }

    return embed;
}

// ═══════════════════════════════════════════════════════════════════
// NAVIGATION BUTTONS
// ═══════════════════════════════════════════════════════════════════

function createInventoryButtons(userId, currentPage, totalPages) {
    const row = new ActionRowBuilder();
    
    // First page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('inv_first', userId))
            .setLabel('⏮️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0)
    );
    
    // Previous page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('prev_page', userId))
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0)
    );
    
    // Page indicator (non-clickable)
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('inv_page_info', userId))
            .setLabel(`${currentPage + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
    
    // Next page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('next_page', userId))
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === totalPages - 1)
    );
    
    // Last page button
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('inv_last', userId))
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === totalPages - 1)
    );

    return row;
}

/**
 * Create a rarity filter select menu
 */
function createRarityFilterMenu(userId, currentFilter = 'all') {
    const options = [
        { label: '📦 All Items', value: 'all', emoji: '📦', description: 'Show all rarities', default: currentFilter === 'all' }
    ];
    
    for (const rarity of RARITY_ORDER) {
        const emoji = RARITY_EMOJI[rarity] || '⚪';
        options.push({
            label: `${rarity} Items`,
            value: rarity.toLowerCase(),
            emoji: emoji,
            description: `Filter to ${rarity} rarity only`,
            default: currentFilter === rarity.toLowerCase()
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(buildSecureCustomId('inv_filter', userId))
        .setPlaceholder('🔍 Filter by rarity...')
        .addOptions(options.slice(0, 25)); // Discord limit

    return new ActionRowBuilder().addComponents(selectMenu);
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY EMBED
// ═══════════════════════════════════════════════════════════════════

function createInventorySummaryEmbed(user, stats) {
    const collectionTier = getCollectionTier(stats.totalUniqueItems);
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 ${user.username}'s Inventory Analysis`)
        .setColor(0x5865F2)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setTimestamp();

    // Collection overview
    embed.addFields({
        name: '📦 Collection Overview',
        value: [
            `**Total Items:** ${formatNumber(stats.totalItems)}`,
            `**Unique Types:** ${stats.totalUniqueItems}`,
            `**Rank:** ${collectionTier.emoji} ${collectionTier.title}`
        ].join('\n'),
        inline: false
    });

    // Rarity breakdown with visual bars
    let rarityBreakdown = '';
    const maxRarityCount = Math.max(...Object.values(stats.byRarity).map(r => r.count), 1);
    
    for (const rarity of RARITY_ORDER) {
        const data = stats.byRarity[rarity];
        if (data && data.count > 0) {
            const emoji = RARITY_EMOJI[rarity] || '⚪';
            const bar = createProgressBar(data.count, maxRarityCount, 8);
            rarityBreakdown += `${emoji} **${rarity}:** \`${bar}\` ${formatNumber(data.count)} (${data.uniqueCount} types)\n`;
        }
    }

    embed.addFields({
        name: '🌈 Rarity Distribution',
        value: rarityBreakdown || '*No items collected yet*',
        inline: false
    });

    // Collection tips
    const tips = [
        '💡 Use `.item <name>` to view item details',
        '🔧 Use `.craft` to craft new items',
        '💰 Use `.sell` to sell unwanted items',
        '🎲 Use `.roll` to get more items'
    ];
    
    embed.addFields({
        name: '📝 Quick Tips',
        value: tips.join('\n'),
        inline: false
    });

    embed.setFooter({ 
        text: `Inventory Summary • ${new Date().toLocaleDateString()}`,
        iconURL: user.displayAvatarURL({ size: 32 })
    });

    return embed;
}

// ═══════════════════════════════════════════════════════════════════
// ERROR & EMPTY STATE EMBEDS
// ═══════════════════════════════════════════════════════════════════

function createInventoryErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ Inventory Error')
        .setDescription([
            '```',
            message,
            '```',
            '',
            '**What you can try:**',
            '• Check if the command was typed correctly',
            '• Wait a moment and try again',
            '• Contact support if the issue persists'
        ].join('\n'))
        .setColor(0xFF0000)
        .setTimestamp();
}

function createEmptyInventoryEmbed(user) {
    return new EmbedBuilder()
        .setTitle(`🎒 ${user.username}'s Inventory`)
        .setDescription([
            '```',
            '╔═══════════════════════════════════╗',
            '║         🌫️ EMPTY INVENTORY 🌫️       ║',
            '╚═══════════════════════════════════╝',
            '```',
            '',
            '**Your inventory is empty!** Time to start collecting!',
            '',
            '**🎯 How to get started:**',
            '> 🎲 `.roll` - Roll for fumos',
            '> 🙏 `.pray` - Pray for blessings',
            '> 📜 `.quest` - Complete quests for rewards',
            '> 🛒 `.shop` - Visit the shop',
            '',
            '*Every adventure begins with a single item!*'
        ].join('\n'))
        .setColor(0x99AAB5)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setFooter({ text: 'Start your collection today!' })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// ITEM DETAIL EMBED
// ═══════════════════════════════════════════════════════════════════

function createItemDetailEmbed(itemName, itemData, quantity, user) {
    const rarityColor = RARITY_COLORS[itemData.rarity] || 0x808080;
    const rarityEmoji = RARITY_EMOJI[itemData.rarity] || '⚪';
    
    const embed = new EmbedBuilder()
        .setTitle(`${rarityEmoji} ${formatItemName(itemName)}`)
        .setDescription(itemData.description || '*No description available*')
        .setColor(rarityColor)
        .addFields(
            { name: '📊 Rarity', value: `${rarityEmoji} ${itemData.rarity}`, inline: true },
            { name: '📦 Owned', value: `×${formatNumber(quantity)}`, inline: true },
            { name: '📂 Category', value: itemData.category || 'Unknown', inline: true }
        );
    
    if (itemData.craftable !== undefined) {
        embed.addFields({ name: '🔧 Craftable', value: itemData.craftable ? '✅ Yes' : '❌ No', inline: true });
    }
    
    if (itemData.usable !== undefined) {
        embed.addFields({ name: '💊 Usable', value: itemData.usable ? '✅ Yes' : '❌ No', inline: true });
    }
    
    if (itemData.lore) {
        embed.addFields({ name: '📜 Lore', value: `*"${itemData.lore}"*`, inline: false });
    }
    
    embed.setFooter({ 
        text: `Requested by ${user.username}`,
        iconURL: user.displayAvatarURL({ size: 32 })
    });
    embed.setTimestamp();
    
    return embed;
}

module.exports = {
    // Main functions
    createInventoryEmbed,
    createInventoryButtons,
    createInventorySummaryEmbed,
    createInventoryErrorEmbed,
    
    // New enhanced functions
    createRarityFilterMenu,
    createEmptyInventoryEmbed,
    createItemDetailEmbed,
    
    // Utility exports
    formatItemName,
    getCollectionTier,
    createProgressBar,
    
    // Constants
    INVENTORY_THEMES,
    RARITY_DECORATIONS
};