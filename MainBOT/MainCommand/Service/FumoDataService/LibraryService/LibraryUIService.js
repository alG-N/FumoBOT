const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
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
        const selectMenu = this.buildRaritySelect(message.author.id, pages, currentPage);

        const sentMessage = await message.channel.send({ 
            embeds: [embed], 
            components: [selectMenu, buttons] 
        });

        const collector = sentMessage.createMessageComponentCollector({ 
            time: 300000 
        });

        collector.on('collect', async (interaction) => {
            if (interaction.user.id !== message.author.id) {
                return interaction.reply({ 
                    content: "❌ This library isn't yours! Use `.library` to view your own.", 
                    ephemeral: true 
                });
            }

            if (interaction.isStringSelectMenu()) {
                const selectedPage = parseInt(interaction.values[0]);
                currentPage = selectedPage;

                const newEmbed = this.buildEmbed(libraryData, pages, currentPage);
                const newButtons = this.buildButtons(message.author.id, currentPage, pages.length);
                const newSelectMenu = this.buildRaritySelect(message.author.id, pages, currentPage);

                return interaction.update({ 
                    embeds: [newEmbed], 
                    components: [newSelectMenu, newButtons] 
                });
            }

            const action = this.parseAction(interaction.customId);

            if (action === 'INFO') {
                const statsEmbed = this.buildDetailedStats(
                    libraryData.stats, 
                    libraryData.discovered
                );
                return interaction.reply({ 
                    embeds: [statsEmbed], 
                    ephemeral: true 
                });
            }

            currentPage = this.calculateNewPage(action, currentPage, pages.length);

            const newEmbed = this.buildEmbed(libraryData, pages, currentPage);
            const newButtons = this.buildButtons(message.author.id, currentPage, pages.length);
            const newSelectMenu = this.buildRaritySelect(message.author.id, pages, currentPage);

            await interaction.update({ 
                embeds: [newEmbed], 
                components: [newSelectMenu, newButtons] 
            });
        });

        collector.on('end', () => {
            sentMessage.edit({ components: [] }).catch(() => {});
        });
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

        const categoryStats = this.getCategoryStats(page.fumos);
        const completionBadge = categoryStats.percentage === 100 ? ' ✅' : 
                               categoryStats.percentage >= 75 ? ' 🌟' : 
                               categoryStats.percentage >= 50 ? ' ⭐' : '';

        const embed = new EmbedBuilder()
            .setTitle('📚 Fumo Library - Your Collection')
            .setDescription(this.buildDescription(stats))
            .setColor(this.getRarityColor(page.rarity));

        const rarityEmoji = LibraryDataService.getRarityEmoji(page.rarity);
        const chunked = this.chunkArray(page.fumos, 15);

        chunked.forEach((chunk, idx) => {
            const lines = chunk.map(f => 
                `${f.hasBase ? '✅' : '❌'} ${f.name}${this.buildBadges(f)}`
            );

            embed.addFields({
                name: idx === 0 ? `${rarityEmoji} ${page.rarity}${completionBadge} (${categoryStats.discovered}/${categoryStats.total})` : `${page.rarity} (cont.)`,
                value: lines.join('\n'),
                inline: true
            });
        });

        embed.addFields(
            {
                name: '📊 Overall Collection Progress',
                value: this.buildProgressBar(stats.discoveredCount, stats.totalFumos),
                inline: false
            },
            {
                name: '✨ Variant Collection',
                value: `${this.buildProgressBar(stats.shinyCount, stats.discoveredCount, 'SHINY')}\n` +
                       `${this.buildProgressBar(stats.algCount, stats.discoveredCount, 'alG')}`,
                inline: false
            }
        );

        embed.setFooter({ 
            text: `Page ${currentPage + 1}/${pages.length} • ${this.getMotivation(stats.percentage)} • Click ℹ️ for details` 
        });

        return embed;
    }

    static getCategoryStats(fumos) {
        const discovered = fumos.filter(f => f.hasBase).length;
        const total = fumos.length;
        const percentage = total > 0 ? Math.round((discovered / total) * 100) : 0;
        return { discovered, total, percentage };
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

    static buildDetailedStats(stats, discovered) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Detailed Collection Statistics')
            .setColor(0x5865F2)
            .setDescription('Complete breakdown of your Fumo collection progress');

        embed.addFields(
            {
                name: '🎯 Base Collection',
                value: `${this.buildProgressBar(stats.discoveredCount, stats.totalFumos)}\n` +
                       `Unique fumos owned: **${stats.discoveredCount}** / ${stats.totalFumos}`,
                inline: false
            },
            {
                name: '✨ Shiny Variants',
                value: `${this.buildProgressBar(stats.shinyCount, stats.discoveredCount)}\n` +
                       `Shinies collected: **${stats.shinyCount}** / ${stats.discoveredCount} discovered`,
                inline: false
            },
            {
                name: '🌟 alG Variants',
                value: `${this.buildProgressBar(stats.algCount, stats.discoveredCount)}\n` +
                       `alGs collected: **${stats.algCount}** / ${stats.discoveredCount} discovered`,
                inline: false
            }
        );

        const categoryBreakdown = Object.entries(discovered)
            .filter(([_, data]) => data.base)
            .reduce((acc, [name, data]) => {
                const variants = [];
                if (data.base) variants.push('Base');
                if (data.shiny) variants.push('✨');
                if (data.alg) variants.push('🌟');
                acc.push(`${name}: ${variants.join(' ')}`);
                return acc;
            }, []);

        if (categoryBreakdown.length > 0) {
            const chunks = this.chunkArray(categoryBreakdown, 10);
            chunks.forEach((chunk, idx) => {
                embed.addFields({
                    name: idx === 0 ? '📋 Variant Overview' : '📋 Variant Overview (cont.)',
                    value: chunk.join('\n'),
                    inline: false
                });
            });
        }

        embed.setFooter({ text: 'Tip: Shinies and alGs are variants of fumos you already own!' });

        return embed;
    }

    static chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static getMotivation(percentage) {
        if (percentage === 100) return "🎉 Perfect Collection! You're a true collector!";
        if (percentage >= 90) return "🔥 Almost there! Just a few more!";
        if (percentage >= 75) return "⭐ Outstanding progress!";
        if (percentage >= 50) return "💪 Halfway there! Keep going!";
        if (percentage >= 25) return "🌟 Good start! Keep collecting!";
        return "🚀 Your journey begins!";
    }

    static buildRaritySelect(userId, pages, currentPage) {
        const options = pages.map((page, idx) => {
            const stats = this.getCategoryStats(page.fumos);
            const emoji = LibraryDataService.getRarityEmoji(page.rarity);
            const badge = stats.percentage === 100 ? ' ✅' : '';
            
            return {
                label: `${page.rarity}${badge}`,
                description: `${stats.discovered}/${stats.total} collected (${stats.percentage}%)`,
                value: idx.toString(),
                emoji: emoji,
                default: idx === currentPage
            };
        });

        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(buildSecureCustomId('lib_select', userId))
                .setPlaceholder('📂 Jump to rarity category...')
                .addOptions(options)
        );
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