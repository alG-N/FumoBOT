const { EmbedBuilder } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');

class QuestNotificationService {
    static async sendQuestCompleted(channel, userId, questName, rewards) {
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Quest Completed!')
            .setDescription(`**${questName}** has been completed!`)
            .addFields(
                {
                    name: '💰 Rewards',
                    value: this.formatRewards(rewards),
                    inline: false
                }
            )
            .setFooter({ text: 'Use .claim to collect your rewards!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send quest completion notification:', error);
        }
    }

    static async sendAchievementUnlocked(channel, userId, achievement) {
        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Achievement Unlocked!')
            .setDescription(`**${achievement.name}**\n${achievement.description}`)
            .addFields(
                {
                    name: '🎁 Rewards',
                    value: this.formatAchievementRewards(achievement),
                    inline: false
                }
            )
            .setFooter({ text: 'Use .claim to collect your achievement rewards!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send achievement notification:', error);
        }
    }

    static async sendNearCompletion(channel, userId, quests) {
        if (quests.length === 0) return;

        const questList = quests.map(q => 
            `• **${q.questId}** - ${q.percentage}% complete`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#F39C12')
            .setTitle('📊 Quests Near Completion')
            .setDescription(`You're almost there! Complete these quests:\n\n${questList}`)
            .setFooter({ text: 'Keep going!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send near completion notification:', error);
        }
    }

    static async sendResetReminder(channel, userId, type = 'daily') {
        const timeLeft = type === 'daily' 
            ? this.getTimeUntilDailyReset()
            : this.getTimeUntilWeeklyReset();

        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`⏰ ${type === 'daily' ? 'Daily' : 'Weekly'} Quest Reset Soon!`)
            .setDescription(
                `Your ${type} quests will reset in **${timeLeft}**!\n\n` +
                `Make sure to complete and claim any pending rewards before they reset.`
            )
            .setFooter({ text: 'Don\'t lose your progress!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send reset reminder:', error);
        }
    }

    static async sendStreakMilestone(channel, userId, streak, type = 'daily') {
        const embed = new EmbedBuilder()
            .setColor('#9B59B6')
            .setTitle('🔥 Streak Milestone!')
            .setDescription(
                `Congratulations! You've maintained a **${streak}-${type}** quest completion streak!\n\n` +
                `Keep up the excellent work to unlock even better rewards!`
            )
            .setFooter({ text: 'Consistency is key!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send streak milestone notification:', error);
        }
    }

    static async sendWeeklySummary(channel, userId, summary) {
        const embed = new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('📊 Weekly Quest Summary')
            .setDescription('Here\'s your quest performance this week:')
            .addFields(
                {
                    name: '✅ Completed Quests',
                    value: `${summary.completed} / ${summary.total}`,
                    inline: true
                },
                {
                    name: '💰 Coins Earned',
                    value: formatNumber(summary.coinsEarned),
                    inline: true
                },
                {
                    name: '💎 Gems Earned',
                    value: formatNumber(summary.gemsEarned),
                    inline: true
                },
                {
                    name: '🏆 Achievements',
                    value: `${summary.achievementsUnlocked} unlocked`,
                    inline: true
                },
                {
                    name: '🔥 Current Streak',
                    value: `${summary.streak} days`,
                    inline: true
                },
                {
                    name: '📈 Completion Rate',
                    value: `${summary.completionRate}%`,
                    inline: true
                }
            )
            .setFooter({ text: 'Keep up the great work!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send weekly summary:', error);
        }
    }

    static async sendQuestChainCompleted(channel, userId, chainName, bonusRewards) {
        const embed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle('⛓️ Quest Chain Completed!')
            .setDescription(
                `Amazing! You've completed the **${chainName}** quest chain!\n\n` +
                `You've earned bonus rewards for completing the entire chain!`
            )
            .addFields(
                {
                    name: '🎁 Bonus Rewards',
                    value: this.formatRewards(bonusRewards),
                    inline: false
                }
            )
            .setFooter({ text: 'Check .quest for more chains!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send quest chain notification:', error);
        }
    }

    static async sendRerollSuccess(channel, userId, oldQuest, newQuest) {
        const embed = new EmbedBuilder()
            .setColor('#1ABC9C')
            .setTitle('🔄 Quest Rerolled!')
            .setDescription(
                `**Old Quest:** ${oldQuest}\n` +
                `**New Quest:** ${newQuest}\n\n` +
                `Good luck with your new quest!`
            )
            .setFooter({ text: 'You can reroll quests daily' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send reroll notification:', error);
        }
    }

    static formatRewards(rewards) {
        const lines = [];

        if (rewards.coins > 0) {
            lines.push(`💰 ${formatNumber(rewards.coins)} coins`);
        }

        if (rewards.gems > 0) {
            lines.push(`💎 ${formatNumber(rewards.gems)} gems`);
        }

        if (rewards.items && rewards.items.length > 0) {
            rewards.items.forEach(item => {
                lines.push(`📦 ${item.name} x${item.quantity || 1}`);
            });
        }

        return lines.length > 0 ? lines.join('\n') : 'No rewards';
    }

    static formatAchievementRewards(achievement) {
        const lines = [];

        if (achievement.rewards) {
            if (achievement.rewards.coins) {
                lines.push(`💰 ${formatNumber(achievement.rewards.coins)} coins`);
            }
            if (achievement.rewards.gems) {
                lines.push(`💎 ${formatNumber(achievement.rewards.gems)} gems`);
            }
            if (achievement.rewards.items) {
                achievement.rewards.items.forEach(item => {
                    lines.push(`📦 ${item}`);
                });
            }
        }

        return lines.length > 0 ? lines.join('\n') : 'Achievement unlocked!';
    }

    static getTimeUntilDailyReset() {
        const now = new Date();
        const nextReset = new Date();
        nextReset.setUTCHours(24, 0, 0, 0);
        
        const diffMs = nextReset - now;
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        
        return `${hours}h ${minutes}m`;
    }

    static getTimeUntilWeeklyReset() {
        const now = new Date();
        const day = now.getUTCDay();
        const daysUntilMonday = (8 - day) % 7 || 7;
        
        const nextReset = new Date(now);
        nextReset.setUTCDate(now.getUTCDate() + daysUntilMonday);
        nextReset.setUTCHours(0, 0, 0, 0);
        
        const diffMs = nextReset - now;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / 3600000);
        
        return `${days}d ${hours}h`;
    }

    static async sendBatchNotifications(channel, userId, notifications) {
        if (notifications.length === 0) return;

        const embed = new EmbedBuilder()
            .setColor('#95A5A6')
            .setTitle('📬 Quest Notifications')
            .setDescription(notifications.map(n => `• ${n}`).join('\n'))
            .setFooter({ text: 'Stay updated with your progress!' })
            .setTimestamp();

        try {
            await channel.send({ content: `<@${userId}>`, embeds: [embed] });
        } catch (error) {
            console.error('Failed to send batch notifications:', error);
        }
    }
}

module.exports = QuestNotificationService;