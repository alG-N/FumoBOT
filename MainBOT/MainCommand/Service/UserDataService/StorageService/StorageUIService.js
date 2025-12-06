const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { RARITY_COLORS, RARITY_EMOJI } = require('../../../Configuration/storageConfig');

class StorageUIService {
    static createInventoryEmbed(username, inventoryData, options = {}) {
        const { 
            currentPage = 0, 
            showShinyPlus = false, 
            sortBy = 'rarity',
            hasFantasyBook = false 
        } = options;

        const { categories, visibleRarities, totalFumos, totalShinyPlus } = inventoryData;

        const embed = new EmbedBuilder()
            .setColor(showShinyPlus ? '#FFD700' : '#00BFFF')
            .setTitle(showShinyPlus ? `✨ ${username}'s SHINY+ Collection` : `📦 ${username}'s Storage`)
            .setDescription(this.buildDescription(totalFumos, totalShinyPlus, showShinyPlus))
            .setThumbnail('https://media.discordapp.net/attachments/1255538076172816415/1255887181071913010/FyrEe68WIAgN3sc.png');

        const start = currentPage * 3;
        const end = Math.min(start + 3, visibleRarities.length);

        for (let i = start; i < end; i++) {
            const rarity = visibleRarities[i];
            const items = categories[rarity];
            
            const emoji = RARITY_EMOJI[rarity] || '⚪';
            const totalCount = items.reduce((sum, item) => sum + item.count, 0);
            
            embed.addFields({
                name: `${emoji} ${rarity} (×${totalCount})`,
                value: this.formatItemList(items),
                inline: true
            });
        }

        embed.setFooter({ 
            text: this.buildFooter(showShinyPlus, hasFantasyBook, sortBy, currentPage + 1, Math.ceil(visibleRarities.length / 3)) 
        });

        return embed;
    }

    static buildDescription(totalFumos, totalShinyPlus, showShinyPlus) {
        if (showShinyPlus) {
            return `✨ **Total SHINY+ Units:** ${totalShinyPlus.toLocaleString()}\n` +
                   `🌟 **Special Variants Only**`;
        }
        
        return `🎒 **Total Units:** ${totalFumos.toLocaleString()}\n` +
               `📊 **Collection Status:** Active`;
    }

    static formatItemList(items) {
        if (items.length === 0) return 'None';
        
        return items
            .slice(0, 8)
            .map(item => `\`${item.name}\` ×${item.count}`)
            .join('\n') + (items.length > 8 ? `\n*+${items.length - 8} more...*` : '');
    }

    static buildFooter(showShinyPlus, hasFantasyBook, sortBy, currentPage, totalPages) {
        const parts = [];
        
        if (showShinyPlus) {
            parts.push('🎯 Viewing SHINY+ variants');
        } else if (!hasFantasyBook) {
            parts.push('🔒 FantasyBook required for high-tier units');
        } else {
            parts.push(`📋 Sorted by ${sortBy === 'rarity' ? 'Rarity' : 'Quantity'}`);
        }
        
        parts.push(`Page ${currentPage}/${totalPages}`);
        
        return parts.join(' • ');
    }

    static createButtons(userId, currentPage, maxPage, showShinyPlus, sortBy) {
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_first', userId))
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_prev', userId))
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_next', userId))
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === maxPage),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_last', userId))
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === maxPage)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_shiny', userId))
                .setLabel(showShinyPlus ? '📦 Normal' : '✨ SHINY+')
                .setStyle(showShinyPlus ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_sort', userId))
                .setLabel(sortBy === 'rarity' ? '🔢 Sort: Qty' : '🔤 Sort: Rarity')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_stats', userId))
                .setLabel('📊 Stats')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('storage_search', userId))
                .setLabel('🔍 Search')
                .setStyle(ButtonStyle.Secondary)
        );

        return [row1, row2];
    }

    static createStatsEmbed(username, inventoryData) {
        const summary = require('../../UserDataService/StorageService/StorageService').getInventorySummary(inventoryData);
        
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle(`📊 ${username}'s Collection Statistics`)
            .setDescription(`**Total Units:** ${summary.totalFumos.toLocaleString()}\n**SHINY+ Units:** ${summary.totalShinyPlus.toLocaleString()}`);

        const rarityStats = [];
        for (const [rarity, stats] of Object.entries(summary.byRarity)) {
            const emoji = RARITY_EMOJI[rarity] || '⚪';
            rarityStats.push(`${emoji} **${rarity}**: ${stats.totalCount.toLocaleString()} (${stats.uniqueCount} unique)`);
        }

        if (rarityStats.length > 0) {
            embed.addFields({
                name: '🎯 Rarity Breakdown',
                value: rarityStats.join('\n')
            });
        }

        const completionRate = this.calculateCompletionRate(summary);
        embed.addFields({
            name: '📈 Progress',
            value: `Collection: ${completionRate}%\n${this.createProgressBar(completionRate)}`
        });

        return embed;
    }

    static calculateCompletionRate(summary) {
        const totalPossible = 500;
        const uniqueCount = Object.values(summary.byRarity).reduce((sum, stats) => sum + stats.uniqueCount, 0);
        return Math.min(100, Math.round((uniqueCount / totalPossible) * 100));
    }

    static createProgressBar(percentage, length = 20) {
        const filled = Math.round((percentage / 100) * length);
        const empty = length - filled;
        return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
    }
}

module.exports = StorageUIService;