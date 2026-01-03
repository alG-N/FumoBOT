/**
 * ═══════════════════════════════════════════════════════════════════
 * FUMOBOT QUEST COMMAND v2.0 - Complete Rework
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Commands:
 * .quest / .qu - Opens the quest menu
 * .claim / .cl - Claims all available rewards
 */

const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
const { formatNumber } = require('../../../Ultility/formatting');
const { formatProgressBar, formatDuration } = require('../../../Ultility/balanceFormatter');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');

const {
    DAILY_QUESTS,
    WEEKLY_QUESTS,
    ACHIEVEMENTS,
    QUEST_CHAINS,
    QUEST_CATEGORIES,
    DIFFICULTY_SETTINGS,
    BONUS_CONFIG,
    getDifficultyInfo,
    getCategoryInfo,
    getStreakBonus
} = require('../../../Configuration/questConfig');

const QuestProgressService = require('../../../Service/UserDataService/QuestService/QuestProgressService');
const QuestClaimService = require('../../../Service/UserDataService/QuestService/QuestClaimService');

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════
const INTERACTION_TIMEOUT = 180000; // 3 minutes
const COLORS = {
    MAIN: '#5DADE2',
    DAILY: '#FFD700',
    WEEKLY: '#9B59B6',
    ACHIEVEMENTS: '#2ECC71',
    CHAINS: '#E74C3C',
    SUCCESS: '#00FF7F',
    ERROR: '#FF4444',
    INFO: '#3498DB'
};

// ═══════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════
function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
}

function getTimeUntilDailyReset() {
    const now = new Date();
    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);
    return formatDuration(nextReset - now);
}

function getTimeUntilWeeklyReset() {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    const nextReset = new Date(now);
    nextReset.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextReset.setUTCHours(0, 0, 0, 0);
    return formatDuration(nextReset - now);
}

function formatReward(reward) {
    const parts = [];
    if (reward.coins) parts.push(`💰 ${formatNumber(reward.coins)}`);
    if (reward.gems) parts.push(`💎 ${formatNumber(reward.gems)}`);
    if (reward.tickets) parts.push(`🎫 ${reward.tickets}`);
    if (reward.items?.length) parts.push(`📦 ${reward.items.join(', ')}`);
    return parts.join(' | ') || 'No rewards';
}

// ═══════════════════════════════════════════════════════════════════
// EMBED BUILDERS
// ═══════════════════════════════════════════════════════════════════
function buildMainMenuEmbed(userId, streak = 0) {
    const streakInfo = getStreakBonus(streak);
    const streakEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '📅';
    
    return new EmbedBuilder()
        .setColor(COLORS.MAIN)
        .setTitle('📜 Fumo Quest Board')
        .setDescription([
            '> *Complete quests to earn PrayTickets, Coins, Gems and more!*',
            '',
            '**━━━━━━━━━━ Navigation ━━━━━━━━━━**',
            '',
            '🗓️ **Daily Quests** — Quick tasks, reset daily',
            '📅 **Weekly Quests** — Bigger challenges, weekly reset',
            '🏆 **Achievements** — Permanent milestone rewards',
            '🔗 **Quest Chains** — Multi-quest story progressions',
            '',
            '**━━━━━━━━━━━ Status ━━━━━━━━━━━**',
            '',
            `${streakEmoji} **Current Streak:** ${streak} days`,
            `📈 **Streak Multiplier:** x${streakInfo.multiplier.toFixed(2)}`,
            '',
            '**━━━━━━━━━━━ Resets ━━━━━━━━━━━**',
            '',
            `⏰ **Daily Reset:** ${getTimeUntilDailyReset()}`,
            `⏰ **Weekly Reset:** ${getTimeUntilWeeklyReset()}`
        ].join('\n'))
        .setFooter({ text: 'Use .claim to collect rewards after completing quests!' })
        .setTimestamp();
}

async function buildDailyQuestsEmbed(userId) {
    const currentDate = getCurrentDate();
    const progress = await QuestProgressService.getDailyProgress(userId, currentDate);
    
    const progressMap = {};
    if (Array.isArray(progress)) {
        progress.forEach(row => {
            progressMap[row.questId] = { progress: row.progress || 0, completed: row.completed === 1 };
        });
    } else if (typeof progress === 'object' && progress !== null) {
        Object.assign(progressMap, progress);
    }
    
    // Group quests by difficulty
    const questsByDifficulty = { easy: [], medium: [], hard: [] };
    
    DAILY_QUESTS.forEach(quest => {
        const prog = progressMap[quest.id] || { progress: 0, completed: false };
        const percentage = Math.min(100, (prog.progress / quest.goal) * 100);
        const diffInfo = getDifficultyInfo(quest.difficulty);
        const status = prog.completed ? '✅' : percentage >= 90 ? '🔶' : '⬜';
        
        // Condensed single-line format
        const questLine = `${status} ${quest.icon} ${quest.desc} — **${formatNumber(prog.progress)}/${formatNumber(quest.goal)}**`;
        
        questsByDifficulty[quest.difficulty]?.push(questLine);
    });
    
    const completedCount = DAILY_QUESTS.filter(q => progressMap[q.id]?.completed).length;
    const allCompleted = completedCount === DAILY_QUESTS.length;
    
    const embed = new EmbedBuilder()
        .setColor(allCompleted ? COLORS.SUCCESS : COLORS.DAILY)
        .setTitle('🗓️ Daily Quests')
        .setDescription([
            `**Progress:** ${completedCount}/${DAILY_QUESTS.length} completed | ⏰ Resets: ${getTimeUntilDailyReset()}`,
            allCompleted ? '🎉 **All complete! Use `.claim`**' : '',
            '',
            '**🟢 Easy**',
            questsByDifficulty.easy.join('\n') || 'None',
            '',
            '**🟡 Medium**',
            questsByDifficulty.medium.join('\n') || 'None',
            '',
            '**🔴 Hard**',
            questsByDifficulty.hard.join('\n') || 'None'
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Quests track automatically • Use .claim for rewards' })
        .setTimestamp();
    
    return embed;
}

async function buildWeeklyQuestsEmbed(userId) {
    const currentWeek = getWeekIdentifier();
    const progress = await QuestProgressService.getWeeklyProgress(userId, currentWeek);
    
    const progressMap = {};
    if (Array.isArray(progress)) {
        progress.forEach(row => {
            progressMap[row.questId] = { progress: row.progress || 0, completed: row.completed === 1 };
        });
    } else if (typeof progress === 'object' && progress !== null) {
        Object.assign(progressMap, progress);
    }
    
    const questLines = WEEKLY_QUESTS.map(quest => {
        const prog = progressMap[quest.id] || { progress: 0, completed: false };
        const percentage = Math.min(100, (prog.progress / quest.goal) * 100);
        const diffInfo = getDifficultyInfo(quest.difficulty);
        const status = prog.completed ? '✅' : percentage >= 90 ? '🔶' : '⬜';
        
        // Condensed single-line format
        return `${status} ${quest.icon} ${quest.desc} — **${formatNumber(prog.progress)}/${formatNumber(quest.goal)}** ${diffInfo.emoji}`;
    });
    
    const completedCount = WEEKLY_QUESTS.filter(q => progressMap[q.id]?.completed).length;
    const allCompleted = completedCount === WEEKLY_QUESTS.length;
    
    const embed = new EmbedBuilder()
        .setColor(allCompleted ? COLORS.SUCCESS : COLORS.WEEKLY)
        .setTitle('📅 Weekly Quests')
        .setDescription([
            `**Progress:** ${completedCount}/${WEEKLY_QUESTS.length} completed | ⏰ Resets: ${getTimeUntilWeeklyReset()}`,
            allCompleted ? '🎉 **All complete! Use `.claim`**' : '',
            '',
            questLines.join('\n')
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Weekly quests reset Monday 00:00 UTC' })
        .setTimestamp();
    
    return embed;
}

async function buildAchievementsEmbed(userId, page = 0) {
    const progressData = await QuestProgressService.getAchievementProgress(userId);
    
    const progressMap = {};
    if (Array.isArray(progressData)) {
        progressData.forEach(row => {
            progressMap[row.achievementId] = { progress: row.progress || 0, claimed: row.claimed || 0 };
        });
    } else if (typeof progressData === 'object' && progressData !== null) {
        Object.assign(progressMap, progressData);
    }
    
    const achievementsPerPage = 4;
    const totalPages = Math.ceil(ACHIEVEMENTS.length / achievementsPerPage);
    const startIdx = page * achievementsPerPage;
    const pageAchievements = ACHIEVEMENTS.slice(startIdx, startIdx + achievementsPerPage);
    
    const achievementLines = pageAchievements.map(ach => {
        const prog = progressMap[ach.id] || { progress: 0, claimed: 0 };
        const currentMilestone = ach.milestones.find(m => prog.progress < m.count) || ach.milestones[ach.milestones.length - 1];
        const nextMilestoneIdx = ach.milestones.findIndex(m => prog.progress < m.count);
        const claimableMilestones = ach.milestones.filter((m, i) => prog.progress >= m.count && i >= prog.claimed).length;
        
        const targetCount = currentMilestone?.count || ach.milestones[ach.milestones.length - 1].count;
        const percentage = Math.min(100, (prog.progress / targetCount) * 100);
        
        let statusEmoji = '';
        if (claimableMilestones > 0) statusEmoji = `🎁x${claimableMilestones}`;
        else if (percentage >= 100) statusEmoji = '✅';
        
        // Condensed 2-line format
        return [
            `${ach.icon} **${ach.name}** ${statusEmoji}`,
            `└ ${formatNumber(prog.progress)}/${formatNumber(targetCount)} • Next: ${currentMilestone ? formatReward(currentMilestone.reward) : 'MAX'}`
        ].join('\n');
    });
    
    const totalClaimable = ACHIEVEMENTS.reduce((sum, ach) => {
        const prog = progressMap[ach.id] || { progress: 0, claimed: 0 };
        return sum + ach.milestones.filter((m, i) => prog.progress >= m.count && i >= prog.claimed).length;
    }, 0);
    
    const embed = new EmbedBuilder()
        .setColor(totalClaimable > 0 ? COLORS.SUCCESS : COLORS.ACHIEVEMENTS)
        .setTitle('🏆 Achievements')
        .setDescription([
            totalClaimable > 0 ? `🎁 **${totalClaimable} claimable! Use \`.claim\`**` : '',
            '',
            achievementLines.join('\n\n')
        ].filter(Boolean).join('\n'))
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Achievements never reset` })
        .setTimestamp();
    
    return { embed, totalPages, currentPage: page };
}

async function buildChainQuestsEmbed(userId) {
    // Get user progress for chain quests
    const chainLines = await Promise.all(QUEST_CHAINS.map(async chain => {
        // Check prerequisites
        let canStart = true;
        let prereqText = '';
        
        if (chain.prerequisites) {
            const prereqs = [];
            if (chain.prerequisites.level) prereqs.push(`Level ${chain.prerequisites.level}+`);
            if (chain.prerequisites.rebirth) prereqs.push(`Rebirth ${chain.prerequisites.rebirth}+`);
            if (chain.prerequisites.chains?.length) prereqs.push(`Complete: ${chain.prerequisites.chains.join(', ')}`);
            prereqText = prereqs.length > 0 ? `📋 *Requires: ${prereqs.join(', ')}*` : '';
        }
        
        // Check quest completion status
        const questStatuses = await Promise.all(chain.quests.map(async questId => {
            // Check daily and weekly progress
            const dailyQuest = DAILY_QUESTS.find(q => q.id === questId);
            const weeklyQuest = WEEKLY_QUESTS.find(q => q.id === questId);
            
            // For chains, we track cumulative progress
            // This is simplified - in a full implementation you'd track chain-specific progress
            return { questId, completed: false };
        }));
        
        const completedQuests = questStatuses.filter(q => q.completed).length;
        const progress = (completedQuests / chain.quests.length) * 100;
        
        return [
            `${chain.icon} **${chain.name}**`,
            `*${chain.description}*`,
            prereqText,
            `${formatProgressBar(completedQuests, chain.quests.length, 8)} ${completedQuests}/${chain.quests.length} quests`,
            `🎁 Bonus: ${formatReward(chain.bonusRewards)}`
        ].filter(Boolean).join('\n');
    }));
    
    const embed = new EmbedBuilder()
        .setColor(COLORS.CHAINS)
        .setTitle('🔗 Quest Chains')
        .setDescription([
            '> *Complete quest chains for massive bonus rewards!*',
            '',
            '**━━━━━━━━━━ Chains ━━━━━━━━━━**',
            '',
            chainLines.join('\n\n')
        ].join('\n'))
        .setFooter({ text: 'Quest chains progress persists across resets!' })
        .setTimestamp();
    
    return embed;
}

function buildHelpEmbed() {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('❓ Quest System Help')
        .setDescription([
            '**━━━━━━━━ How It Works ━━━━━━━━**',
            '',
            '📊 **Progress Tracking**',
            'Quests track automatically as you use bot commands.',
            '',
            '🎁 **Claiming Rewards**',
            'Use `.claim` after completing quests or reaching milestones.',
            '',
            '⏰ **Reset Times**',
            '• Daily quests: 00:00 UTC',
            '• Weekly quests: Monday 00:00 UTC',
            '• Achievements: Never reset!',
            '',
            '**━━━━━━━━ Quest Types ━━━━━━━━**',
            '',
            '🗓️ **Daily Quests**',
            'Quick tasks with modest rewards. Reset every day.',
            '',
            '📅 **Weekly Quests**',
            'Bigger challenges with better rewards. Reset weekly.',
            '',
            '🏆 **Achievements**',
            'Permanent milestones with tiered rewards.',
            '',
            '🔗 **Quest Chains**',
            'Multi-quest progressions with bonus rewards.',
            '',
            '**━━━━━━━━ Streaks ━━━━━━━━**',
            '',
            '🔥 Complete all dailies to maintain your streak!',
            'Higher streaks = Better reward multipliers!',
            '',
            '• 3 days: x1.1 multiplier',
            '• 7 days: x1.25 multiplier',
            '• 14 days: x1.5 multiplier',
            '• 30 days: x2.0 multiplier',
            '• 60 days: x2.5 multiplier',
            '• 100 days: x3.0 multiplier'
        ].join('\n'))
        .setFooter({ text: 'Stay consistent and reap the rewards!' })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════
function createMainMenuButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_daily', userId))
            .setLabel('🗓️ Daily')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_weekly', userId))
            .setLabel('📅 Weekly')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_achievements', userId))
            .setLabel('🏆 Achievements')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_chains', userId))
            .setLabel('🔗 Chains')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_help', userId))
            .setLabel('❓')
            .setStyle(ButtonStyle.Secondary)
    );
}

function createBackButton(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_main', userId))
            .setLabel('◀️ Back to Menu')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_refresh', userId))
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary)
    );
}

function createAchievementNavButtons(userId, currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_main', userId))
            .setLabel('◀️ Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_ach_prev', userId))
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_ach_page', userId))
            .setLabel(`${currentPage + 1}/${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_ach_next', userId))
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_refresh', userId))
            .setLabel('🔄')
            .setStyle(ButtonStyle.Success)
    );
}

// ═══════════════════════════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════
module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const userId = message.author.id;
        const content = message.content.trim().toLowerCase();
        
        // ═══════════════════════════════════════════════════════════════════
        // .QUEST / .QU COMMAND
        // ═══════════════════════════════════════════════════════════════════
        if (content === '.quest' || content === '.qu') {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }
            
            try {
                // Clean up old progress
                const currentDate = getCurrentDate();
                const currentWeek = getWeekIdentifier();
                
                await Promise.all([
                    db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate]),
                    db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek])
                ]).catch(() => {});
                
                // Get user streak
                let streak = 0;
                try {
                    const streakData = await db.get(
                        `SELECT dailyStreak FROM userCoins WHERE userId = ?`,
                        [userId]
                    );
                    streak = streakData?.dailyStreak || 0;
                } catch {}
                
                const embed = buildMainMenuEmbed(userId, streak);
                const buttons = createMainMenuButtons(userId);
                
                const sent = await message.channel.send({
                    embeds: [embed],
                    components: [buttons]
                });
                
                // Set up collector for interactions
                const collector = sent.createMessageComponentCollector({
                    time: INTERACTION_TIMEOUT,
                    filter: (i) => i.user.id === userId
                });
                
                let achievementPage = 0;
                let currentView = 'main';
                
                collector.on('collect', async (interaction) => {
                    try {
                        await interaction.deferUpdate();
                        
                        // Extract action from customId: quest_ACTION_userId_timestamp
                        // For compound actions like "quest_ach_prev", we need parts[1] and parts[2]
                        const parts = interaction.customId.split('_');
                        // parts[0] = "quest", parts[1] = action or compound part 1
                        // Check if it's a compound action (ach_prev, ach_next, ach_page)
                        let action = parts[1];
                        if (parts[1] === 'ach' && parts[2]) {
                            action = `ach_${parts[2]}`; // e.g., "ach_prev", "ach_next"
                        }
                        
                        switch (action) {
                            case 'main':
                                currentView = 'main';
                                const mainEmbed = buildMainMenuEmbed(userId, streak);
                                await interaction.editReply({
                                    embeds: [mainEmbed],
                                    components: [createMainMenuButtons(userId)]
                                });
                                break;
                                
                            case 'daily':
                                currentView = 'daily';
                                const dailyEmbed = await buildDailyQuestsEmbed(userId);
                                await interaction.editReply({
                                    embeds: [dailyEmbed],
                                    components: [createBackButton(userId)]
                                });
                                break;
                                
                            case 'weekly':
                                currentView = 'weekly';
                                const weeklyEmbed = await buildWeeklyQuestsEmbed(userId);
                                await interaction.editReply({
                                    embeds: [weeklyEmbed],
                                    components: [createBackButton(userId)]
                                });
                                break;
                                
                            case 'achievements':
                                currentView = 'achievements';
                                achievementPage = 0;
                                const achResult = await buildAchievementsEmbed(userId, achievementPage);
                                await interaction.editReply({
                                    embeds: [achResult.embed],
                                    components: [createAchievementNavButtons(userId, achResult.currentPage, achResult.totalPages)]
                                });
                                break;
                                
                            case 'ach_prev':
                                if (achievementPage > 0) achievementPage--;
                                const prevAchResult = await buildAchievementsEmbed(userId, achievementPage);
                                await interaction.editReply({
                                    embeds: [prevAchResult.embed],
                                    components: [createAchievementNavButtons(userId, prevAchResult.currentPage, prevAchResult.totalPages)]
                                });
                                break;
                                
                            case 'ach_next':
                                achievementPage++;
                                const nextAchResult = await buildAchievementsEmbed(userId, achievementPage);
                                await interaction.editReply({
                                    embeds: [nextAchResult.embed],
                                    components: [createAchievementNavButtons(userId, nextAchResult.currentPage, nextAchResult.totalPages)]
                                });
                                break;
                                
                            case 'chains':
                                currentView = 'chains';
                                const chainsEmbed = await buildChainQuestsEmbed(userId);
                                await interaction.editReply({
                                    embeds: [chainsEmbed],
                                    components: [createBackButton(userId)]
                                });
                                break;
                                
                            case 'help':
                                currentView = 'help';
                                const helpEmbed = buildHelpEmbed();
                                await interaction.editReply({
                                    embeds: [helpEmbed],
                                    components: [createBackButton(userId)]
                                });
                                break;
                                
                            case 'refresh':
                                // Refresh current view
                                if (currentView === 'daily') {
                                    const refreshDaily = await buildDailyQuestsEmbed(userId);
                                    await interaction.editReply({ embeds: [refreshDaily] });
                                } else if (currentView === 'weekly') {
                                    const refreshWeekly = await buildWeeklyQuestsEmbed(userId);
                                    await interaction.editReply({ embeds: [refreshWeekly] });
                                } else if (currentView === 'achievements') {
                                    const refreshAch = await buildAchievementsEmbed(userId, achievementPage);
                                    await interaction.editReply({
                                        embeds: [refreshAch.embed],
                                        components: [createAchievementNavButtons(userId, refreshAch.currentPage, refreshAch.totalPages)]
                                    });
                                } else if (currentView === 'chains') {
                                    const refreshChains = await buildChainQuestsEmbed(userId);
                                    await interaction.editReply({ embeds: [refreshChains] });
                                } else {
                                    const refreshMain = buildMainMenuEmbed(userId, streak);
                                    await interaction.editReply({ embeds: [refreshMain] });
                                }
                                break;
                        }
                    } catch (error) {
                        console.error('[Quest] Interaction error:', error);
                    }
                });
                
                collector.on('end', async () => {
                    try {
                        const disabledButtons = createMainMenuButtons(userId);
                        disabledButtons.components.forEach(btn => btn.setDisabled(true));
                        await sent.edit({ components: [disabledButtons] }).catch(() => {});
                    } catch {}
                });
                
            } catch (error) {
                console.error('[Quest] Command error:', error);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(COLORS.ERROR)
                            .setTitle('❌ Error')
                            .setDescription('An error occurred while loading quests. Please try again.')
                    ]
                });
            }
        }
        
        // ═══════════════════════════════════════════════════════════════════
        // .CLAIM / .CL COMMAND
        // ═══════════════════════════════════════════════════════════════════
        if (content === '.claim' || content === '.cl') {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }
            
            try {
                const currentDate = getCurrentDate();
                const currentWeek = getWeekIdentifier();
                
                // Clean up old progress
                await Promise.all([
                    db.run(`DELETE FROM dailyQuestProgress WHERE date != ?`, [currentDate]),
                    db.run(`DELETE FROM weeklyQuestProgress WHERE week != ?`, [currentWeek])
                ]).catch(() => {});
                
                const result = await QuestClaimService.claimAll(userId);
                
                if (!result.success || result.nothingToClaim) {
                    return message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(COLORS.ERROR)
                                .setTitle('⚠️ Nothing to Claim')
                                .setDescription([
                                    'You haven\'t completed any quests or unlocked any milestones yet.',
                                    '',
                                    '**Tips:**',
                                    '• Complete all daily quests for the daily reward',
                                    '• Complete all weekly quests for the weekly reward',
                                    '• Reach achievement milestones for bonus rewards',
                                    '',
                                    `⏰ **Daily reset:** ${getTimeUntilDailyReset()}`,
                                    `⏰ **Weekly reset:** ${getTimeUntilWeeklyReset()}`
                                ].join('\n'))
                        ]
                    });
                }
                
                const rewardEmbed = new EmbedBuilder()
                    .setColor(COLORS.SUCCESS)
                    .setTitle('🎁 Rewards Claimed!')
                    .setTimestamp();
                
                const rewardLines = [];
                
                if (result.results.totalCoins > 0) {
                    rewardLines.push(`💰 **Coins:** ${formatNumber(result.results.totalCoins)}`);
                }
                if (result.results.totalGems > 0) {
                    rewardLines.push(`💎 **Gems:** ${formatNumber(result.results.totalGems)}`);
                }
                
                if (result.results.allItems?.length > 0) {
                    const itemMap = new Map();
                    result.results.allItems.forEach(item => {
                        const name = typeof item === 'string' ? item : item.name;
                        const qty = typeof item === 'string' ? 1 : (item.quantity || 1);
                        itemMap.set(name, (itemMap.get(name) || 0) + qty);
                    });
                    
                    const itemLines = Array.from(itemMap.entries())
                        .map(([name, qty]) => `📦 ${name} x${qty}`);
                    
                    rewardLines.push('\n**Items:**');
                    rewardLines.push(itemLines.join('\n'));
                }
                
                const claimedTypes = [];
                if (result.results.daily) claimedTypes.push('✅ Daily Quests');
                if (result.results.weekly) claimedTypes.push('✅ Weekly Quests');
                if (result.results.achievements) claimedTypes.push('✅ Achievement Milestones');
                
                rewardEmbed.setDescription([
                    '**Claimed:**',
                    claimedTypes.join('\n'),
                    '',
                    '**Rewards:**',
                    rewardLines.join('\n')
                ].join('\n'));
                
                rewardEmbed.setFooter({ text: 'Keep completing quests for more rewards!' });
                
                await message.reply({ embeds: [rewardEmbed] });
                
            } catch (error) {
                console.error('[Claim] Command error:', error);
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(COLORS.ERROR)
                            .setTitle('❌ Claim Failed')
                            .setDescription('An error occurred while processing your claim. Please try again.')
                    ]
                });
            }
        }
    });
};
