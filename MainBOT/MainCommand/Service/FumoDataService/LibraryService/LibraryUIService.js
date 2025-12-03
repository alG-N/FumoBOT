const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const { chunkArray } = require('../../../Ultility/itemUtils');
const LibraryDataService = require('./LibraryDataService');

class LibraryUIService {
    static async displayLibrary(message, libraryData) {
        const pages = this.generatePages(libraryData);
        
        if (pages.length === 0) {
            return message.reply('📚 Your library is empty. Start collecting fumos!');
        }

        let currentPage = 0;
        const embed = this.buildEmbed(libraryData, pages, currentPage);
        const buttons = this.buildButtons(message.author.id, currentPage, pages.length);

        const sentMessage = await message.channel.send({ 
            embeds: [embed], 
            components: [buttons] 
        });

        const collector = sentMessage.createMessageComponentCollector({ 
            time: 120000 
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: "❌ This library isn't yours! Use `.library` to view your own.", 
                    ephemeral: true 
                });
            }

            const action = this.parseAction(interaction.customId);
            
            // Handle INFO button separately
            if (action === 'INFO') {
                const infoEmbed = this.buildInfoEmbed(libraryData);
                return interaction.reply({ 
                    embeds: [infoEmbed], 
                    ephemeral: true 
                });
            }

            currentPage = this.calculateNewPage(action, currentPage, pages.length);

            const newEmbed = this.buildEmbed(libraryData, pages, currentPage);
            const newButtons = this.buildButtons(message.author.id, currentPage, pages.length);

            await interaction.update({ 
                embeds: [newEmbed], 
                components: [newButtons] 
            });
        });

        collector.on('end', () => {
            sentMessage.edit({ components: [] }).catch(() => {});
        });
    }

    static buildInfoEmbed(libraryData) {
        const { stats, categories } = libraryData;
        
        const embed = new EmbedBuilder()
            .setTitle('ℹ️ Library Information')
            .setDescription('Detailed breakdown of your Fumo collection by rarity')
            .setColor(0x0099FF);

        // Build rarity breakdown
        let rarityBreakdown = '';
        for (const [rarity, fumos] of Object.entries(categories)) {
            if (fumos.length === 0) continue;
            
            const discovered = fumos.filter(f => f.hasBase).length;
            const emoji = LibraryDataService.getRarityEmoji(rarity);
            const percentage = Math.round((discovered / fumos.length) * 100);
            
            rarityBreakdown += `${emoji} **${rarity}**: ${discovered}/${fumos.length} (${percentage}%)\n`;
        }

        embed.addFields(
            {
                name: '📊 Rarity Breakdown',
                value: rarityBreakdown || 'No data available',
                inline: false
            },
            {
                name: '✨ Special Variants',
                value: `**SHINY Variants:** ${stats.shinyCount}\n**alG Variants:** ${stats.algCount}`,
                inline: true
            },
            {
                name: '📈 Overall Progress',
                value: `**Total Collected:** ${stats.discoveredCount}/${stats.totalFumos}\n**Completion:** ${stats.percentage}%`,
                inline: true
            }
        );

        embed.setFooter({ text: 'Keep collecting to complete your library!' });

        return embed;
    }

    static generatePages(libraryData) {
        const pages = [];

        for (const [rarity, fumos] of Object.entries(libraryData.categories)) {
            if (fumos.length > 0) {
                pages.push({ rarity, fumos });
            }
        }

        return pages;
    }

    static buildEmbed(libraryData, pages, currentPage) {
        const { stats } = libraryData;
        const page = pages[currentPage];

        const embed = new EmbedBuilder()
            .setTitle('📚 Fumo Library - Your Collection')
            .setDescription(this.buildDescription(stats))
            .setColor(this.getRarityColor(page.rarity));

        const rarityEmoji = LibraryDataService.getRarityEmoji(page.rarity);
        const chunked = chunkArray(page.fumos, 15);

        chunked.forEach((chunk, idx) => {
            const lines = chunk.map(f => 
                `${f.hasBase ? '✅' : '❌'} ${f.name}${this.buildBadges(f)}`
            );

            embed.addFields({
                name: idx === 0 ? `${rarityEmoji} ${page.rarity}` : `${page.rarity} (cont.)`,
                value: lines.join('\n'),
                inline: true
            });
        });

        embed.addFields(
            {
                name: '📊 Collection Progress',
                value: this.buildProgressBar(stats.discoveredCount, stats.totalFumos),
                inline: false
            },
            {
                name: '✨ Variants Collected',
                value: `${this.buildProgressBar(stats.shinyCount, stats.totalFumos, '✨ SHINY')}\n${this.buildProgressBar(stats.algCount, stats.totalFumos, '🌟 alG')}`,
                inline: false
            }
        );

        embed.setFooter({ 
            text: `Page ${currentPage + 1}/${pages.length} • ${this.getMotivation(stats.percentage)}` 
        });

        return embed;
    }

    static buildDescription(stats) {
        return `Welcome to your personal Fumo Library! Track your collection progress and discover every fumo.\n\n` +
               `🟢 **Discovered:** You own this fumo\n` +
               `🔴 **Undiscovered:** Keep collecting!\n\n` +
               `📊 **Total Fumos:** ${stats.totalFumos}\n` +
               `✅ **Collected:** ${stats.discoveredCount} (${stats.percentage}%)`;
    }

    static buildBadges(fumo) {
        let badges = '';
        if (fumo.hasShiny) badges += ' [✨]';
        if (fumo.hasAlg) badges += ' [🌟]';
        return badges;
    }

    static buildProgressBar(current, total, label = null) {
        const safeTotal = Math.max(1, total);
        const safeCurrent = Math.max(0, Math.min(current, safeTotal));
        const percentage = Math.round((safeCurrent / safeTotal) * 100);
        
        const barLength = 20;
        const filledLength = Math.round((safeCurrent / safeTotal) * barLength);
        const emptyLength = barLength - filledLength;
        
        const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
        const prefix = label ? `${label}: ` : '';
        
        return `${prefix}${bar} ${percentage}% (${safeCurrent}/${safeTotal})`;
    }

    static getMotivation(percentage) {
        if (percentage === 100) return "🎉 Perfect Collection! You're a true collector!";
        if (percentage >= 90) return "🔥 Almost there! Just a few more!";
        if (percentage >= 75) return "⭐ Outstanding progress!";
        if (percentage >= 50) return "💪 Halfway there! Keep going!";
        if (percentage >= 25) return "🌟 Good start! Keep collecting!";
        return "🚀 Your journey begins!";
    }

    static buildButtons(userId, currentPage, totalPages) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('lib_first', userId))
                .setEmoji('⏮️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('lib_prev', userId))
                .setEmoji('◀️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('lib_info', userId))
                .setEmoji('ℹ️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('lib_next', userId))
                .setEmoji('▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages - 1),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('lib_last', userId))
                .setEmoji('⏭️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages - 1)
        );
    }

    static parseAction(customId) {
        if (customId.includes('first')) return 'FIRST';
        if (customId.includes('last')) return 'LAST';
        if (customId.includes('prev')) return 'PREV';
        if (customId.includes('next')) return 'NEXT';
        if (customId.includes('info')) return 'INFO';
        return 'INFO';
    }

    static calculateNewPage(action, currentPage, totalPages) {
        switch (action) {
            case 'FIRST': return 0;
            case 'LAST': return totalPages - 1;
            case 'PREV': return Math.max(0, currentPage - 1);
            case 'NEXT': return Math.min(totalPages - 1, currentPage + 1);
            default: return currentPage;
        }
    }

    static getRarityColor(rarity) {
        const colorMap = {
            'Common': 0x808080,
            'UNCOMMON': 0x00FF00,
            'RARE': 0x0099FF,
            'EPIC': 0x9933FF,
            'OTHERWORLDLY': 0x4B0082,
            'LEGENDARY': 0xFFAA00,
            'MYTHICAL': 0xFF0000,
            'EXCLUSIVE': 0xFF00FF,
            '???': 0x000000,
            'ASTRAL': 0x00FFFF,
            'CELESTIAL': 0xFFD700,
            'INFINITE': 0xC0C0C0,
            'ETERNAL': 0x8A2BE2,
            'TRANSCENDENT': 0xFFFFFF
        };
        return colorMap[rarity] || 0x0099FF;
    }
}

module.exports = LibraryUIService;