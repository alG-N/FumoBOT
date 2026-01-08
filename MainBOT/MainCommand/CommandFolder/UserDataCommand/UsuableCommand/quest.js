const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const db = require('../../../Core/Database/dbSetting');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
const { formatNumber } = require('../../../Ultility/formatting');
const { formatProgressBar, formatDuration } = require('../../../Ultility/balanceFormatter');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');

const {
    QUEST_CONFIG,
    DAILY_QUEST_POOL,
    WEEKLY_QUEST_POOL,
    QUEST_CHAINS,
    getStreakBonus
} = require('../../../Configuration/questConfig');
const { ACHIEVEMENTS } = require('../../../Configuration/unifiedAchievementConfig');

const QuestPoolService = require('../../../Service/UserDataService/QuestService/QuestPoolService');
const QuestProgressService = require('../../../Service/UserDataService/QuestService/QuestProgressService');
const QuestClaimService = require('../../../Service/UserDataService/QuestService/QuestClaimService');

const INTERACTION_TIMEOUT = 180000;
const COLORS = {
    MAIN: '#5DADE2',
    DAILY: '#FFD700',
    WEEKLY: '#9B59B6',
    ACHIEVEMENTS: '#2ECC71',
    CHAINS: '#E74C3C',
    SUCCESS: '#00FF7F',
    ERROR: '#FF4444',
    INFO: '#3498DB',
    REROLL: '#FF8C00'
};

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

function formatReward(reward, compact = false) {
    const parts = [];
    if (reward.coins) parts.push(`💰 ${formatNumber(reward.coins)}`);
    if (reward.gems) parts.push(`💎 ${formatNumber(reward.gems)}`);
    if (reward.tickets) parts.push(`🎫 ${reward.tickets}`);
    if (reward.items?.length) {
        if (compact) {
            // Show badge names with emoji based on rarity tier
            const badgeNames = reward.items.map(item => {
                const match = item.match(/\(([CLREMT?])\)$/);
                const emoji = match ? getBadgeEmoji(match[1]) : '🏅';
                return `${emoji} ${item}`;
            });
            parts.push(badgeNames.join(', '));
        } else {
            parts.push(`🏅 ${reward.items.join(', ')}`);
        }
    }
    return parts.join(' | ') || 'No rewards';
}

function getBadgeEmoji(tier) {
    const tierEmojis = {
        'C': '🥉', // Common
        'R': '🥈', // Rare
        'E': '🥇', // Epic
        'L': '💎', // Legendary
        'M': '🌟', // Mythical
        'T': '✨', // Transcendent
        '?': '❓'  // Special/Unknown
    };
    return tierEmojis[tier] || '🏅';
}

function getDifficultyEmoji(goal, minGoal, maxGoal) {
    const range = maxGoal - minGoal;
    if (range === 0) return '🟢';
    const position = (goal - minGoal) / range;
    if (position <= 0.33) return '🟢';
    if (position <= 0.66) return '🟡';
    return '🔴';
}

function buildMainMenuEmbed(userId, streak = 0, rerollsUsed = 0) {
    const streakInfo = getStreakBonus(streak);
    const streakEmoji = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '📅';
    const rerollsRemaining = QUEST_CONFIG.maxRerolls - rerollsUsed;
    
    return new EmbedBuilder()
        .setColor(COLORS.MAIN)
        .setTitle('📜 Fumo Quest Board')
        .setDescription([
            '> *Complete quests to earn PrayTickets, Coins, Gems and more!*',
            '',
            '**━━━━━━━━━ Navigation ━━━━━━━━━**',
            '',
            `🗓️ **Daily Quests** — ${QUEST_CONFIG.dailyQuestCount} random quests, reset daily`,
            `📅 **Weekly Quests** — ${QUEST_CONFIG.weeklyQuestCount} bigger challenges, weekly reset`,
            '🏆 **Achievements** — Permanent milestone rewards',
            '🔗 **Quest Chains** — Multi-quest story progressions',
            '',
            '**━━━━━━━━━━ Status ━━━━━━━━━━**',
            '',
            `${streakEmoji} **Current Streak:** ${streak} days`,
            `📈 **Streak Multiplier:** x${streakInfo.multiplier.toFixed(2)}`,
            `🔄 **Rerolls Available:** ${rerollsRemaining}/${QUEST_CONFIG.maxRerolls}`,
            '',
            '**━━━━━━━━━━ Resets ━━━━━━━━━━**',
            '',
            `⏰ **Daily Reset:** ${getTimeUntilDailyReset()}`,
            `⏰ **Weekly Reset:** ${getTimeUntilWeeklyReset()}`
        ].join('\n'))
        .setFooter({ text: 'Use 🎁 Claim button to collect rewards • Reroll to swap quests' })
        .setTimestamp();
}

/**
 * Generate scaling milestones for achievements
 * After all base milestones are claimed, generate new ones with increasing requirements and rewards
 * @param {Object} achievement - The achievement config
 * @param {number} claimedCount - Number of milestones already claimed
 * @returns {Array} Array of milestones including generated ones
 */
function getScalingMilestones(achievement, claimedCount) {
    const baseMilestones = achievement.milestones;
    
    // If we haven't claimed all base milestones, return the base ones
    if (claimedCount < baseMilestones.length) {
        return baseMilestones;
    }
    
    // Generate additional milestones beyond the base
    const result = [...baseMilestones];
    const lastBase = baseMilestones[baseMilestones.length - 1];
    const scalingLevels = claimedCount - baseMilestones.length + 3; // Always show 3 more milestones ahead
    
    for (let i = 0; i < scalingLevels; i++) {
        const tier = baseMilestones.length + i;
        const scaleFactor = Math.pow(2, i + 1); // 2x, 4x, 8x, 16x...
        
        // Calculate new count requirement
        const newCount = Math.floor(lastBase.count * scaleFactor);
        
        // Scale rewards (with diminishing returns for balance)
        const rewardScale = Math.pow(1.5, i + 1);
        const newReward = {
            coins: Math.floor((lastBase.reward.coins || 0) * rewardScale),
            gems: Math.floor((lastBase.reward.gems || 0) * rewardScale),
            tickets: Math.floor((lastBase.reward.tickets || 0) * rewardScale)
        };
        
        // Award special badges at certain tiers
        if ((tier + 1) % 3 === 0) { // Every 3rd tier beyond base
            const badgeType = getBadgeTier(tier);
            const badgeName = achievement.name.replace(/\s+/g, '') + `Badge(${badgeType})`;
            newReward.items = [badgeName];
        }
        
        result.push({ count: newCount, reward: newReward });
    }
    
    return result;
}

/**
 * Get badge tier based on milestone tier
 */
function getBadgeTier(tier) {
    if (tier >= 15) return '?'; // Mythic
    if (tier >= 12) return 'T'; // Transcendent
    if (tier >= 9) return 'M';  // Masterwork
    if (tier >= 6) return 'L';  // Legendary
    return 'E'; // Epic
}

/**
 * Check if there are any completed but unclaimed quests or achievements
 * @returns {Promise<{hasClaimable: boolean, dailyClaimable: number, weeklyClaimable: number, achievementClaimable: number}>}
 */
async function checkClaimableQuests(userId) {
    const currentDate = getCurrentDate();
    const currentWeek = getWeekIdentifier();
    
    try {
        // Get daily quests and progress
        const dailyQuests = await QuestPoolService.getDailyQuests(userId);
        const dailyProgress = await QuestProgressService.getDailyProgress(userId, currentDate);
        
        // Count completed but unclaimed daily quests
        let dailyClaimable = 0;
        for (const quest of dailyQuests) {
            const prog = dailyProgress[quest.uniqueId];
            if (prog?.completed && !prog?.claimed) {
                dailyClaimable++;
            }
        }
        
        // Get weekly quests and progress
        const weeklyQuests = await QuestPoolService.getWeeklyQuests(userId);
        const weeklyProgress = await QuestProgressService.getWeeklyProgress(userId, currentWeek);
        
        // Count completed but unclaimed weekly quests
        let weeklyClaimable = 0;
        for (const quest of weeklyQuests) {
            const prog = weeklyProgress[quest.uniqueId];
            if (prog?.completed && !prog?.claimed) {
                weeklyClaimable++;
            }
        }
        
        // Check achievements for claimable milestones (using scaling system)
        const achievementProgress = await QuestProgressService.getAchievementProgress(userId);
        let achievementClaimable = 0;
        
        for (const achievement of ACHIEVEMENTS) {
            const progress = achievementProgress[achievement.id] || { progress: 0, claimedMilestones: [] };
            const claimed = progress.claimedMilestones || [];
            
            // Get scaled milestones
            const dynamicMilestones = getScalingMilestones(achievement, claimed.length);
            
            for (let i = 0; i < dynamicMilestones.length; i++) {
                const milestone = dynamicMilestones[i];
                if (progress.progress >= milestone.count && !claimed.includes(i)) {
                    achievementClaimable++;
                }
            }
        }
        
        return {
            hasClaimable: dailyClaimable > 0 || weeklyClaimable > 0 || achievementClaimable > 0,
            dailyClaimable,
            weeklyClaimable,
            achievementClaimable
        };
    } catch (error) {
        console.error('[Quest] Error checking claimable:', error);
        return { hasClaimable: false, dailyClaimable: 0, weeklyClaimable: 0, achievementClaimable: 0 };
    }
}

async function buildDailyQuestsEmbed(userId) {
    const currentDate = getCurrentDate();
    const activeQuests = await QuestPoolService.getDailyQuests(userId);
    const progress = await QuestProgressService.getDailyProgress(userId, currentDate);
    
    const questsByDifficulty = { easy: [], medium: [], hard: [] };
    
    activeQuests.forEach((quest, index) => {
        const prog = progress[quest.uniqueId] || { progress: 0, completed: false };
        const goal = quest.goal;
        const percentage = Math.min(100, (prog.progress / goal) * 100);
        
        const range = quest.maxGoal - quest.minGoal;
        const position = range > 0 ? (goal - quest.minGoal) / range : 0;
        let difficulty = 'easy';
        if (position > 0.66) difficulty = 'hard';
        else if (position > 0.33) difficulty = 'medium';
        
        const status = prog.completed ? '✅' : percentage >= 90 ? '🔶' : '⬜';
        const diffEmoji = getDifficultyEmoji(goal, quest.minGoal, quest.maxGoal);
        const desc = quest.descTemplate.replace('{goal}', formatNumber(goal));
        
        const questLine = `${status} \`${index + 1}\` ${quest.icon} ${desc} — **${formatNumber(prog.progress)}/${formatNumber(goal)}** ${diffEmoji}`;
        questsByDifficulty[difficulty].push(questLine);
    });
    
    const completedCount = activeQuests.filter(q => progress[q.uniqueId]?.completed).length;
    const allCompleted = completedCount === activeQuests.length;
    
    const totalRewards = activeQuests.reduce((acc, q) => {
        acc.coins += q.scaledReward.coins || 0;
        acc.gems += q.scaledReward.gems || 0;
        acc.tickets += q.scaledReward.tickets || 0;
        return acc;
    }, { coins: 0, gems: 0, tickets: 0 });
    
    return new EmbedBuilder()
        .setColor(allCompleted ? COLORS.SUCCESS : COLORS.DAILY)
        .setTitle('🗓️ Daily Quests')
        .setDescription([
            `**Progress:** ${completedCount}/${activeQuests.length} completed | ⏰ Resets: ${getTimeUntilDailyReset()}`,
            `**Total Rewards:** 💰 ${formatNumber(totalRewards.coins)} | 💎 ${formatNumber(totalRewards.gems)} | 🎫 ${totalRewards.tickets}`,
            allCompleted ? '🎉 **All complete! Use `.claim`**' : '',
            '',
            '**🟢 Easy**',
            questsByDifficulty.easy.length > 0 ? questsByDifficulty.easy.join('\n') : '_None today_',
            '',
            '**🟡 Medium**',
            questsByDifficulty.medium.length > 0 ? questsByDifficulty.medium.join('\n') : '_None today_',
            '',
            '**🔴 Hard**',
            questsByDifficulty.hard.length > 0 ? questsByDifficulty.hard.join('\n') : '_None today_'
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Quests track automatically • Use .reroll [#] to swap a quest' })
        .setTimestamp();
}

async function buildWeeklyQuestsEmbed(userId) {
    const currentWeek = getWeekIdentifier();
    const activeQuests = await QuestPoolService.getWeeklyQuests(userId);
    const progress = await QuestProgressService.getWeeklyProgress(userId, currentWeek);
    
    const questLines = activeQuests.map((quest, index) => {
        const prog = progress[quest.uniqueId] || { progress: 0, completed: false };
        const goal = quest.goal;
        const percentage = Math.min(100, (prog.progress / goal) * 100);
        
        const status = prog.completed ? '✅' : percentage >= 90 ? '🔶' : '⬜';
        const diffEmoji = getDifficultyEmoji(goal, quest.minGoal, quest.maxGoal);
        const desc = quest.descTemplate.replace('{goal}', formatNumber(goal));
        const rewardPreview = `💰${formatNumber(quest.scaledReward.coins)} 💎${formatNumber(quest.scaledReward.gems)}`;
        
        return `${status} \`${index + 1}\` ${quest.icon} ${desc}\n   └ **${formatNumber(prog.progress)}/${formatNumber(goal)}** ${diffEmoji} | ${rewardPreview}`;
    });
    
    const completedCount = activeQuests.filter(q => progress[q.uniqueId]?.completed).length;
    const allCompleted = completedCount === activeQuests.length;
    
    const totalRewards = activeQuests.reduce((acc, q) => {
        acc.coins += q.scaledReward.coins || 0;
        acc.gems += q.scaledReward.gems || 0;
        acc.tickets += q.scaledReward.tickets || 0;
        return acc;
    }, { coins: 0, gems: 0, tickets: 0 });
    
    return new EmbedBuilder()
        .setColor(allCompleted ? COLORS.SUCCESS : COLORS.WEEKLY)
        .setTitle('📅 Weekly Quests')
        .setDescription([
            `**Progress:** ${completedCount}/${activeQuests.length} completed | ⏰ Resets: ${getTimeUntilWeeklyReset()}`,
            `**Total Rewards:** 💰 ${formatNumber(totalRewards.coins)} | 💎 ${formatNumber(totalRewards.gems)} | 🎫 ${totalRewards.tickets}`,
            allCompleted ? '🎉 **All complete! Use `.claim`**' : '',
            '',
            questLines.join('\n\n')
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Weekly quests reset Monday 00:00 UTC • Use .reroll weekly [#] to swap' })
        .setTimestamp();
}

async function buildAchievementsEmbed(userId, page = 0) {
    const progressData = await QuestProgressService.getAchievementProgress(userId);
    
    const achievementsPerPage = 4;
    const totalPages = Math.ceil(ACHIEVEMENTS.length / achievementsPerPage);
    const startIdx = page * achievementsPerPage;
    const pageAchievements = ACHIEVEMENTS.slice(startIdx, startIdx + achievementsPerPage);
    
    const achievementLines = pageAchievements.map(ach => {
        const prog = progressData[ach.id] || { progress: 0, claimedMilestones: [] };
        const claimedMilestones = prog.claimedMilestones || [];
        
        // Get dynamic milestones (scaling system)
        const dynamicMilestones = getScalingMilestones(ach, claimedMilestones.length);
        
        // Find next unclaimed milestone
        const nextMilestoneIdx = claimedMilestones.length;
        const nextMilestone = dynamicMilestones[nextMilestoneIdx];
        
        // Count claimable milestones
        let claimableCount = 0;
        for (let i = 0; i < dynamicMilestones.length; i++) {
            if (prog.progress >= dynamicMilestones[i].count && !claimedMilestones.includes(i)) {
                claimableCount++;
            }
        }
        
        const targetCount = nextMilestone?.count || dynamicMilestones[dynamicMilestones.length - 1].count;
        
        let statusEmoji = '';
        if (claimableCount > 0) statusEmoji = `🎁x${claimableCount}`;
        else if (claimedMilestones.length > 0) statusEmoji = '✅';
        
        return [
            `${ach.icon} **${ach.name}** ${statusEmoji}`,
            `└ ${formatNumber(prog.progress)}/${formatNumber(targetCount)} • Next: ${nextMilestone ? formatReward(nextMilestone.reward) : 'MAX'}`
        ].join('\n');
    });
    
    const totalClaimable = ACHIEVEMENTS.reduce((sum, ach) => {
        const prog = progressData[ach.id] || { progress: 0, claimedMilestones: [] };
        const claimedMilestones = prog.claimedMilestones || [];
        const dynamicMilestones = getScalingMilestones(ach, claimedMilestones.length);
        
        let count = 0;
        for (let i = 0; i < dynamicMilestones.length; i++) {
            if (prog.progress >= dynamicMilestones[i].count && !claimedMilestones.includes(i)) {
                count++;
            }
        }
        return sum + count;
    }, 0);
    
    return {
        embed: new EmbedBuilder()
            .setColor(totalClaimable > 0 ? COLORS.SUCCESS : COLORS.ACHIEVEMENTS)
            .setTitle('🏆 Achievements')
            .setDescription([
                totalClaimable > 0 ? `🎁 **${totalClaimable} claimable!** Use \`.claim\`` : '',
                '> *View detailed progress with* `.balance achievements`',
                '',
                achievementLines.join('\n\n')
            ].filter(Boolean).join('\n'))
            .setFooter({ text: `Page ${page + 1}/${totalPages} • Achievements scale infinitely!` })
            .setTimestamp(),
        totalPages,
        currentPage: page
    };
}

async function buildChainQuestsEmbed(userId) {
    const chainLines = await Promise.all(QUEST_CHAINS.map(async chain => {
        let prereqText = '';
        
        if (chain.prerequisites) {
            const prereqs = [];
            if (chain.prerequisites.level) prereqs.push(`Level ${chain.prerequisites.level}+`);
            if (chain.prerequisites.rebirth) prereqs.push(`Rebirth ${chain.prerequisites.rebirth}+`);
            if (chain.prerequisites.chains?.length) prereqs.push(`Complete: ${chain.prerequisites.chains.join(', ')}`);
            prereqText = prereqs.length > 0 ? `📋 *Requires: ${prereqs.join(', ')}*` : '';
        }
        
        let completedQuests = 0;
        try {
            const chainProgress = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT currentStep FROM questChainProgress WHERE userId = ? AND chainId = ?`,
                    [userId, chain.id],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            completedQuests = chainProgress?.currentStep || 0;
        } catch {}
        
        return [
            `${chain.icon} **${chain.name}**`,
            `*${chain.description}*`,
            prereqText,
            `${formatProgressBar(completedQuests, chain.quests.length, 8)} ${completedQuests}/${chain.quests.length} quests`,
            `🎁 Bonus: ${formatReward(chain.bonusRewards)}`
        ].filter(Boolean).join('\n');
    }));
    
    return new EmbedBuilder()
        .setColor(COLORS.CHAINS)
        .setTitle('🔗 Quest Chains')
        .setDescription([
            '> *Complete quest chains for massive bonus rewards!*',
            '',
            chainLines.join('\n\n')
        ].join('\n'))
        .setFooter({ text: 'Quest chains progress persists across resets!' })
        .setTimestamp();
}

function buildHelpEmbed() {
    return new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle('❓ Quest System Help')
        .setDescription([
            '**━━━━━━━━ Features ━━━━━━━━**',
            '',
            '🎲 **Random Quest Selection**',
            `Each day you get ${QUEST_CONFIG.dailyQuestCount} random daily quests.`,
            `Each week you get ${QUEST_CONFIG.weeklyQuestCount} random weekly quests.`,
            '',
            '📊 **Dynamic Goals**',
            'Quest goals vary! "Roll gacha" might be 50 or 500.',
            'Higher goals = Higher rewards!',
            '',
            '🔄 **Reroll System**',
            `Use \`.reroll [#]\` to swap a quest (${QUEST_CONFIG.rerollCost} gems).`,
            `Limited to ${QUEST_CONFIG.maxRerolls} rerolls per day.`,
            '',
            '**━━━━━━━━ Commands ━━━━━━━━**',
            '',
            '`.quest` / `.qu` - View quest board',
            '`.claim` / `.cl` - Claim completed rewards',
            '`.reroll [#]` - Reroll daily quest #',
            '`.reroll weekly [#]` - Reroll weekly quest #',
            '',
            '**━━━━━━━━ Streaks ━━━━━━━━**',
            '',
            '🔥 Complete ALL daily quests to maintain streak!',
            '',
            '• 3 days: x1.1 multiplier',
            '• 7 days: x1.25 multiplier',
            '• 14 days: x1.5 multiplier',
            '• 30 days: x2.0 multiplier'
        ].join('\n'))
        .setFooter({ text: 'Quest progress tracks automatically!' })
        .setTimestamp();
}

function buildRerollInfoEmbed(rerollsUsed) {
    const rerollsRemaining = QUEST_CONFIG.maxRerolls - rerollsUsed;
    
    return new EmbedBuilder()
        .setColor(COLORS.REROLL)
        .setTitle('🔄 Quest Reroll System')
        .setDescription([
            '**How Rerolling Works:**',
            '',
            '• Swap a quest you don\'t want for a different one',
            `• Each reroll costs **${QUEST_CONFIG.rerollCost} gems**`,
            `• You can reroll up to **${QUEST_CONFIG.maxRerolls}** times per day`,
            '• Rerolls reset at daily reset time',
            '• Cannot reroll a quest with progress > 0',
            '',
            `**Your Rerolls:** ${rerollsRemaining}/${QUEST_CONFIG.maxRerolls} remaining`,
            '',
            '**Usage:**',
            '`.reroll 1` - Reroll daily quest #1',
            '`.reroll weekly 2` - Reroll weekly quest #2'
        ].join('\n'))
        .setFooter({ text: `Reroll cost: ${QUEST_CONFIG.rerollCost} gems` })
        .setTimestamp();
}

function createMainMenuButtons(userId) {
    // Row 1: Main quest navigation
    const row1 = new ActionRowBuilder().addComponents(
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
    
    return [row1];
}

/**
 * Create back button row with conditional claim button state
 * @param {string} userId - User ID
 * @param {boolean} showReroll - Whether to show reroll button
 * @param {string} questType - 'daily' or 'weekly'
 * @param {boolean} hasClaimable - Whether there are claimable rewards (disables claim if false)
 */
function createBackButton(userId, showReroll = false, questType = 'daily', hasClaimable = true) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_main', userId))
            .setLabel('◀️ Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_claim', userId))
            .setLabel(hasClaimable ? '🎁 Claim' : '🎁 Nothing to Claim')
            .setStyle(hasClaimable ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!hasClaimable),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_refresh', userId))
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary)
    );
    
    if (showReroll) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId(`quest_reroll_menu_${questType}`, userId))
                .setLabel('🔀 Reroll')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    
    return row;
}

function createRerollSelectButtons(userId, questType, questCount, rerollsRemaining) {
    const rows = [];
    
    // First row: Quest selection buttons
    const row1 = new ActionRowBuilder();
    for (let i = 1; i <= Math.min(questCount, 5); i++) {
        row1.addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId(`quest_reroll_${questType}_${i}`, userId))
                .setLabel(`#${i}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(rerollsRemaining <= 0)
        );
    }
    rows.push(row1);
    
    // Second row: Back button and info
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId(`quest_${questType}`, userId))
            .setLabel('◀️ Cancel')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_reroll_info_btn', userId))
            .setLabel(`💎 ${QUEST_CONFIG.rerollCost} gems • ${rerollsRemaining} left`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
    );
    rows.push(row2);
    
    return rows;
}

/**
 * Create achievement navigation buttons with claim button
 * @param {string} userId - User ID
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total pages
 * @param {boolean} hasClaimable - Whether there are claimable rewards
 */
function createAchievementNavButtons(userId, currentPage, totalPages, hasClaimable = true) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_main', userId))
            .setLabel('◀️ Back')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_claim', userId))
            .setLabel(hasClaimable ? '🎁 Claim' : '🎁 Nothing')
            .setStyle(hasClaimable ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(!hasClaimable),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_ach_prev', userId))
            .setLabel('⬅️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_ach_next', userId))
            .setLabel('➡️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage >= totalPages - 1),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('quest_refresh', userId))
            .setLabel('🔄')
            .setStyle(ButtonStyle.Primary)
    );
}

async function handleReroll(message, userId, questType, questNumber) {
    const currentDate = getCurrentDate();
    const period = questType === 'weekly' ? getWeekIdentifier() : currentDate;
    
    const rerollData = await QuestPoolService.getRerollCount(userId, questType, period);
    const rerollsUsed = rerollData?.count || 0;
    
    if (rerollsUsed >= QUEST_CONFIG.maxRerolls) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ No Rerolls Left')
                    .setDescription(`You've used all ${QUEST_CONFIG.maxRerolls} rerolls today.\nRerolls reset at daily reset: ${getTimeUntilDailyReset()}`)
            ]
        });
    }
    
    const userData = await new Promise((resolve, reject) => {
        db.get(`SELECT gems FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
            err ? reject(err) : resolve(row);
        });
    });
    
    if (!userData || (userData.gems || 0) < QUEST_CONFIG.rerollCost) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Not Enough Gems')
                    .setDescription(`Rerolling costs **${QUEST_CONFIG.rerollCost} gems**.\nYou have: **${userData?.gems || 0} gems**`)
            ]
        });
    }
    
    const quests = questType === 'weekly' 
        ? await QuestPoolService.getWeeklyQuests(userId)
        : await QuestPoolService.getDailyQuests(userId);
    
    if (questNumber < 1 || questNumber > quests.length) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Invalid Quest Number')
                    .setDescription(`Please specify a quest number between 1 and ${quests.length}.`)
            ]
        });
    }
    
    const questIndex = questNumber - 1;
    const oldQuest = quests[questIndex];
    
    const progress = questType === 'weekly'
        ? await QuestProgressService.getWeeklyProgress(userId, getWeekIdentifier())
        : await QuestProgressService.getDailyProgress(userId, currentDate);
    
    const questProgress = progress[oldQuest.uniqueId];
    if (questProgress && questProgress.progress > 0) {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Cannot Reroll')
                    .setDescription(`You already have progress on this quest (${questProgress.progress}/${oldQuest.goal}).\nYou can only reroll quests with 0 progress.`)
            ]
        });
    }
    
    try {
        // Reroll expects questId, not questIndex
        const result = await QuestPoolService.rerollQuest(userId, oldQuest.id, questType);
        
        if (!result.success) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(COLORS.ERROR)
                        .setTitle('❌ Reroll Failed')
                        .setDescription(`Reason: ${result.reason || 'Unknown error'}`)
                ]
            });
        }
        
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE userCoins SET gems = gems - ? WHERE userId = ?`,
                [QUEST_CONFIG.rerollCost, userId],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        const newQuest = result.newQuest;
        const oldDesc = oldQuest.descTemplate.replace('{goal}', formatNumber(oldQuest.goal));
        const newDesc = newQuest.descTemplate.replace('{goal}', formatNumber(newQuest.goal));
        
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.SUCCESS)
                    .setTitle('🔄 Quest Rerolled!')
                    .setDescription([
                        `**Old Quest:**`,
                        `${oldQuest.icon} ~~${oldDesc}~~`,
                        '',
                        `**New Quest:**`,
                        `${newQuest.icon} **${newDesc}**`,
                        '',
                        `**Rewards:** ${formatReward(newQuest.scaledReward)}`,
                        '',
                        `💎 **-${QUEST_CONFIG.rerollCost} gems**`,
                        `🔄 **Rerolls remaining:** ${QUEST_CONFIG.maxRerolls - rerollsUsed - 1}/${QUEST_CONFIG.maxRerolls}`
                    ].join('\n'))
            ]
        });
        
    } catch (error) {
        console.error('[Quest Reroll] Error:', error);
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('❌ Reroll Failed')
                    .setDescription('An error occurred while rerolling. Please try again.')
            ]
        });
    }
}

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const userId = message.author.id;
        const content = message.content.trim().toLowerCase();
        const args = content.split(/\s+/);
        
        // .REROLL COMMAND
        if (args[0] === '.reroll' || args[0] === '.rr') {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }
            
            let questType = 'daily';
            let questNumber = null;
            
            if (args[1] === 'weekly' || args[1] === 'w') {
                questType = 'weekly';
                questNumber = parseInt(args[2]);
            } else if (args[1]) {
                questNumber = parseInt(args[1]);
            }
            
            if (!questNumber || isNaN(questNumber)) {
                const currentDate = getCurrentDate();
                const rerollData = await QuestPoolService.getRerollCount(userId, currentDate);
                const rerollsUsed = rerollData?.rerollCount || 0;
                
                return message.reply({
                    embeds: [buildRerollInfoEmbed(rerollsUsed)]
                });
            }
            
            return handleReroll(message, userId, questType, questNumber);
        }
        
        // .QUEST COMMAND
        if (content === '.quest' || content === '.qu' || content.startsWith('.quest ') || content.startsWith('.qu ')) {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }
            
            // Handle subcommands
            const subcommand = args[1]?.toLowerCase();
            if (subcommand === 'achievements' || subcommand === 'ach' || subcommand === 'a') {
                // Show achievements directly
                try {
                    const achResult = await buildAchievementsEmbed(userId, 0);
                    const { hasClaimable } = await checkClaimableQuests(userId);
                    
                    const sent = await message.channel.send({
                        embeds: [achResult.embed],
                        components: [createAchievementNavButtons(userId, achResult.currentPage, achResult.totalPages, hasClaimable)]
                    });
                    
                    // Start collector for navigation
                    let achievementPage = 0;
                    const collector = sent.createMessageComponentCollector({
                        time: INTERACTION_TIMEOUT,
                        filter: (i) => i.user.id === userId
                    });
                    
                    collector.on('collect', async (interaction) => {
                        try {
                            await interaction.deferUpdate();
                            const parts = interaction.customId.split('_');
                            let action = parts[1];
                            if (parts[1] === 'ach' && parts[2]) action = `ach_${parts[2]}`;
                            
                            if (action === 'ach_prev' && achievementPage > 0) {
                                achievementPage--;
                            } else if (action === 'ach_next') {
                                achievementPage++;
                            } else if (action === 'claim') {
                                const claimResult = await QuestClaimService.claimAll(userId);
                                if (claimResult.achievementsClaimed > 0 || claimResult.dailyClaimed > 0 || claimResult.weeklyClaimed > 0) {
                                    const description = [
                                        '**Rewards Claimed:**',
                                        claimResult.dailyClaimed > 0 ? `📅 **${claimResult.dailyClaimed}** Daily Quest(s)` : null,
                                        claimResult.weeklyClaimed > 0 ? `📆 **${claimResult.weeklyClaimed}** Weekly Quest(s)` : null,
                                        claimResult.achievementsClaimed > 0 ? `🏆 **${claimResult.achievementsClaimed}** Achievement(s)` : null,
                                        '',
                                        '**Received:**',
                                        claimResult.totalCoins > 0 ? `💰 **${formatNumber(claimResult.totalCoins)}** Coins` : null,
                                        claimResult.totalGems > 0 ? `💎 **${formatNumber(claimResult.totalGems)}** Gems` : null,
                                        claimResult.totalTickets > 0 ? `🎟️ **${formatNumber(claimResult.totalTickets)}** Tickets` : null,
                                        claimResult.allItems?.length > 0 ? `📦 **${claimResult.allItems.length}** Item(s)` : null
                                    ].filter(Boolean).join('\n');
                                    
                                    await interaction.editReply({
                                        embeds: [new EmbedBuilder()
                                            .setColor(COLORS.SUCCESS)
                                            .setTitle('🎁 Rewards Claimed!')
                                            .setDescription(description)
                                            .setTimestamp()
                                        ]
                                    });
                                } else {
                                    await interaction.editReply({
                                        embeds: [new EmbedBuilder()
                                            .setColor(COLORS.ERROR)
                                            .setTitle('❌ Nothing to Claim')
                                            .setDescription('No completed quests or achievements to claim.')
                                            .setTimestamp()
                                        ]
                                    });
                                }
                                return;
                            } else if (action === 'main') {
                                collector.stop();
                                return;
                            }
                            
                            const newResult = await buildAchievementsEmbed(userId, achievementPage);
                            const { hasClaimable: newClaimable } = await checkClaimableQuests(userId);
                            await interaction.editReply({
                                embeds: [newResult.embed],
                                components: [createAchievementNavButtons(userId, newResult.currentPage, newResult.totalPages, newClaimable)]
                            });
                        } catch (err) {
                            console.error('[Quest Achievements] Interaction error:', err);
                        }
                    });
                    
                    collector.on('end', async () => {
                        try {
                            await sent.edit({ components: [] }).catch(() => {});
                        } catch {}
                    });
                    
                    return;
                } catch (error) {
                    console.error('[Quest Achievements] Error:', error);
                    return message.reply({
                        embeds: [new EmbedBuilder()
                            .setColor(COLORS.ERROR)
                            .setTitle('❌ Error')
                            .setDescription('Failed to load achievements.')
                        ]
                    });
                }
            }
            
            try {
                const currentDate = getCurrentDate();
                
                await QuestPoolService.initializeUserQuests(userId);
                
                let streak = 0;
                try {
                    const streakData = await new Promise((resolve, reject) => {
                        db.get(
                            `SELECT dailyStreak FROM userCoins WHERE userId = ?`,
                            [userId],
                            (err, row) => err ? reject(err) : resolve(row)
                        );
                    });
                    streak = streakData?.dailyStreak || 0;
                } catch {}
                
                const rerollData = await QuestPoolService.getRerollCount(userId, currentDate);
                const rerollsUsed = rerollData?.rerollCount || 0;
                
                const embed = buildMainMenuEmbed(userId, streak, rerollsUsed);
                const buttons = createMainMenuButtons(userId);
                
                const sent = await message.channel.send({
                    embeds: [embed],
                    components: buttons
                });
                
                const collector = sent.createMessageComponentCollector({
                    time: INTERACTION_TIMEOUT,
                    filter: (i) => i.user.id === userId
                });
                
                let achievementPage = 0;
                let currentView = 'main';
                
                collector.on('collect', async (interaction) => {
                    try {
                        await interaction.deferUpdate();
                        
                        const parts = interaction.customId.split('_');
                        let action = parts[1];
                        
                        // Handle mq_* customIds (Main Quest buttons)
                        // Format: mq_story_{userId}_{timestamp} where parts[0]='mq', parts[1]='story'
                        if (parts[0] === 'mq') {
                            action = 'mq';
                        } else if (parts[1] === 'ach' && parts[2]) {
                            action = `ach_${parts[2]}`;
                        } else if (parts[1] === 'reroll' && parts[2]) {
                            action = `reroll_${parts[2]}`;
                            if (parts[3]) action += `_${parts[3]}`;
                            if (parts[4]) action += `_${parts[4]}`;
                        }
                        
                        switch (action) {
                            case 'main':
                                currentView = 'main';
                                const mainEmbed = buildMainMenuEmbed(userId, streak, rerollsUsed);
                                await interaction.editReply({
                                    embeds: [mainEmbed],
                                    components: createMainMenuButtons(userId)
                                });
                                break;
                                
                            case 'daily': {
                                currentView = 'daily';
                                const dailyEmbed = await buildDailyQuestsEmbed(userId);
                                const { hasClaimable: dailyHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [dailyEmbed],
                                    components: [createBackButton(userId, true, 'daily', dailyHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'weekly': {
                                currentView = 'weekly';
                                const weeklyEmbed = await buildWeeklyQuestsEmbed(userId);
                                const { hasClaimable: weeklyHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [weeklyEmbed],
                                    components: [createBackButton(userId, true, 'weekly', weeklyHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'achievements': {
                                currentView = 'achievements';
                                achievementPage = 0;
                                const achResult = await buildAchievementsEmbed(userId, achievementPage);
                                const { hasClaimable: achHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [achResult.embed],
                                    components: [createAchievementNavButtons(userId, achResult.currentPage, achResult.totalPages, achHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'ach_prev': {
                                if (achievementPage > 0) achievementPage--;
                                const prevAchResult = await buildAchievementsEmbed(userId, achievementPage);
                                const { hasClaimable: prevAchHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [prevAchResult.embed],
                                    components: [createAchievementNavButtons(userId, prevAchResult.currentPage, prevAchResult.totalPages, prevAchHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'ach_next': {
                                achievementPage++;
                                const nextAchResult = await buildAchievementsEmbed(userId, achievementPage);
                                const { hasClaimable: nextAchHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [nextAchResult.embed],
                                    components: [createAchievementNavButtons(userId, nextAchResult.currentPage, nextAchResult.totalPages, nextAchHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'chains': {
                                currentView = 'chains';
                                const chainsEmbed = await buildChainQuestsEmbed(userId);
                                const { hasClaimable: chainsHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [chainsEmbed],
                                    components: [createBackButton(userId, false, 'daily', chainsHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'help': {
                                currentView = 'help';
                                const helpEmbed = buildHelpEmbed();
                                const { hasClaimable: helpHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [helpEmbed],
                                    components: [createBackButton(userId, false, 'daily', helpHasClaimable)]
                                });
                                break;
                            }
                                
                            case 'reroll_info': {
                                currentView = 'reroll';
                                const rerollEmbed = buildRerollInfoEmbed(rerollsUsed);
                                const { hasClaimable: rerollHasClaimable } = await checkClaimableQuests(userId);
                                await interaction.editReply({
                                    embeds: [rerollEmbed],
                                    components: [createBackButton(userId, false, 'daily', rerollHasClaimable)]
                                });
                                break;
                            }
                            
                            // Claim Button Handler
                            case 'claim': {
                                const claimResult = await QuestClaimService.claimAll(userId);
                                
                                if (claimResult.dailyClaimed === 0 && claimResult.weeklyClaimed === 0 && !claimResult.achievements) {
                                    const noClaimEmbed = new EmbedBuilder()
                                        .setColor(COLORS.ERROR)
                                        .setTitle('❌ Nothing to Claim')
                                        .setDescription('You have no completed quests to claim rewards from.\n\nComplete your daily or weekly quests first!')
                                        .setTimestamp();
                                    
                                    await interaction.editReply({
                                        embeds: [noClaimEmbed],
                                        components: [createBackButton(userId, false, 'daily', false)]
                                    });
                                } else {
                                    let description = '**Rewards Claimed:**\n';
                                    
                                    if (claimResult.dailyClaimed > 0) {
                                        description += `📅 **${claimResult.dailyClaimed}** Daily Quest${claimResult.dailyClaimed > 1 ? 's' : ''}\n`;
                                    }
                                    if (claimResult.weeklyClaimed > 0) {
                                        description += `📆 **${claimResult.weeklyClaimed}** Weekly Quest${claimResult.weeklyClaimed > 1 ? 's' : ''}\n`;
                                    }
                                    if (claimResult.achievementsClaimed > 0) {
                                        description += `🏆 **${claimResult.achievementsClaimed}** Achievement${claimResult.achievementsClaimed > 1 ? 's' : ''}\n`;
                                    }
                                    
                                    description += '\n**Received:**\n';
                                    if (claimResult.totalCoins > 0) {
                                        description += `💰 **${formatNumber(claimResult.totalCoins)}** Coins\n`;
                                    }
                                    if (claimResult.totalGems > 0) {
                                        description += `💎 **${formatNumber(claimResult.totalGems)}** Gems\n`;
                                    }
                                    if (claimResult.totalTickets > 0) {
                                        description += `🎟️ **${formatNumber(claimResult.totalTickets)}** Tickets\n`;
                                    }
                                    if (claimResult.allItems && claimResult.allItems.length > 0) {
                                        description += `📦 **${claimResult.allItems.length}** Item${claimResult.allItems.length > 1 ? 's' : ''}\n`;
                                    }
                                    
                                    if (claimResult.streakBonus) {
                                        description += `\n🔥 **Streak Bonus!** x${claimResult.streakMultiplier.toFixed(1)} multiplier applied!`;
                                    }
                                    
                                    const claimEmbed = new EmbedBuilder()
                                        .setColor(COLORS.SUCCESS)
                                        .setTitle('🎁 Rewards Claimed!')
                                        .setDescription(description)
                                        .setTimestamp();
                                    
                                    // After claiming, check if there's still more to claim
                                    const { hasClaimable: postClaimHasClaimable } = await checkClaimableQuests(userId);
                                    await interaction.editReply({
                                        embeds: [claimEmbed],
                                        components: [createBackButton(userId, false, 'daily', postClaimHasClaimable)]
                                    });
                                }
                                break;
                            }
                            
                            // Reroll Menu Handlers (show which quest to reroll)
                            case 'reroll_menu_daily': {
                                currentView = 'reroll_select';
                                const currentDate = getCurrentDate();
                                const rerollCountDaily = await QuestPoolService.getRerollCount(userId, 'daily', currentDate);
                                const rerollsRemaining = QUEST_CONFIG.maxRerolls - rerollCountDaily.count;
                                
                                const dailyQuestsList = await QuestPoolService.getDailyQuests(userId);
                                
                                const selectEmbed = new EmbedBuilder()
                                    .setColor(COLORS.REROLL)
                                    .setTitle('🎲 Reroll Daily Quest')
                                    .setDescription(`Select a quest to reroll:\n\n**Rerolls remaining:** ${rerollsRemaining}/${QUEST_CONFIG.maxRerolls}\n**Cost:** ${formatNumber(QUEST_CONFIG.rerollCost)} Gems`)
                                    .addFields(
                                        dailyQuestsList.map((q, i) => ({
                                            name: `${i + 1}. ${q.icon || '📋'} ${q.difficulty?.toUpperCase() || 'NORMAL'}`,
                                            value: q.desc,
                                            inline: false
                                        }))
                                    )
                                    .setFooter({ text: 'Click a button below to reroll that quest' })
                                    .setTimestamp();
                                
                                await interaction.editReply({
                                    embeds: [selectEmbed],
                                    components: [createRerollSelectButtons(userId, 'daily', dailyQuestsList.length, rerollsRemaining)]
                                });
                                break;
                            }
                            
                            case 'reroll_menu_weekly': {
                                currentView = 'reroll_select';
                                const currentWeek = getWeekIdentifier();
                                const rerollCountWeekly = await QuestPoolService.getRerollCount(userId, 'weekly', currentWeek);
                                const rerollsRemainingWeekly = QUEST_CONFIG.maxRerolls - rerollCountWeekly.count;
                                
                                const weeklyQuestsList = await QuestPoolService.getWeeklyQuests(userId);
                                
                                const selectEmbedWeekly = new EmbedBuilder()
                                    .setColor(COLORS.REROLL)
                                    .setTitle('🎲 Reroll Weekly Quest')
                                    .setDescription(`Select a quest to reroll:\n\n**Rerolls remaining:** ${rerollsRemainingWeekly}/${QUEST_CONFIG.maxRerolls}\n**Cost:** ${formatNumber(QUEST_CONFIG.rerollCost)} Gems`)
                                    .addFields(
                                        weeklyQuestsList.map((q, i) => ({
                                            name: `${i + 1}. ${q.icon || '📋'} ${q.difficulty?.toUpperCase() || 'NORMAL'}`,
                                            value: q.desc,
                                            inline: false
                                        }))
                                    )
                                    .setFooter({ text: 'Click a button below to reroll that quest' })
                                    .setTimestamp();
                                
                                await interaction.editReply({
                                    embeds: [selectEmbedWeekly],
                                    components: [createRerollSelectButtons(userId, 'weekly', weeklyQuestsList.length, rerollsRemainingWeekly)]
                                });
                                break;
                            }
                            
                            // Handle reroll execution for specific quest indices
                            default: {
                                // Check if it's a reroll action (reroll_daily_1, reroll_weekly_2, etc.)
                                const rerollMatch = action.match(/^reroll_(daily|weekly)_(\d+)$/);
                                if (rerollMatch) {
                                    const rerollType = rerollMatch[1];
                                    const questIndex = parseInt(rerollMatch[2]) - 1;
                                    
                                    const questList = rerollType === 'daily' 
                                        ? await QuestPoolService.getDailyQuests(userId)
                                        : await QuestPoolService.getWeeklyQuests(userId);
                                    
                                    if (questIndex < 0 || questIndex >= questList.length) {
                                        const { hasClaimable: invalidQuestHasClaimable } = await checkClaimableQuests(userId);
                                        await interaction.editReply({
                                            embeds: [new EmbedBuilder()
                                                .setColor(COLORS.ERROR)
                                                .setTitle('❌ Invalid Quest')
                                                .setDescription('Quest not found.')
                                            ],
                                            components: [createBackButton(userId, false, 'daily', invalidQuestHasClaimable)]
                                        });
                                        break;
                                    }
                                    
                                    const questToReroll = questList[questIndex];
                                    const rerollResult = await QuestPoolService.rerollQuest(userId, questToReroll.id, rerollType);
                                    
                                    if (!rerollResult.success) {
                                        const errorMessages = {
                                            'REROLL_LIMIT_REACHED': 'You have reached the maximum rerolls for this period.',
                                            'NO_QUESTS_FOUND': 'No quests found to reroll.',
                                            'QUEST_NOT_FOUND': 'Quest not found.',
                                            'QUEST_IN_PROGRESS': 'Cannot reroll a quest that already has progress.',
                                            'NO_ALTERNATIVE_QUESTS': 'No alternative quests available.',
                                            'INSUFFICIENT_GEMS': `Not enough gems! You need ${formatNumber(QUEST_CONFIG.rerollCost)} gems.`
                                        };
                                        
                                        const { hasClaimable: rerollErrorHasClaimable } = await checkClaimableQuests(userId);
                                        await interaction.editReply({
                                            embeds: [new EmbedBuilder()
                                                .setColor(COLORS.ERROR)
                                                .setTitle('❌ Reroll Failed')
                                                .setDescription(errorMessages[rerollResult.reason] || 'An error occurred.')
                                            ],
                                            components: [createBackButton(userId, false, 'daily', rerollErrorHasClaimable)]
                                        });
                                        break;
                                    }
                                    
                                    const successEmbed = new EmbedBuilder()
                                        .setColor(COLORS.SUCCESS)
                                        .setTitle('🎲 Quest Rerolled!')
                                        .setDescription(`Your new quest:\n\n**${rerollResult.newQuest.icon || '📋'} ${rerollResult.newQuest.desc}**\n\nDifficulty: **${rerollResult.newQuest.difficulty?.toUpperCase() || 'NORMAL'}**`)
                                        .addFields({
                                            name: '🎁 Reward',
                                            value: [
                                                rerollResult.newQuest.scaledReward.coins ? `💰 ${formatNumber(rerollResult.newQuest.scaledReward.coins)} Coins` : null,
                                                rerollResult.newQuest.scaledReward.gems ? `💎 ${formatNumber(rerollResult.newQuest.scaledReward.gems)} Gems` : null,
                                                rerollResult.newQuest.scaledReward.tickets ? `🎟️ ${formatNumber(rerollResult.newQuest.scaledReward.tickets)} Tickets` : null
                                            ].filter(Boolean).join('\n') || 'No rewards listed'
                                        })
                                        .setTimestamp();
                                    
                                    const { hasClaimable: rerollSuccessHasClaimable } = await checkClaimableQuests(userId);
                                    await interaction.editReply({
                                        embeds: [successEmbed],
                                        components: [createBackButton(userId, true, rerollType, rerollSuccessHasClaimable)]
                                    });
                                }
                                break;
                            }
                                
                            case 'refresh': {
                                const { hasClaimable: refreshHasClaimable } = await checkClaimableQuests(userId);
                                if (currentView === 'daily') {
                                    const refreshDaily = await buildDailyQuestsEmbed(userId);
                                    await interaction.editReply({ 
                                        embeds: [refreshDaily],
                                        components: [createBackButton(userId, true, 'daily', refreshHasClaimable)]
                                    });
                                } else if (currentView === 'weekly') {
                                    const refreshWeekly = await buildWeeklyQuestsEmbed(userId);
                                    await interaction.editReply({ 
                                        embeds: [refreshWeekly],
                                        components: [createBackButton(userId, true, 'weekly', refreshHasClaimable)]
                                    });
                                } else if (currentView === 'achievements') {
                                    const refreshAch = await buildAchievementsEmbed(userId, achievementPage);
                                    await interaction.editReply({
                                        embeds: [refreshAch.embed],
                                        components: [createAchievementNavButtons(userId, refreshAch.currentPage, refreshAch.totalPages, refreshHasClaimable)]
                                    });
                                } else if (currentView === 'chains') {
                                    const refreshChains = await buildChainQuestsEmbed(userId);
                                    await interaction.editReply({ 
                                        embeds: [refreshChains],
                                        components: [createBackButton(userId, false, 'daily', refreshHasClaimable)]
                                    });
                                } else {
                                    const refreshMain = buildMainMenuEmbed(userId, streak, rerollsUsed);
                                    await interaction.editReply({ embeds: [refreshMain], components: createMainMenuButtons(userId) });
                                }
                                break;
                            }
                        }
                    } catch (error) {
                        console.error('[Quest] Interaction error:', error);
                    }
                });
                
                collector.on('end', async () => {
                    try {
                        const disabledButtons = createMainMenuButtons(userId);
                        disabledButtons.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
                        await sent.edit({ components: disabledButtons }).catch(() => {});
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
        
        // .CLAIM COMMAND
        if (content === '.claim' || content === '.cl') {
            const restriction = checkRestrictions(userId);
            if (restriction.blocked) {
                return message.reply({ embeds: [restriction.embed] });
            }
            
            try {
                await QuestPoolService.initializeUserQuests(userId);
                
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
                                    '• Complete daily quests for rewards',
                                    '• Complete weekly quests for bigger rewards',
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
