const db = require('../../Core/Database/dbSetting');
const { ACHIEVEMENTS, ACHIEVEMENT_TIERS } = require('../../Configuration/achievementConfig');
const QuestProgressService = require('./QuestProgressService');

class AchievementService {
    static async checkAchievementUnlock(userId, achievementId) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return null;

        const progress = await QuestProgressService.getAchievementProgress(userId, achievementId);
        
        if (progress.progress >= achievement.threshold && !progress.claimed) {
            return {
                unlocked: true,
                achievement,
                canClaim: true
            };
        }

        return {
            unlocked: false,
            progress: progress.progress,
            threshold: achievement.threshold
        };
    }

    static async getAchievementsByTier(userId, tier) {
        const tierAchievements = ACHIEVEMENTS.filter(a => a.tier === tier);
        const progress = await QuestProgressService.getAchievementProgress(userId);

        return tierAchievements.map(achievement => ({
            ...achievement,
            progress: progress[achievement.id]?.progress || 0,
            claimed: progress[achievement.id]?.claimed || 0,
            completed: progress[achievement.id]?.progress >= achievement.threshold
        }));
    }

    static async getUnlockedAchievements(userId) {
        const progress = await QuestProgressService.getAchievementProgress(userId);
        
        return ACHIEVEMENTS.filter(achievement => {
            const achProgress = progress[achievement.id];
            return achProgress && achProgress.progress >= achievement.threshold;
        });
    }

    static async getAchievementCompletion(userId) {
        const progress = await QuestProgressService.getAchievementProgress(userId);
        
        let completed = 0;
        let total = ACHIEVEMENTS.length;
        let claimed = 0;

        ACHIEVEMENTS.forEach(achievement => {
            const achProgress = progress[achievement.id];
            if (achProgress) {
                if (achProgress.progress >= achievement.threshold) {
                    completed++;
                }
                if (achProgress.claimed > 0) {
                    claimed++;
                }
            }
        });

        return {
            completed,
            total,
            claimed,
            percentage: total > 0 ? ((completed / total) * 100).toFixed(1) : 0
        };
    }

    static async getAchievementsByCategory(userId, category) {
        const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category);
        const progress = await QuestProgressService.getAchievementProgress(userId);

        return categoryAchievements.map(achievement => ({
            ...achievement,
            progress: progress[achievement.id]?.progress || 0,
            claimed: progress[achievement.id]?.claimed || 0,
            percentage: ((progress[achievement.id]?.progress || 0) / achievement.threshold * 100).toFixed(1)
        }));
    }

    static async trackMilestone(userId, achievementId, value) {
        await QuestProgressService.updateAchievementProgress(userId, achievementId, value);
        
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (achievement && value >= achievement.threshold) {
            await this.notifyAchievementUnlock(userId, achievement);
        }
    }

    static async notifyAchievementUnlock(userId, achievement) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementNotifications (userId, achievementId, unlocked, notified)
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(userId, achievementId) DO NOTHING`,
                [userId, achievement.id, Date.now()],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async getRecentAchievements(userId, limit = 5) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT n.achievementId, n.unlocked 
                 FROM achievementNotifications n
                 WHERE n.userId = ?
                 ORDER BY n.unlocked DESC
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    const achievements = rows.map(row => {
                        const achievement = ACHIEVEMENTS.find(a => a.id === row.achievementId);
                        return {
                            ...achievement,
                            unlockedAt: row.unlocked
                        };
                    });
                    
                    resolve(achievements);
                }
            );
        });
    }

    static async getAchievementRarity(achievementId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as holders FROM achievementProgress
                 WHERE achievementId = ? AND claimed > 0`,
                [achievementId],
                (err, row) => {
                    if (err) return reject(err);
                    
                    db.get(
                        `SELECT COUNT(DISTINCT userId) as total FROM achievementProgress`,
                        [],
                        (err2, totalRow) => {
                            if (err2) return reject(err2);
                            
                            const holders = row.holders || 0;
                            const total = totalRow.total || 1;
                            const percentage = (holders / total * 100).toFixed(2);
                            
                            let rarity = 'Common';
                            if (percentage < 1) rarity = 'Legendary';
                            else if (percentage < 5) rarity = 'Epic';
                            else if (percentage < 15) rarity = 'Rare';
                            else if (percentage < 40) rarity = 'Uncommon';
                            
                            resolve({
                                holders,
                                total,
                                percentage,
                                rarity
                            });
                        }
                    );
                }
            );
        });
    }

    static async getHiddenAchievements(userId) {
        const hiddenAchievements = ACHIEVEMENTS.filter(a => a.hidden);
        const progress = await QuestProgressService.getAchievementProgress(userId);

        return hiddenAchievements.map(achievement => {
            const achProgress = progress[achievement.id];
            const unlocked = achProgress && achProgress.progress >= achievement.threshold;

            return {
                id: achievement.id,
                name: unlocked ? achievement.name : '???',
                description: unlocked ? achievement.description : 'Hidden achievement - complete to reveal',
                icon: unlocked ? achievement.icon : '🔒',
                unlocked,
                progress: achProgress?.progress || 0
            };
        });
    }

    static async getAchievementLeaderboard(achievementId, limit = 10) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT userId, progress, claimed 
                 FROM achievementProgress
                 WHERE achievementId = ?
                 ORDER BY progress DESC, claimed ASC
                 LIMIT ?`,
                [achievementId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    static async getTotalAchievementPoints(userId) {
        const progress = await QuestProgressService.getAchievementProgress(userId);
        let totalPoints = 0;

        ACHIEVEMENTS.forEach(achievement => {
            const achProgress = progress[achievement.id];
            if (achProgress && achProgress.progress >= achievement.threshold) {
                totalPoints += achievement.points || 10;
            }
        });

        return totalPoints;
    }

    static async getNextMilestone(userId, achievementId) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) return null;

        const progress = await QuestProgressService.getAchievementProgress(userId, achievementId);
        const currentMilestone = Math.floor(progress.progress / achievement.unit);
        const nextMilestone = (currentMilestone + 1) * achievement.unit;

        return {
            current: progress.progress,
            next: nextMilestone,
            remaining: nextMilestone - progress.progress,
            milestoneNumber: currentMilestone + 1
        };
    }
}

module.exports = AchievementService;