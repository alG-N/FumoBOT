const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { RARITY_COLORS, RARITY_EMOJI, STORAGE_CONFIG } = require('../../../Configuration/storageConfig');
const StorageLimitService = require('./StorageLimitService');

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
            return `✨ **SHINY+ Units:** ${totalShinyPlus.toLocaleString()}\n` +
                   `📦 **Total Units:** ${totalFumos.toLocaleString()}\n` +
                   `🌟 **Viewing:** Special Variants Only`;
        }
        
        return `📦 **Total Units:** ${totalFumos.toLocaleString()}\n` +
               `✨ **SHINY+ Units:** ${totalShinyPlus.toLocaleString()}\n` +
               `📊 **Storage Status:** ${((totalFumos / STORAGE_CONFIG.MAX_STORAGE) * 100).toFixed(1)}% full`;
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
        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`storage_first_${userId}`)
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`storage_prev_${userId}`)
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`storage_next_${userId}`)
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= maxPage),
            new ButtonBuilder()
                .setCustomId(`storage_last_${userId}`)
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage >= maxPage)
        );

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`storage_shiny_${userId}`)
                .setLabel(showShinyPlus ? '📦 Normal' : '✨ SHINY+')
                .setStyle(showShinyPlus ? ButtonStyle.Success : ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`storage_sort_${userId}`)
                .setLabel(sortBy === 'rarity' ? '🔢 Sort: Qty' : '🔤 Sort: Rarity')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`storage_stats_${userId}`)
                .setLabel('📊 Stats')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`storage_info_${userId}`)
                .setLabel('Storage Info')
                .setEmoji('📦')
                .setStyle(ButtonStyle.Primary)
        );

        return [navRow, controlRow];
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

    static async createStorageInfoEmbed(userId, username) {
        try {
            const status = await StorageLimitService.getStorageStatus(userId);
            
            // Ensure percentage is a valid number
            const percentage = parseFloat(status.percentage);
            if (isNaN(percentage)) {
                console.error(`Invalid percentage for user ${userId}:`, status.percentage);
                status.percentage = '0.00';
            }
            
            const progressBar = StorageLimitService.createProgressBar(percentage);
            
            let statusEmoji = '🟢';
            let statusText = 'Normal';
            let statusColor = 0x00FF00;
            
            if (status.status === 'CRITICAL') {
                statusEmoji = '🔴';
                statusText = 'Critical - Almost Full!';
                statusColor = 0xFF0000;
            } else if (status.status === 'WARNING') {
                statusEmoji = '🟡';
                statusText = 'Warning - Getting Full';
                statusColor = 0xFFA500;
            }
            
            const embed = new EmbedBuilder()
                .setTitle(`📦 Storage Information - ${username}`)
                .setDescription(
                    `${statusEmoji} **Status:** ${statusText}\n\n` +
                    `**Current Usage:**\n` +
                    `${progressBar}\n` +
                    `${status.current.toLocaleString()} / ${status.max.toLocaleString()} fumos (${percentage.toFixed(2)}%)\n\n` +
                    `**Available Space:** ${status.remaining.toLocaleString()} fumos`
                )
                .setColor(statusColor)
                .setFooter({ text: 'Maximum storage capacity: 100,000 fumos' })
                .setTimestamp();
            
            if (status.status === 'WARNING') {
                embed.addFields({
                    name: '⚠️ Storage Warning',
                    value: 'Your storage is getting full. Consider selling unwanted fumos using `.sell` command.',
                    inline: false
                });
            } else if (status.status === 'CRITICAL') {
                embed.addFields({
                    name: '🚨 Critical Storage Alert',
                    value: 
                        'Your storage is almost full!\n\n' +
                        '**What happens when storage is full?**\n' +
                        '• You cannot roll new fumos\n' +
                        '• Auto-roll will stop (unless auto-sell is enabled)\n' +
                        '• You must sell fumos to continue\n\n' +
                        '**Tip:** Use `.sell` to free up space!',
                    inline: false
                });
            }
            
            return embed;
        } catch (error) {
            console.error('Error in createStorageInfoEmbed:', error);
            throw error;
        }
    }
}

module.exports = StorageUIService;