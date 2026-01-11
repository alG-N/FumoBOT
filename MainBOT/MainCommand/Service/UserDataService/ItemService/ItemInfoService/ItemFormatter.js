const { EmbedBuilder } = require('discord.js');
const { RARITY_COLORS, RARITY_EMOJI } = require('../../../../Configuration/itemConfig');

class ItemFormatter {
    static createItemEmbed(itemName, itemData, requester) {
        const rarityColor = RARITY_COLORS[itemData.rarity] || 0x808080;
        const rarityEmoji = RARITY_EMOJI[itemData.rarity] || '⚪';

        const embed = new EmbedBuilder()
            .setColor(rarityColor)
            .setTitle(`📦 ${itemName}`)
            .setDescription(itemData.description)
            .addFields(
                { 
                    name: `${rarityEmoji} Rarity`, 
                    value: itemData.rarity, 
                    inline: true 
                },
                { 
                    name: '📂 Category', 
                    value: itemData.category, 
                    inline: true 
                },
                { 
                    name: '🔧 Craftable', 
                    value: itemData.craftable ? '✅ Yes' : '❌ No', 
                    inline: true 
                },
                { 
                    name: '💊 Usable', 
                    value: itemData.usable ? '✅ Yes' : '❌ No', 
                    inline: true 
                }
            );

        if (itemData.craftTime) {
            const timeStr = this.formatCraftTime(itemData.craftTime);
            embed.addFields({ 
                name: '⏱️ Craft Time', 
                value: timeStr, 
                inline: true 
            });
        }

        if (itemData.lore) {
            embed.addFields({ 
                name: '📜 Lore', 
                value: `*${itemData.lore}*`, 
                inline: false 
            });
        }

        if (requester) {
            embed.setFooter({ text: `Requested by ${requester}` });
        }

        embed.setTimestamp();

        return embed;
    }

    static createRarityListEmbed(rarity, items, requester) {
        const rarityColor = RARITY_COLORS[rarity] || 0x808080;
        const rarityEmoji = RARITY_EMOJI[rarity] || '⚪';

        const itemList = items.length > 0 
            ? items.map(item => `• ${item.name}`).join('\n')
            : 'No items found for this rarity.';

        const embed = new EmbedBuilder()
            .setColor(rarityColor)
            .setTitle(`${rarityEmoji} ${rarity} Items`)
            .setDescription(itemList)
            .addFields({ 
                name: '📊 Total', 
                value: `${items.length} item(s)`, 
                inline: true 
            });

        if (requester) {
            embed.setFooter({ text: `Requested by ${requester}` });
        }

        embed.setTimestamp();

        return embed;
    }

    static createCategoryListEmbed(category, items, requester) {
        const itemList = items.length > 0
            ? items.map(item => {
                const emoji = RARITY_EMOJI[item.rarity] || '⚪';
                return `${emoji} ${item.name}`;
            }).join('\n')
            : 'No items found in this category.';

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`📂 ${category} Items`)
            .setDescription(itemList)
            .addFields({ 
                name: '📊 Total', 
                value: `${items.length} item(s)`, 
                inline: true 
            });

        if (requester) {
            embed.setFooter({ text: `Requested by ${requester}` });
        }

        embed.setTimestamp();

        return embed;
    }

    static createSearchResultsEmbed(query, results, requester) {
        if (results.length === 0) {
            return new EmbedBuilder()
                .setColor(0xE74C3C)
                .setTitle('🔍 Search Results')
                .setDescription(`No items found matching: **${query}**`)
                .setFooter({ text: `Requested by ${requester}` })
                .setTimestamp();
        }

        const itemList = results.slice(0, 25).map(item => {
            const emoji = RARITY_EMOJI[item.rarity] || '⚪';
            return `${emoji} ${item.name} - *${item.category}*`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`🔍 Search Results for: "${query}"`)
            .setDescription(itemList)
            .addFields({ 
                name: '📊 Results', 
                value: `Found ${results.length} item(s)`, 
                inline: true 
            });

        if (results.length > 25) {
            embed.addFields({ 
                name: '⚠️ Note', 
                value: `Showing first 25 of ${results.length} results`, 
                inline: false 
            });
        }

        if (requester) {
            embed.setFooter({ text: `Requested by ${requester}` });
        }

        embed.setTimestamp();

        return embed;
    }

    static createHelpEmbed() {
        return new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📘 Item Info Commands')
            .setDescription('Learn how to use the item info system!')
            .addFields(
                { 
                    name: '🔍 Search by Name', 
                    value: '`.iteminfo <ItemName>`\nExample: `.iteminfo Lumina`', 
                    inline: false 
                },
                { 
                    name: '📂 List by Rarity', 
                    value: '`.itemlist <Rarity>`\nExample: `.itemlist Mythical`', 
                    inline: false 
                },
                { 
                    name: '🎲 Random Item', 
                    value: '`.randomitem` or `.ri`\nGet info about a random item!', 
                    inline: false 
                },
                { 
                    name: '📊 Statistics', 
                    value: '`.itemstats`\nView item database statistics', 
                    inline: false 
                },
                { 
                    name: '🔧 Craftable Items', 
                    value: '`.craftableitems`\nList all craftable items', 
                    inline: false 
                },
                { 
                    name: '💊 Usable Items', 
                    value: '`.usableitems`\nList all usable items', 
                    inline: false 
                }
            )
            .setFooter({ text: 'FumoBOT Item Info System' })
            .setTimestamp();
    }

    static createStatsEmbed(stats) {
        const rarityStats = Object.entries(stats.rarityDistribution)
            .map(([rarity, count]) => {
                const emoji = RARITY_EMOJI[rarity] || '⚪';
                return `${emoji} ${rarity}: **${count}**`;
            })
            .join('\n');

        const categoryStats = Object.entries(stats.categoryDistribution)
            .map(([category, count]) => `📂 ${category}: **${count}**`)
            .join('\n');

        return new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('📊 Item Database Statistics')
            .addFields(
                { 
                    name: '📦 Total Items', 
                    value: `**${stats.totalItems}**`, 
                    inline: true 
                },
                { 
                    name: '🔧 Craftable', 
                    value: `**${stats.craftableCount}**`, 
                    inline: true 
                },
                { 
                    name: '💊 Usable', 
                    value: `**${stats.usableCount}**`, 
                    inline: true 
                },
                { 
                    name: '🎨 By Rarity', 
                    value: rarityStats, 
                    inline: false 
                },
                { 
                    name: '📂 By Category', 
                    value: categoryStats, 
                    inline: false 
                }
            )
            .setFooter({ text: 'FumoBOT Item Database' })
            .setTimestamp();
    }

    static createNotFoundEmbed(query) {
        return new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('❌ Item Not Found')
            .setDescription(
                `Could not find an item matching: **${query}**\n\n` +
                `Try:\n` +
                `• Checking the spelling\n` +
                `• Using `.itemlist <rarity>` to browse\n` +
                `• Using `.randomitem` for inspiration`
            )
            .setFooter({ text: 'FumoBOT Item Info System' })
            .setTimestamp();
    }

    static formatCraftTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            const remainingHours = hours % 24;
            const remainingMinutes = minutes % 60;
            return `${days}d ${remainingHours}h ${remainingMinutes}m`;
        } else if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return `${hours}h ${remainingMinutes}m`;
        } else if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

module.exports = ItemFormatter;