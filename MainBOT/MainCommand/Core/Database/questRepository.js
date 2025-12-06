const db = require('../../Core/database');

class QuestRepository {
    static async getDailyProgress(userId, date) {
        return db.all(
            `SELECT questId, progress, completed 
             FROM dailyQuestProgress 
             WHERE userId = ? AND date = ?`,
            [userId, date],
            true
        );
    }

    static async getWeeklyProgress(userId, week) {
        return db.all(
            `SELECT questId, progress, completed 
             FROM weeklyQuestProgress 
             WHERE userId = ? AND week = ?`,
            [userId, week],
            true
        );
    }

    static async getAchievementProgress(userId, achievementId = null) {
        if (achievementId) {
            return db.get(
                `SELECT progress, claimed 
                 FROM achievementProgress 
                 WHERE userId = ? AND achievementId = ?`,
                [userId, achievementId],
                true
            );
        }
        
        return db.all(
            `SELECT achievementId, progress, claimed 
             FROM achievementProgress 
             WHERE userId = ?`,
            [userId],
            true
        );
    }

    static async updateDailyProgress(userId, questId, date, progress, goal) {
        return db.run(
            `INSERT INTO dailyQuestProgress (userId, questId, date, progress, completed)
             VALUES (?, ?, ?, ?, 0)
             ON CONFLICT(userId, questId, date) DO UPDATE SET
                 progress = MIN(dailyQuestProgress.progress + ?, ?),
                 completed = CASE 
                     WHEN dailyQuestProgress.progress + ? >= ? THEN 1
                     ELSE dailyQuestProgress.completed
                 END`,
            [userId, questId, date, progress, progress, goal, progress, goal]
        );
    }

    static async updateWeeklyProgress(userId, questId, week, progress, goal) {
        return db.run(
            `INSERT INTO weeklyQuestProgress (userId, questId, week, progress, completed)
             VALUES (?, ?, ?, ?, 0)
             ON CONFLICT(userId, questId, week) DO UPDATE SET
                 progress = MIN(weeklyQuestProgress.progress + ?, ?),
                 completed = CASE 
                     WHEN weeklyQuestProgress.progress + ? >= ? THEN 1
                     ELSE weeklyQuestProgress.completed
                 END`,
            [userId, questId, week, progress, progress, goal, progress, goal]
        );
    }

    static async updateAchievementProgress(userId, achievementId, progress) {
        return db.run(
            `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
             VALUES (?, ?, ?, 0)
             ON CONFLICT(userId, achievementId) DO UPDATE SET
                 progress = MAX(achievementProgress.progress, ?)`,
            [userId, achievementId, progress, progress]
        );
    }

    static async incrementAchievementProgress(userId, achievementId, increment) {
        return db.run(
            `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
             VALUES (?, ?, ?, 0)
             ON CONFLICT(userId, achievementId) DO UPDATE SET
                 progress = achievementProgress.progress + ?`,
            [userId, achievementId, increment, increment]
        );
    }

    static async markClaimed(userId, claimKey) {
        return db.run(
            `INSERT INTO achievementProgress (userId, achievementId, claimed)
             VALUES (?, ?, 1)
             ON CONFLICT(userId, achievementId) DO UPDATE SET claimed = 1`,
            [userId, claimKey]
        );
    }

    static async checkClaimed(userId, claimKey) {
        const row = await db.get(
            `SELECT claimed FROM achievementProgress 
             WHERE userId = ? AND achievementId = ?`,
            [userId, claimKey],
            true
        );
        return row && row.claimed === 1;
    }

    static async updateAchievementClaimed(userId, achievementId, totalMilestones) {
        return db.run(
            `UPDATE achievementProgress 
             SET claimed = ?
             WHERE userId = ? AND achievementId = ?`,
            [totalMilestones, userId, achievementId]
        );
    }

    static async grantCurrency(userId, coins, gems) {
        return db.run(
            `UPDATE userCoins 
             SET coins = coins + ?, gems = gems + ?
             WHERE userId = ?`,
            [coins, gems, userId]
        );
    }

    static async grantItem(userId, itemName, quantity) {
        return db.run(
            `INSERT INTO userInventory (userId, itemName, quantity)
             VALUES (?, ?, ?)
             ON CONFLICT(userId, itemName) DO UPDATE SET 
                 quantity = quantity + ?`,
            [userId, itemName, quantity, quantity]
        );
    }

    static async getUserStreak(userId) {
        const row = await db.get(
            `SELECT dailyStreak FROM userCoins WHERE userId = ?`,
            [userId],
            true
        );
        return row ? row.dailyStreak : 0;
    }

    static async getWeeklyStreakCount(userId) {
        const rows = await db.all(
            `SELECT achievementId FROM achievementProgress 
             WHERE userId = ? AND achievementId LIKE 'weekly_%' AND claimed = 1`,
            [userId],
            true
        );
        return rows ? rows.length : 0;
    }

    static async cleanExpiredDaily(date) {
        return db.run(
            `DELETE FROM dailyQuestProgress WHERE date < ?`,
            [date]
        );
    }

    static async cleanExpiredWeekly(week) {
        return db.run(
            `DELETE FROM weeklyQuestProgress WHERE week != ?`,
            [week]
        );
    }

    static async getQuestHistory(userId, limit) {
        return db.all(
            `SELECT questId, type, completed, timestamp, date 
             FROM questHistory
             WHERE userId = ?
             ORDER BY timestamp DESC
             LIMIT ?`,
            [userId, limit],
            true
        );
    }

    static async trackQuestCompletion(userId, questId, type, completed) {
        const timestamp = Date.now();
        const date = new Date().toISOString().slice(0, 10);
        
        return db.run(
            `INSERT INTO questHistory (userId, questId, type, completed, timestamp, date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, questId, type, completed ? 1 : 0, timestamp, date]
        );
    }

    static async getCompletionStats(userId) {
        return db.all(
            `SELECT 
                type,
                COUNT(*) as total,
                SUM(completed) as completed
             FROM questHistory
             WHERE userId = ?
             GROUP BY type`,
            [userId],
            true
        );
    }
}

module.exports = QuestRepository;