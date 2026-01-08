const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkAndSetCooldown } = require('../../../Middleware/rateLimiter');
const { verifyButtonOwnership } = require('../../../Middleware/buttonOwnership');
const uiService = require('../../../Service/UserDataService/LeaderboardService/LeaderboardUIService');
const rankingService = require('../../../Service/UserDataService/LeaderboardService/LeaderboardRankingService');
const cacheService = require('../../../Service/UserDataService/LeaderboardService/LeaderboardCacheService');
const LEADERBOARD_CONFIG = require('../../../Configuration/leaderboardConfig');

const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.setMaxListeners(150);

module.exports = (mainClient) => {
    mainClient.on('messageCreate', async (message) => {
        if (!message.content.startsWith('.leaderboard') && !message.content.startsWith('.lb')) return;
        if (message.author.bot) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const cooldownCheck = await checkAndSetCooldown(message.author.id, 'leaderboard', 3000);
        if (cooldownCheck.onCooldown) {
            return message.reply(`⏳ Please wait ${cooldownCheck.remaining}s before checking the leaderboard again.`);
        }

        try {
            const args = message.content.split(' ').slice(1);
            const category = args[0]?.toLowerCase() || 'global';

            let embed, rows;

            if (category === 'global' || !LEADERBOARD_CONFIG.CATEGORIES[category.toUpperCase()]) {
                embed = await uiService.createGlobalLeaderboardEmbed(mainClient, message.author.id);
            } else {
                rows = await rankingService.getRankings(category, LEADERBOARD_CONFIG.TOP_DISPLAY_COUNT);
                embed = await uiService.createLeaderboardEmbed(mainClient, category, rows, message.author.id);
            }

            const buttons = uiService.createCategoryButtons(message.author.id, category);

            const reply = await message.reply({
                embeds: [embed],
                components: buttons
            });

            const collector = reply.createMessageComponentCollector({
                time: LEADERBOARD_CONFIG.INTERACTION_TIMEOUT
            });

            collector.on('collect', async (interaction) => {
                if (!verifyButtonOwnership(interaction)) {
                    return interaction.reply({
                        content: "❌ You can't use someone else's buttons.",
                        ephemeral: true
                    });
                }

                try {
                    const [action, target] = interaction.customId.split('_').slice(0, 2);

                    if (action === 'lb') {
                        if (target === 'nav') {
                            const navAction = interaction.customId.split('_')[2];
                            const page = navAction === 'next' ? 1 : 0;
                            await interaction.deferUpdate();

                            const newButtons = uiService.createCategoryButtons(message.author.id, category, page);
                            await interaction.editReply({ components: newButtons });
                        } else if (target === 'refresh') {
                            await uiService.handleRefresh(interaction, mainClient, category);
                        } else {
                            await uiService.handleCategoryChange(interaction, mainClient, target);
                        }
                    }
                } catch (error) {
                    console.error('[Leaderboard] Button interaction error:', error);
                    await interaction.reply({
                        content: '❌ An error occurred while processing your request.',
                        ephemeral: true
                    }).catch(() => {});
                }
            });

            collector.on('end', () => {
                reply.edit({ components: [] }).catch(() => {});
            });

        } catch (error) {
            console.error('[Leaderboard] Command error:', error);
            await message.reply('❌ An error occurred while fetching the leaderboard.');
        }
    });

    mainClient.on('messageCreate', async (message) => {
        if (message.content !== '.lbstats') return;
        if (message.author.id !== '1128296349566251068') return;

        const stats = cacheService.getStats();
        await message.reply({
            content: `**Leaderboard Cache Stats**\n` +
                     `Total Entries: ${stats.total}\n` +
                     `Valid: ${stats.valid}\n` +
                     `Expired: ${stats.expired}\n` +
                     `User Cache: ${stats.userCacheSize}\n` +
                     `TTL: ${stats.ttl}ms`
        });
    });

    mainClient.on('messageCreate', async (message) => {
        if (message.content !== '.lbclear') return;
        if (message.author.id !== '1128296349566251068') return;

        cacheService.clear();
        await message.reply('✅ Leaderboard cache cleared.');
    });
};