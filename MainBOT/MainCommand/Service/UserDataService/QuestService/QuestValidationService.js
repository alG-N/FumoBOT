const { DAILY_QUESTS, WEEKLY_QUESTS, ACHIEVEMENTS } = require('../../../Configuration/questConfig');
const QuestProgressService = require('./QuestProgressService');

class QuestValidationService {
    static validateQuestExists(questId, type = 'daily') {
        const quests = type === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS;
        return quests.some(q => q.id === questId);
    }

    static validateAchievementExists(achievementId) {
        return ACHIEVEMENTS.some(a => a.id === achievementId);
    }

    static async canCompleteQuest(userId, questId, type = 'daily') {
        const progress = type === 'daily'
            ? await QuestProgressService.getDailyProgress(userId)
            : await QuestProgressService.getWeeklyProgress(userId);

        const questProgress = progress[questId];
        if (!questProgress) return false;

        const quest = (type === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS)
            .find(q => q.id === questId);

        return questProgress.progress >= quest.goal;
    }

    static async validateQuestPrerequisites(userId, questId) {
        const quest = [...DAILY_QUESTS, ...WEEKLY_QUESTS].find(q => q.id === questId);
        
        if (!quest || !quest.prerequisites) return true;

        if (quest.prerequisites.level) {
            const userLevel = await this.getUserLevel(userId);
            if (userLevel < quest.prerequisites.level) {
                return false;
            }
        }

        if (quest.prerequisites.rebirth) {
            const userRebirth = await this.getUserRebirth(userId);
            if (userRebirth < quest.prerequisites.rebirth) {
                return false;
            }
        }

        if (quest.prerequisites.achievements) {
            const achievements = await QuestProgressService.getAchievementProgress(userId);
            for (const achId of quest.prerequisites.achievements) {
                if (!achievements[achId] || !achievements[achId].claimed) {
                    return false;
                }
            }
        }

        return true;
    }

    static async validateAchievementUnlock(userId, achievementId) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        
        if (!achievement) return { valid: false, reason: 'NOT_FOUND' };
        
        if (!achievement.prerequisites) return { valid: true };

        if (achievement.prerequisites.level) {
            const userLevel = await this.getUserLevel(userId);
            if (userLevel < achievement.prerequisites.level) {
                return { 
                    valid: false, 
                    reason: 'LEVEL_REQUIRED',
                    required: achievement.prerequisites.level,
                    current: userLevel
                };
            }
        }

        if (achievement.prerequisites.rebirth) {
            const userRebirth = await this.getUserRebirth(userId);
            if (userRebirth < achievement.prerequisites.rebirth) {
                return { 
                    valid: false, 
                    reason: 'REBIRTH_REQUIRED',
                    required: achievement.prerequisites.rebirth,
                    current: userRebirth
                };
            }
        }

        return { valid: true };
    }

    static validateProgressIncrement(currentProgress, increment, goal) {
        const newProgress = currentProgress + increment;
        
        if (newProgress < 0) return { valid: false, reason: 'NEGATIVE_PROGRESS' };
        if (increment < 0) return { valid: false, reason: 'INVALID_INCREMENT' };
        
        return {
            valid: true,
            newProgress: Math.min(newProgress, goal),
            overflow: Math.max(0, newProgress - goal)
        };
    }

    static async getUserLevel(userId) {
        return new Promise((resolve, reject) => {
            const db = require('../../Core/Database/dbSetting');
            db.get(
                `SELECT level FROM userCoins WHERE userId = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.level : 1);
                }
            );
        });
    }

    static async getUserRebirth(userId) {
        return new Promise((resolve, reject) => {
            const db = require('../../Core/Database/dbSetting');
            db.get(
                `SELECT rebirth FROM userCoins WHERE userId = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.rebirth : 0);
                }
            );
        });
    }

    static async getQuestDifficulty(userId, questId) {
        const userLevel = await this.getUserLevel(userId);
        const userRebirth = await this.getUserRebirth(userId);

        const quest = [...DAILY_QUESTS, ...WEEKLY_QUESTS].find(q => q.id === questId);
        if (!quest || !quest.scalable) return 1;

        let multiplier = 1 + (userRebirth * 0.5);
        multiplier += Math.floor(userLevel / 10) * 0.1;

        return Math.max(1, multiplier);
    }

    static async validateReroll(userId, type = 'daily') {
        const db = require('../../Core/Database/dbSetting');
        const date = new Date().toISOString().slice(0, 10);

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT rerolls FROM questRerolls 
                 WHERE userId = ? AND type = ? AND date = ?`,
                [userId, type, date],
                (err, row) => {
                    if (err) return reject(err);
                    const used = row ? row.rerolls : 0;
                    const limit = 3;
                    
                    resolve({
                        valid: used < limit,
                        used,
                        limit,
                        remaining: Math.max(0, limit - used)
                    });
                }
            );
        });
    }

    static isQuestActive(questId, type = 'daily') {
        const quests = type === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS;
        const quest = quests.find(q => q.id === questId);
        
        if (!quest) return false;
        if (!quest.activeTime) return true;

        const now = new Date();
        const currentHour = now.getHours();

        if (quest.activeTime.start < quest.activeTime.end) {
            return currentHour >= quest.activeTime.start && currentHour < quest.activeTime.end;
        } else {
            return currentHour >= quest.activeTime.start || currentHour < quest.activeTime.end;
        }
    }

    static validateBatchClaim(questIds, type = 'daily') {
        if (!Array.isArray(questIds)) {
            return { valid: false, reason: 'INVALID_INPUT' };
        }

        if (questIds.length === 0) {
            return { valid: false, reason: 'EMPTY_LIST' };
        }

        if (questIds.length > 50) {
            return { valid: false, reason: 'TOO_MANY', limit: 50 };
        }

        const quests = type === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS;
        const invalid = questIds.filter(id => !quests.some(q => q.id === id));

        if (invalid.length > 0) {
            return { valid: false, reason: 'INVALID_QUESTS', invalidIds: invalid };
        }

        return { valid: true };
    }
}

module.exports = QuestValidationService;