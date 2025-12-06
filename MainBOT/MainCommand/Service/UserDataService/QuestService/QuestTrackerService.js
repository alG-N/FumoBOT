const db = require('../../../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
const QuestProgressService = require('./QuestProgressService');

class QuestTrackerService {
    static async trackQuestHistory(userId, questId, type, completed) {
        const timestamp = Date.now();
        const date = new Date().toISOString().slice(0, 10);

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO questHistory (userId, questId, type, completed, timestamp, date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [userId, questId, type, completed ? 1 : 0, timestamp, date],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async getQuestHistory(userId, limit = 50) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, type, completed, timestamp, date 
                 FROM questHistory
                 WHERE userId = ?
                 ORDER BY timestamp DESC
                 LIMIT ?`,
                [userId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    static async getQuestStatistics(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    type,
                    COUNT(*) as total,
                    SUM(completed) as completed,
                    AVG(completed) as completionRate
                 FROM questHistory
                 WHERE userId = ?
                 GROUP BY type`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    const stats = {
                        daily: { total: 0, completed: 0, completionRate: 0 },
                        weekly: { total: 0, completed: 0, completionRate: 0 }
                    };

                    rows.forEach(row => {
                        stats[row.type] = {
                            total: row.total,
                            completed: row.completed,
                            completionRate: (row.completionRate * 100).toFixed(1)
                        };
                    });

                    resolve(stats);
                }
            );
        });
    }

    static async getQuestStreak(userId, type = 'daily') {
        const dates = [];
        let currentDate = new Date();
        
        for (let i = 0; i < 365; i++) {
            dates.push(currentDate.toISOString().slice(0, 10));
            currentDate.setDate(currentDate.getDate() - 1);
        }

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT DISTINCT date FROM questHistory
                 WHERE userId = ? AND type = ? AND completed = 1
                 ORDER BY date DESC`,
                [userId, type],
                (err, rows) => {
                    if (err) return reject(err);
                    
                    const completedDates = new Set(rows.map(r => r.date));
                    let streak = 0;

                    for (const date of dates) {
                        if (completedDates.has(date)) {
                            streak++;
                        } else {
                            break;
                        }
                    }

                    resolve({
                        currentStreak: streak,
                        longestStreak: this.calculateLongestStreak(rows.map(r => r.date))
                    });
                }
            );
        });
    }

    static calculateLongestStreak(dates) {
        if (dates.length === 0) return 0;

        dates.sort((a, b) => new Date(b) - new Date(a));
        
        let longest = 1;
        let current = 1;

        for (let i = 1; i < dates.length; i++) {
            const prevDate = new Date(dates[i - 1]);
            const currDate = new Date(dates[i]);
            const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);

            if (diffDays === 1) {
                current++;
                longest = Math.max(longest, current);
            } else if (diffDays > 1) {
                current = 1;
            }
        }

        return longest;
    }

    static async getFastestCompletions(userId, questId, limit = 10) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT timestamp, date 
                 FROM questHistory
                 WHERE userId = ? AND questId = ? AND completed = 1
                 ORDER BY timestamp ASC
                 LIMIT ?`,
                [userId, questId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    static async getQuestCompletionTrend(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().slice(0, 10);

        return new Promise((resolve, reject) => {
            db.all(
                `SELECT date, COUNT(*) as completed
                 FROM questHistory
                 WHERE userId = ? AND completed = 1 AND date >= ?
                 GROUP BY date
                 ORDER BY date ASC`,
                [userId, startDateStr],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    static async getPinnedQuests(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, type, pinnedAt 
                 FROM questFavorites
                 WHERE userId = ?
                 ORDER BY pinnedAt DESC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    static async pinQuest(userId, questId, type) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO questFavorites (userId, questId, type, pinnedAt)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(userId, questId) DO UPDATE SET pinnedAt = ?`,
                [userId, questId, type, Date.now(), Date.now()],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async unpinQuest(userId, questId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM questFavorites WHERE userId = ? AND questId = ?`,
                [userId, questId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async getQuestCompletionRate(userId, questId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as attempts,
                    SUM(completed) as completions
                 FROM questHistory
                 WHERE userId = ? AND questId = ?`,
                [userId, questId],
                (err, row) => {
                    if (err) return reject(err);
                    
                    const attempts = row.attempts || 0;
                    const completions = row.completions || 0;
                    const rate = attempts > 0 ? (completions / attempts * 100).toFixed(1) : 0;

                    resolve({
                        attempts,
                        completions,
                        rate
                    });
                }
            );
        });
    }

    static async getLifetimeQuestStats(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
                    COUNT(*) as totalQuests,
                    SUM(completed) as totalCompleted,
                    COUNT(DISTINCT date) as activeDays
                 FROM questHistory
                 WHERE userId = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve({
                        totalQuests: row.totalQuests || 0,
                        totalCompleted: row.totalCompleted || 0,
                        activeDays: row.activeDays || 0,
                        averagePerDay: row.activeDays > 0 
                            ? (row.totalCompleted / row.activeDays).toFixed(1) 
                            : 0
                    });
                }
            );
        });
    }

    static async getNearCompletionQuests(userId, threshold = 0.9) {
        const dailyProgress = await QuestProgressService.getDailyProgress(userId);
        const weeklyProgress = await QuestProgressService.getWeeklyProgress(userId);

        const near = [];

        Object.entries(dailyProgress).forEach(([questId, data]) => {
            if (!data.completed && data.progress > 0) {
                const quest = require('../../Configuration/questConfig').DAILY_QUESTS
                    .find(q => q.id === questId);
                if (quest && data.progress / quest.goal >= threshold) {
                    near.push({
                        questId,
                        type: 'daily',
                        progress: data.progress,
                        goal: quest.goal,
                        percentage: (data.progress / quest.goal * 100).toFixed(1)
                    });
                }
            }
        });

        Object.entries(weeklyProgress).forEach(([questId, data]) => {
            if (!data.completed && data.progress > 0) {
                const quest = require('../../Configuration/questConfig').WEEKLY_QUESTS
                    .find(q => q.id === questId);
                if (quest && data.progress / quest.goal >= threshold) {
                    near.push({
                        questId,
                        type: 'weekly',
                        progress: data.progress,
                        goal: quest.goal,
                        percentage: (data.progress / quest.goal * 100).toFixed(1)
                    });
                }
            }
        });

        return near;
    }
}

module.exports = QuestTrackerService;