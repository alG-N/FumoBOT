const db = require('../../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../../Ultility/timeUtils');
const QuestProgressService = require('./QuestProgressService');
const QuestRewardService = require('./QuestRewardService');
const { DAILY_QUESTS, WEEKLY_QUESTS } = require('../../Configuration/questConfig');

class QuestClaimService {
    static async claimDaily(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        const claimKey = `daily_${date}`;

        const alreadyClaimed = await this.checkClaimed(userId, claimKey);
        if (alreadyClaimed) {
            return { success: false, reason: 'ALREADY_CLAIMED' };
        }

        const progress = await QuestProgressService.getDailyProgress(userId);
        const completedCount = Object.values(progress).filter(p => p.completed).length;

        if (completedCount !== DAILY_QUESTS.length) {
            return { 
                success: false, 
                reason: 'INCOMPLETE',
                completed: completedCount,
                total: DAILY_QUESTS.length
            };
        }

        const rewards = await QuestRewardService.getDailyRewards(userId);
        await this.markClaimed(userId, claimKey);
        await this.incrementWeeklyDailiesCompleted(userId, week);

        return {
            success: true,
            rewards,
            type: 'daily'
        };
    }

    static async claimWeekly(userId) {
        const week = getWeekIdentifier();
        const claimKey = `weekly_${week}`;

        const alreadyClaimed = await this.checkClaimed(userId, claimKey);
        if (alreadyClaimed) {
            return { success: false, reason: 'ALREADY_CLAIMED' };
        }

        const progress = await QuestProgressService.getWeeklyProgress(userId);
        const completedCount = Object.values(progress).filter(p => p.completed).length;

        if (completedCount !== WEEKLY_QUESTS.length) {
            return { 
                success: false, 
                reason: 'INCOMPLETE',
                completed: completedCount,
                total: WEEKLY_QUESTS.length
            };
        }

        const rewards = await QuestRewardService.getWeeklyRewards(userId);
        await this.markClaimed(userId, claimKey);
        await this.checkWeeklyStreak(userId);

        return {
            success: true,
            rewards,
            type: 'weekly'
        };
    }

    static async claimAchievements(userId) {
        const achievements = await QuestProgressService.getAchievementProgress(userId);
        const rewards = await QuestRewardService.getAchievementRewards(userId, achievements);

        if (rewards.totalCoins === 0 && rewards.totalGems === 0 && rewards.items.length === 0) {
            return { success: false, reason: 'NO_ACHIEVEMENTS' };
        }

        return {
            success: true,
            rewards,
            type: 'achievement'
        };
    }

    static async claimAll(userId) {
        const results = {
            daily: null,
            weekly: null,
            achievements: null,
            totalCoins: 0,
            totalGems: 0,
            allItems: []
        };

        const dailyResult = await this.claimDaily(userId);
        if (dailyResult.success) {
            results.daily = dailyResult;
            results.totalCoins += dailyResult.rewards.coins;
            results.totalGems += dailyResult.rewards.gems;
            results.allItems.push(...dailyResult.rewards.items);
        }

        const weeklyResult = await this.claimWeekly(userId);
        if (weeklyResult.success) {
            results.weekly = weeklyResult;
            results.totalCoins += weeklyResult.rewards.coins;
            results.totalGems += weeklyResult.rewards.gems;
            results.allItems.push(...weeklyResult.rewards.items);
        }

        const achievementResult = await this.claimAchievements(userId);
        if (achievementResult.success) {
            results.achievements = achievementResult;
            results.totalCoins += achievementResult.rewards.totalCoins;
            results.totalGems += achievementResult.rewards.totalGems;
            results.allItems.push(...achievementResult.rewards.items);
        }

        const claimedSomething = results.daily || results.weekly || results.achievements;

        return {
            success: claimedSomething,
            results,
            nothingToClaim: !claimedSomething
        };
    }

    static async checkClaimed(userId, claimKey) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT claimed FROM achievementProgress 
                 WHERE userId = ? AND achievementId = ?`,
                [userId, claimKey],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row && row.claimed === 1);
                }
            );
        });
    }

    static async markClaimed(userId, claimKey) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementProgress (userId, achievementId, claimed)
                 VALUES (?, ?, 1)
                 ON CONFLICT(userId, achievementId) DO UPDATE SET claimed = 1`,
                [userId, claimKey],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async incrementWeeklyDailiesCompleted(userId, week) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO weeklyQuestProgress (userId, week, questId, progress, completed)
                 VALUES (?, ?, 'complete_dailies', 1, 0)
                 ON CONFLICT(userId, week, questId) DO UPDATE SET 
                     progress = MIN(weeklyQuestProgress.progress + 1, 7),
                     completed = CASE WHEN weeklyQuestProgress.progress + 1 >= 7 THEN 1 
                                 ELSE weeklyQuestProgress.completed END`,
                [userId, week],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async checkWeeklyStreak(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT achievementId FROM achievementProgress 
                 WHERE userId = ? AND achievementId LIKE 'weekly_%' AND claimed = 1`,
                [userId],
                async (err, rows) => {
                    if (err) return reject(err);
                    
                    if (rows && rows.length >= 7) {
                        await QuestRewardService.grantStreakBadge(userId);
                    }
                    
                    resolve(rows ? rows.length : 0);
                }
            );
        });
    }

    static async getClaimableStatus(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();

        const dailyProgress = await QuestProgressService.getDailyProgress(userId);
        const weeklyProgress = await QuestProgressService.getWeeklyProgress(userId);
        const achievements = await QuestProgressService.getAchievementProgress(userId);

        const dailyCompleted = Object.values(dailyProgress).filter(p => p.completed).length;
        const weeklyCompleted = Object.values(weeklyProgress).filter(p => p.completed).length;

        const dailyClaimed = await this.checkClaimed(userId, `daily_${date}`);
        const weeklyClaimed = await this.checkClaimed(userId, `weekly_${week}`);

        const { claimableAchievements } = await QuestRewardService.getClaimableAchievements(userId, achievements);

        return {
            daily: {
                completed: dailyCompleted,
                total: DAILY_QUESTS.length,
                canClaim: dailyCompleted === DAILY_QUESTS.length && !dailyClaimed,
                claimed: dailyClaimed
            },
            weekly: {
                completed: weeklyCompleted,
                total: WEEKLY_QUESTS.length,
                canClaim: weeklyCompleted === WEEKLY_QUESTS.length && !weeklyClaimed,
                claimed: weeklyClaimed
            },
            achievements: {
                claimable: claimableAchievements,
                canClaim: claimableAchievements > 0
            }
        };
    }
}

module.exports = QuestClaimService;