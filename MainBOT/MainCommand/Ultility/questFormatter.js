const { formatNumber } = require('./formatting');

function formatQuestProgress(progress, goal) {
    const percentage = Math.min(100, (progress / goal) * 100).toFixed(1);
    return `${formatNumber(progress)} / ${formatNumber(goal)} (${percentage}%)`;
}

function formatProgressBar(current, max, length = 10) {
    const filled = Math.floor((current / max) * length);
    const empty = length - filled;
    const percentage = Math.min(100, (current / max) * 100).toFixed(0);
    
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}

function formatQuestList(quests, progressMap) {
    return quests.map(quest => {
        const progress = progressMap[quest.id] || { progress: 0, completed: false };
        const status = progress.completed ? '✅' : progress.progress > 0 ? '🔄' : '⚪';
        const progressText = formatQuestProgress(progress.progress, quest.goal);
        
        return `${status} **${quest.desc}**\n   ${progressText}`;
    }).join('\n\n');
}

function formatQuestCategory(category, quests) {
    const categoryInfo = require('../Configuration/questConfig').QUEST_CATEGORIES[category];
    const questList = quests.map(q => `• ${q.desc}`).join('\n');
    
    return `${categoryInfo.icon} **${categoryInfo.name}**\n${categoryInfo.description}\n\n${questList}`;
}

function formatRewardsSummary(rewards) {
    const lines = [];
    
    if (rewards.coins > 0) {
        lines.push(`💰 **Coins:** ${formatNumber(rewards.coins)}`);
    }
    
    if (rewards.gems > 0) {
        lines.push(`💎 **Gems:** ${formatNumber(rewards.gems)}`);
    }
    
    if (rewards.items && rewards.items.length > 0) {
        lines.push('\n**Items:**');
        rewards.items.forEach(item => {
            const quantity = item.quantity || 1;
            lines.push(`• ${item.name} x${quantity}`);
        });
    }
    
    if (rewards.bonusTriggered) {
        lines.push('\n🎁 **Bonus activated!**');
    }
    
    if (rewards.multipliers) {
        lines.push('\n**Multipliers:**');
        if (rewards.multipliers.level > 1) {
            lines.push(`• Level: x${rewards.multipliers.level.toFixed(2)}`);
        }
        if (rewards.multipliers.rebirth > 1) {
            lines.push(`• Rebirth: x${rewards.multipliers.rebirth.toFixed(2)}`);
        }
        if (rewards.multipliers.streak > 1) {
            lines.push(`• Streak: x${rewards.multipliers.streak.toFixed(2)}`);
        }
        if (rewards.multipliers.total > 1) {
            lines.push(`• **Total: x${rewards.multipliers.total.toFixed(2)}**`);
        }
    }
    
    return lines.join('\n');
}

function formatAchievementProgress(achievement, progress) {
    const percentage = Math.min(100, (progress / achievement.threshold) * 100).toFixed(1);
    const bar = formatProgressBar(progress, achievement.threshold, 15);
    
    return {
        name: `${achievement.icon} ${achievement.name}`,
        description: achievement.description,
        progress: formatNumber(progress),
        threshold: formatNumber(achievement.threshold),
        percentage,
        bar,
        completed: progress >= achievement.threshold
    };
}

function formatTimeRemaining(milliseconds) {
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

function formatQuestStatus(quest, progress) {
    const status = [];
    
    if (progress.completed) {
        status.push('✅ Completed');
    } else {
        const percentage = (progress.progress / quest.goal * 100).toFixed(1);
        status.push(`🔄 In Progress (${percentage}%)`);
    }
    
    if (quest.prerequisites) {
        status.push('\n📋 **Requirements:**');
        if (quest.prerequisites.level) {
            status.push(`• Level ${quest.prerequisites.level}+`);
        }
        if (quest.prerequisites.rebirth) {
            status.push(`• Rebirth ${quest.prerequisites.rebirth}+`);
        }
    }
    
    return status.join('\n');
}

function formatStreak(streak, type = 'daily') {
    const streakBonuses = require('../Configuration/rewardConfig').STREAK_BONUSES;
    const milestones = Object.keys(streakBonuses).map(Number).sort((a, b) => a - b);
    
    let nextMilestone = milestones.find(m => m > streak);
    if (!nextMilestone) nextMilestone = milestones[milestones.length - 1];
    
    const currentBonus = streakBonuses[milestones.reverse().find(m => streak >= m)];
    const nextBonus = streakBonuses[nextMilestone];
    
    const lines = [
        `🔥 **Current Streak:** ${streak} ${type}`,
        currentBonus ? `💪 **Bonus:** ${currentBonus.bonus} (x${currentBonus.multiplier})` : '📈 Keep going!',
    ];
    
    if (nextBonus && streak < nextMilestone) {
        lines.push(`🎯 **Next Milestone:** ${nextMilestone} ${type} (x${nextBonus.multiplier})`);
        lines.push(`📊 **Progress:** ${streak} / ${nextMilestone}`);
    }
    
    return lines.join('\n');
}

function formatLeaderboardEntry(rank, username, value, showMedal = true) {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    const medal = showMedal && medals[rank] ? medals[rank] : `#${rank}`;
    
    return `${medal} **${username}** - ${formatNumber(value)}`;
}

function formatQuestCompletion(completed, total) {
    const percentage = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
    const bar = formatProgressBar(completed, total, 10);
    
    return `${bar}\n${completed} / ${total} quests (${percentage}%)`;
}

function formatAchievementTier(tier) {
    const tiers = require('../Configuration/unifiedAchievementConfig').ACHIEVEMENT_TIERS;
    const tierInfo = tiers[tier];
    
    return `${tierInfo.icon} ${tierInfo.name} (x${tierInfo.multiplier})`;
}

function formatQuestChain(chain, completedQuests) {
    const totalQuests = chain.quests.length;
    const completed = chain.quests.filter(qId => completedQuests.includes(qId)).length;
    const percentage = (completed / totalQuests * 100).toFixed(0);
    
    const questStatus = chain.quests.map(qId => {
        const isCompleted = completedQuests.includes(qId);
        return `${isCompleted ? '✅' : '⚪'} ${qId}`;
    }).join('\n');
    
    return {
        name: `${chain.icon} ${chain.name}`,
        progress: `${completed} / ${totalQuests} (${percentage}%)`,
        quests: questStatus,
        completed: completed === totalQuests
    };
}

module.exports = {
    formatQuestProgress,
    formatProgressBar,
    formatQuestList,
    formatQuestCategory,
    formatRewardsSummary,
    formatAchievementProgress,
    formatTimeRemaining,
    formatQuestStatus,
    formatStreak,
    formatLeaderboardEntry,
    formatQuestCompletion,
    formatAchievementTier,
    formatQuestChain
};