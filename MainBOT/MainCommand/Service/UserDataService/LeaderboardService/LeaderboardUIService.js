const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const LEADERBOARD_CONFIG = require('../../../Configuration/leaderboardConfig');
const rankingService = require('./LeaderboardRankingService');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');

class LeaderboardUIService {
    async createLeaderboardEmbed(client, category, rows, userId) {
        const categoryData = LEADERBOARD_CONFIG.CATEGORIES[category.toUpperCase()] || LEADERBOARD_CONFIG.CATEGORIES.GLOBAL;
        const color = rankingService.getCategoryColor(categoryData.id);

        const embed = new EmbedBuilder()
            .setTitle(`${categoryData.emoji} ${categoryData.name}`)
            .setDescription(categoryData.description)
            .setColor(color)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: 'Updated every 5 minutes • Use buttons to navigate' })
            .setTimestamp();

        if (!rows || rows.length === 0) {
            embed.addFields({
                name: 'No Data',
                value: '*No users found for this category.*'
            });
            return embed;
        }

        const entries = await Promise.all(
            rows.map(async (row, index) => {
                const rank = index + 1;
                return await rankingService.formatLeaderboardEntry(client, row, rank, categoryData.id);
            })
        );

        const lines = entries.map(entry => {
            const rankDisplay = entry.medal || `**${entry.rank}.**`;
            return `${rankDisplay} **${entry.username}**: ${entry.value}`;
        });

        embed.addFields({
            name: `Top ${rows.length}`,
            value: lines.join('\n')
        });

        if (userId) {
            const userRank = await rankingService.getUserPosition(userId, categoryData.id);
            if (userRank) {
                embed.addFields({
                    name: 'Your Position',
                    value: `You are ranked **#${userRank}**`,
                    inline: true
                });
            }
        }

        return embed;
    }

    async createGlobalLeaderboardEmbed(client, userId) {
        const rankings = await rankingService.getGlobalRankings();

        const embed = new EmbedBuilder()
            .setTitle('🌍 Global Leaderboard Overview')
            .setDescription('Top 3 users in each major category')
            .setColor(LEADERBOARD_CONFIG.COLORS.DEFAULT)
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: 'Use category buttons for full rankings' })
            .setTimestamp();

        for (const [category, rows] of Object.entries(rankings)) {
            if (!rows || rows.length === 0) continue;

            // Fix: Use uppercase to match the config keys
            const categoryData = LEADERBOARD_CONFIG.CATEGORIES[category.toUpperCase()];
            
            // Skip if category doesn't exist in config
            if (!categoryData) {
                console.warn(`[Leaderboard] Category not found in config: ${category}`);
                continue;
            }

            const entries = await Promise.all(
                rows.slice(0, 3).map(async (row, index) => {
                    const rank = index + 1;
                    return await rankingService.formatLeaderboardEntry(client, row, rank, category);
                })
            );

            const lines = entries.map(e => `${e.medal} ${e.username}: ${e.value}`);

            embed.addFields({
                name: `${categoryData.emoji} ${categoryData.name}`,
                value: lines.join('\n'),
                inline: true
            });
        }

        return embed;
    }

    createNavigationButtons(userId, currentCategory = 'global') {
        const categories = Object.values(LEADERBOARD_CONFIG.CATEGORIES)
            .sort((a, b) => a.order - b.order)
            .slice(0, 5);

        const buttons = categories.map(cat => {
            const isCurrentCategory = cat.id === currentCategory;

            return new ButtonBuilder()
                .setCustomId(buildSecureCustomId(`lb_${cat.id}`, userId))
                .setLabel(cat.name.replace(/[^\w\s]/gi, '').trim())
                .setEmoji(cat.emoji)
                .setStyle(isCurrentCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(isCurrentCategory);
        });

        return new ActionRowBuilder().addComponents(buttons);
    }

    createCategoryButtons(userId, currentCategory = 'global', page = 0) {
        const allCategories = Object.values(LEADERBOARD_CONFIG.CATEGORIES)
            .sort((a, b) => a.order - b.order);

        const startIdx = page * 5;
        const categories = allCategories.slice(startIdx, startIdx + 5);

        const buttons = categories.map(cat => {
            const isCurrentCategory = cat.id === currentCategory;

            return new ButtonBuilder()
                .setCustomId(buildSecureCustomId(`lb_${cat.id}`, userId))
                .setLabel(cat.name.substring(0, 20))
                .setEmoji(cat.emoji)
                .setStyle(isCurrentCategory ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(isCurrentCategory);
        });

        const row = new ActionRowBuilder().addComponents(buttons);

        const rows = [row];

        if (allCategories.length > 5) {
            const navButtons = [];

            if (page > 0) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId(`lb_nav_prev`, userId, { page: page - 1 }))
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('⬅️')
                );
            }

            navButtons.push(
                new ButtonBuilder()
                    .setCustomId(buildSecureCustomId('lb_refresh', userId))
                    .setLabel('Refresh')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔄')
            );

            if (startIdx + 5 < allCategories.length) {
                navButtons.push(
                    new ButtonBuilder()
                        .setCustomId(buildSecureCustomId(`lb_nav_next`, userId, { page: page + 1 }))
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('➡️')
                );
            }

            rows.push(new ActionRowBuilder().addComponents(navButtons));
        }

        return rows;
    }

    createStatsEmbed(userId, userStats) {
        const embed = new EmbedBuilder()
            .setTitle('📊 Your Statistics')
            .setColor(LEADERBOARD_CONFIG.COLORS.DEFAULT)
            .setTimestamp();

        const fields = [];

        if (userStats.coins !== undefined) {
            fields.push({
                name: '💰 Coins Rank',
                value: `#${userStats.coins}`,
                inline: true
            });
        }

        if (userStats.gems !== undefined) {
            fields.push({
                name: '💎 Gems Rank',
                value: `#${userStats.gems}`,
                inline: true
            });
        }

        if (userStats.fumos !== undefined) {
            fields.push({
                name: '🧸 Fumos Rank',
                value: `#${userStats.fumos}`,
                inline: true
            });
        }

        if (userStats.level !== undefined) {
            fields.push({
                name: '📊 Level Rank',
                value: `#${userStats.level}`,
                inline: true
            });
        }

        if (fields.length > 0) {
            embed.addFields(fields);
        } else {
            embed.setDescription('*No ranking data available yet.*');
        }

        return embed;
    }

    async handleCategoryChange(interaction, client, category) {
        await interaction.deferUpdate();

        const rows = await rankingService.getRankings(category, LEADERBOARD_CONFIG.TOP_DISPLAY_COUNT);
        const embed = await this.createLeaderboardEmbed(client, category, rows, interaction.user.id);
        const buttons = this.createCategoryButtons(interaction.user.id, category);

        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    }

    async handleRefresh(interaction, client, currentCategory) {
        await interaction.deferUpdate();

        const rows = await rankingService.getRankings(currentCategory, LEADERBOARD_CONFIG.TOP_DISPLAY_COUNT);
        const embed = await this.createLeaderboardEmbed(client, currentCategory, rows, interaction.user.id);
        const buttons = this.createCategoryButtons(interaction.user.id, currentCategory);

        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    }
}

module.exports = new LeaderboardUIService();