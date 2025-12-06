const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatReward, formatCodeList, formatRedemptionHistory, getCategoryColor } = require('../../../Ultility/codeFormatter');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const CodeRedemptionService = require('./CodeRedemptionService');
const { CODE_CATEGORIES } = require('../../../Configuration/codeConfig');

class CodeRedemptionUI {
    static createInfoEmbed(userId, isAdmin = false) {
        const activeCodes = CodeRedemptionService.getActiveCodesList(isAdmin);

        const embed = new EmbedBuilder()
            .setTitle('🎁 Code Redemption System')
            .setDescription(
                '🎉 **Welcome to the Code Redemption System!** 🎉\n\n' +
                'Find secret codes and redeem them for amazing rewards! 🏆💎\n\n' +
                '**How it works:**\n' +
                '1️⃣ **Find a code** hidden in various parts of the bot.\n' +
                '2️⃣ **Use** `/code redeem <code>` or `.code <code>`.\n' +
                '3️⃣ **Enjoy** your rewards!\n\n' +
                '**Available Commands:**\n' +
                '• `.code` - Show this info\n' +
                '• `.code <code>` - Redeem a code\n' +
                '• `.code list` - View your redemption history\n' +
                (isAdmin ? '• `.code stats` - View code statistics (Admin)\n' : '') +
                '\nGood luck and have fun! 🤩'
            )
            .setColor(0xFFD700)
            .setThumbnail('https://static.wikia.nocookie.net/nicos-nextbots-fanmade/images/f/f4/Bottled_cirno.png/revision/latest?cb=20240125031826')
            .setImage('https://media.istockphoto.com/id/520327210/photo/young-boy-finding-treasure.jpg?s=612x612&w=0&k=20&c=Q3PcIngIESMXeXofRLnWwq1wwMO3VmznA9T2Mg1gt2I=')
            .setFooter({
                text: 'Remember: Each code can only be used once per user!',
                iconURL: 'https://gcdn.thunderstore.io/live/repository/icons/FraDirahra-Fumo_Cirno-1.0.0.png.256x256_q95.png'
            })
            .setTimestamp();

        if (isAdmin) {
            const codeCount = Object.keys(activeCodes).length;
            embed.addFields({
                name: '👑 Admin Info',
                value: `**Active Codes:** ${codeCount}\n**Use** \`.code admin\` for full list`
            });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('code_list', userId))
                .setLabel('My Redemptions')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📋')
        );

        return { embeds: [embed], components: [row] };
    }

    static createSuccessEmbed(code, rewards) {
        const rewardText = formatReward(rewards);
        const category = CODE_CATEGORIES[rewards.category];

        const embed = new EmbedBuilder()
            .setTitle('✅ Code Redeemed Successfully!')
            .setDescription(
                `**Code:** \`${code}\`\n\n` +
                `**You received:**\n${rewardText}\n\n` +
                (category ? `**Category:** ${category.emoji} ${category.name}` : '')
            )
            .setColor(0x00FF00)
            .setFooter({ text: 'Enjoy your rewards!' })
            .setTimestamp();

        return embed;
    }

    static createErrorEmbed(error, message) {
        const embed = new EmbedBuilder()
            .setTitle('❌ Code Redemption Failed')
            .setDescription(message)
            .setColor(0xFF0000)
            .setTimestamp();

        switch (error) {
            case 'INVALID_CODE':
                embed.setFooter({ text: 'Double-check your spelling and try again!' });
                break;
            case 'ALREADY_REDEEMED':
                embed.setFooter({ text: 'Each code can only be used once per user.' });
                break;
            case 'EXPIRED':
                embed.setFooter({ text: 'This code is no longer available.' });
                break;
            case 'MAX_USES':
                embed.setFooter({ text: 'Too many people redeemed this code!' });
                break;
            case 'DAILY_LIMIT':
                embed.setFooter({ text: 'Come back tomorrow to redeem more codes!' });
                break;
            default:
                embed.setFooter({ text: 'Try again later or contact support.' });
        }

        return embed;
    }

    static async createHistoryEmbed(userId) {
        const stats = await CodeRedemptionService.getUserRedemptionStats(userId);
        const historyText = formatRedemptionHistory(stats.recentRedemptions);

        const embed = new EmbedBuilder()
            .setTitle('📋 Your Code Redemption History')
            .setDescription(
                `**Total Codes Redeemed:** ${stats.totalRedemptions}\n\n` +
                `**Recent Redemptions:**\n${historyText}`
            )
            .setColor(0x3498DB)
            .setFooter({ text: 'Keep collecting those rewards!' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('code_back', userId))
                .setLabel('◀ Back')
                .setStyle(ButtonStyle.Secondary)
        );

        return { embeds: [embed], components: [row] };
    }

    static async createAdminListEmbed(userId) {
        const isAdmin = CodeRedemptionService.isAdmin(userId);
        if (!isAdmin) {
            return this.createErrorEmbed('UNAUTHORIZED', 'You do not have permission to view this.');
        }

        const activeCodes = CodeRedemptionService.getActiveCodesList(true);
        const codeListText = formatCodeList(activeCodes, true);

        const embed = new EmbedBuilder()
            .setTitle('👑 Admin: Active Codes')
            .setDescription(
                `**Total Active Codes:** ${Object.keys(activeCodes).length}\n\n` +
                codeListText
            )
            .setColor(0xFFD700)
            .setFooter({ text: 'Admin View' })
            .setTimestamp();

        return { embeds: [embed] };
    }

    static async createStatsEmbed(code) {
        const stats = await CodeRedemptionService.getCodeStatistics(code);

        if (!stats) {
            return this.createErrorEmbed('INVALID_CODE', 'Code not found.');
        }

        const { formatCodeStats } = require('../../../Ultility/codeFormatter');
        const statsText = formatCodeStats(stats);
        const rewardText = formatReward(stats);

        const embed = new EmbedBuilder()
            .setTitle(`📊 Code Statistics: \`${code}\``)
            .setDescription(
                `**Description:** ${stats.description}\n\n` +
                `**Stats:**\n${statsText}\n\n` +
                `**Rewards:**\n${rewardText}`
            )
            .setColor(getCategoryColor(stats.category))
            .setTimestamp();

        return { embeds: [embed] };
    }

    static async handleButtonInteraction(interaction) {
        const { parseCustomId } = require('../../../Middleware/buttonOwnership');
        const { action } = parseCustomId(interaction.customId);

        switch (action) {
            case 'code_list':
                const history = await this.createHistoryEmbed(interaction.user.id);
                await interaction.update(history);
                break;

            case 'code_back':
                const info = this.createInfoEmbed(interaction.user.id, CodeRedemptionService.isAdmin(interaction.user.id));
                await interaction.update(info);
                break;

            default:
                await interaction.reply({
                    content: 'Unknown action.',
                    ephemeral: true
                }
            );
        }
    }
}

module.exports = CodeRedemptionUI;