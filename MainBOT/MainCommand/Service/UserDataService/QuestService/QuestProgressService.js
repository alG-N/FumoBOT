const db = require('../../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../../Ultility/timeUtils');

class QuestProgressService {
    static async updateDailyProgress(userId, questId, increment = 1, goal) {
        const date = new Date().toISOString().slice(0, 10);
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
                 VALUES (?, ?, ?, ?, 0)
                 ON CONFLICT(userId, questId, date) DO UPDATE SET
                     progress = MIN(dailyQuestProgress.progress + ?, ?),
                     completed = CASE 
                         WHEN dailyQuestProgress.progress + ? >= ? THEN 1
                         ELSE dailyQuestProgress.completed
                     END`,
                [userId, questId, date, increment, increment, goal, increment, goal],
                function(err) {
                    if (err) return reject(err);
                    resolve({ 
                        changes: this.changes,
                        progress: Math.min((this.lastID || 0) + increment, goal),
                        completed: Math.min((this.lastID || 0) + increment, goal) >= goal
                    });
                }
            );
        });
    }

    static async updateWeeklyProgress(userId, questId, increment = 1, goal) {
        const week = getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO weeklyQuestProgress (userId, questId, week, progress, completed)
                 VALUES (?, ?, ?, ?, 0)
                 ON CONFLICT(userId, questId, week) DO UPDATE SET
                     progress = MIN(weeklyQuestProgress.progress + ?, ?),
                     completed = CASE 
                         WHEN weeklyQuestProgress.progress + ? >= ? THEN 1
                         ELSE weeklyQuestProgress.completed
                     END`,
                [userId, questId, week, increment, increment, goal, increment, goal],
                function(err) {
                    if (err) return reject(err);
                    resolve({ 
                        changes: this.changes,
                        progress: Math.min((this.lastID || 0) + increment, goal),
                        completed: Math.min((this.lastID || 0) + increment, goal) >= goal
                    });
                }
            );
        });
    }

    static async updateAchievementProgress(userId, achievementId, progress) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(userId, achievementId) DO UPDATE SET
                     progress = MAX(achievementProgress.progress, ?)`,
                [userId, achievementId, progress, progress],
                function(err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes, progress });
                }
            );
        });
    }

    static async incrementAchievementProgress(userId, achievementId, increment = 1) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(userId, achievementId) DO UPDATE SET
                     progress = achievementProgress.progress + ?`,
                [userId, achievementId, increment, increment],
                function(err) {
                    if (err) return reject(err);
                    resolve({ changes: this.changes });
                }
            );
        });
    }

    static async getDailyProgress(userId, date = null) {
        const targetDate = date || new Date().toISOString().slice(0, 10);
        
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, progress, completed FROM dailyQuestProgress
                 WHERE userId = ? AND date = ?`,
                [userId, targetDate],
                (err, rows) => {
                    if (err) return reject(err);
                    const progressMap = {};
                    rows.forEach(row => {
                        progressMap[row.questId] = {
                            progress: row.progress,
                            completed: row.completed === 1
                        };
                    });
                    resolve(progressMap);
                }
            );
        });
    }

    static async getWeeklyProgress(userId, week = null) {
        const targetWeek = week || getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, progress, completed FROM weeklyQuestProgress
                 WHERE userId = ? AND week = ?`,
                [userId, targetWeek],
                (err, rows) => {
                    if (err) return reject(err);
                    const progressMap = {};
                    rows.forEach(row => {
                        progressMap[row.questId] = {
                            progress: row.progress,
                            completed: row.completed === 1
                        };
                    });
                    resolve(progressMap);
                }
            );
        });
    }

    static async getAchievementProgress(userId, achievementId = null) {
        return new Promise((resolve, reject) => {
            const query = achievementId
                ? `SELECT achievementId, progress, claimed FROM achievementProgress 
                   WHERE userId = ? AND achievementId = ?`
                : `SELECT achievementId, progress, claimed FROM achievementProgress 
                   WHERE userId = ?`;
            
            const params = achievementId ? [userId, achievementId] : [userId];
            
            db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                
                if (achievementId) {
                    resolve(rows[0] || { progress: 0, claimed: 0 });
                } else {
                    const progressMap = {};
                    rows.forEach(row => {
                        progressMap[row.achievementId] = {
                            progress: row.progress,
                            claimed: row.claimed
                        };
                    });
                    resolve(progressMap);
                }
            });
        });
    }

    static async getCompletedQuests(userId, type = 'daily') {
        const table = type === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
        const timeField = type === 'daily' ? 'date' : 'week';
        const timeValue = type === 'daily' 
            ? new Date().toISOString().slice(0, 10)
            : getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId FROM ${table}
                 WHERE userId = ? AND ${timeField} = ? AND completed = 1`,
                [userId, timeValue],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows.map(r => r.questId));
                }
            );
        });
    }

    static async checkQuestCompletion(userId, questId, type = 'daily') {
        const table = type === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
        const timeField = type === 'daily' ? 'date' : 'week';
        const timeValue = type === 'daily' 
            ? new Date().toISOString().slice(0, 10)
            : getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT completed FROM ${table}
                 WHERE userId = ? AND questId = ? AND ${timeField} = ?`,
                [userId, questId, timeValue],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row ? row.completed === 1 : false);
                }
            );
        });
    }

    static async trackRoll(userId, increment = 1) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        
        await this.updateDailyProgress(userId, 'roll_1000', increment, 1000);
        await this.updateWeeklyProgress(userId, 'roll_15000', increment, 15000);
        await this.incrementAchievementProgress(userId, 'total_rolls', increment);
    }

    static async trackPray(userId, success = true) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        
        if (success) {
            await this.updateDailyProgress(userId, 'pray_5', 1, 5);
            await this.updateWeeklyProgress(userId, 'pray_success_25', 1, 25);
            await this.incrementAchievementProgress(userId, 'total_prays', 1);
        }
    }

    static async trackGamble(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        
        await this.updateDailyProgress(userId, 'gamble_10', 1, 10);
        await this.updateWeeklyProgress(userId, 'gamble_25', 1, 25);
    }

    static async trackCraft(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        
        await this.updateDailyProgress(userId, 'craft_1', 1, 1);
        await this.updateWeeklyProgress(userId, 'craft_15', 1, 15);
    }

    static async trackShiny(userId) {
        const week = getWeekIdentifier();
        await this.updateWeeklyProgress(userId, 'shiny_25', 1, 25);
    }

    static async trackAstralPlus(userId) {
        const week = getWeekIdentifier();
        await this.updateWeeklyProgress(userId, 'astral_plus', 1, 1);
    }

    static async trackPassiveCoins(userId, amount) {
        const date = new Date().toISOString().slice(0, 10);
        await this.updateDailyProgress(userId, 'coins_1m', amount, 1_000_000);
    }

    static async resetExpiredDaily(userId) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM dailyQuestProgress WHERE userId = ? AND date < ?`,
                [userId, yesterday],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async resetExpiredWeekly(userId) {
        const currentWeek = getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM weeklyQuestProgress WHERE userId = ? AND week != ?`,
                [userId, currentWeek],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }
}

module.exports = QuestProgressService;