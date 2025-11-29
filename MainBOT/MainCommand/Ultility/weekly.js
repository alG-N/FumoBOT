const db = require('../Core/Database/db');

function getWeekIdentifier() {
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
    const pastDaysOfYear = (now - firstDayOfYear) / 86400000;
    return `${now.getFullYear()}-W${Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)}`;
}

function incrementDailyGamble(userId) {
    db.run(`
        INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
        VALUES (?, 'gamble_10', 1, 0, DATE('now'))
        ON CONFLICT(userId, questId, date) DO UPDATE SET 
        progress = MIN(dailyQuestProgress.progress + 1, 10),
        completed = CASE 
            WHEN dailyQuestProgress.progress + 1 >= 10 THEN 1 
            ELSE dailyQuestProgress.completed 
        END
    `, [userId], function (err) {
        if (err) {
            // console.error(`[DailyGamble] Failed to update daily quest for ${userId}:`, err.message);
        }
    });

    const weekKey = getWeekIdentifier();
    db.run(`
        INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
        VALUES (?, 'gamble_25', 1, 0, ?)
        ON CONFLICT(userId, questId, week) DO UPDATE SET 
        progress = MIN(weeklyQuestProgress.progress + 1, 25),
        completed = CASE 
            WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1 
            ELSE weeklyQuestProgress.completed 
        END
    `, [userId, weekKey], function (err) {
        if (err) {
            // console.error(`[DailyGamble] Failed to update weekly quest for ${userId}:`, err.message);
        }
    });
}

function incrementDailyCraft(userId) {
    db.run(`
        INSERT INTO dailyQuestProgress (userId, questId, progress, completed, date)
        VALUES (?, 'craft_1', 1, 0, DATE('now'))
        ON CONFLICT(userId, questId, date) DO UPDATE SET 
            progress = MIN(dailyQuestProgress.progress + 1, 1),
            completed = CASE 
                WHEN dailyQuestProgress.progress + 1 >= 1 THEN 1
                ELSE dailyQuestProgress.completed
            END
    `, [userId]);

    const weekKey = getWeekIdentifier();
    db.run(`
        INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
        VALUES (?, 'craft_15', 1, 0, ?)
        ON CONFLICT(userId, questId, week) DO UPDATE SET 
            progress = MIN(weeklyQuestProgress.progress + 1, 15),
            completed = CASE 
                WHEN weeklyQuestProgress.progress + 1 >= 15 THEN 1
                ELSE weeklyQuestProgress.completed
            END
    `, [userId, weekKey]);
}

function incrementWeeklyShiny(userId) {
    const weekKey = getWeekIdentifier();
    db.run(`
        INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
        VALUES (?, 'shiny_25', 1, 0, ?)
        ON CONFLICT(userId, questId, week) DO UPDATE SET 
            progress = MIN(weeklyQuestProgress.progress + 1, 25),
            completed = CASE 
                WHEN weeklyQuestProgress.progress + 1 >= 25 THEN 1
                ELSE weeklyQuestProgress.completed
            END
    `, [userId, weekKey]);
}

function incrementWeeklyAstral(userId) {
    const weekKey = getWeekIdentifier();
    db.run(`
        UPDATE weeklyQuestProgress
        SET 
            progress = MIN(progress + 1, 1),
            completed = CASE 
                WHEN MIN(progress + 1, 1) >= 1 THEN 1
                ELSE completed
            END
        WHERE userId = ? AND questId = 'astral_plus' AND week = ?
    `, [userId, weekKey], function (err) {
        if (err) {
            db.run(`
                INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                VALUES (?, 'astral_plus', 1, 1, ?)
            `, [userId, weekKey]);
        } else if (this.changes === 0) {
            db.run(`
                INSERT INTO weeklyQuestProgress (userId, questId, progress, completed, week)
                VALUES (?, 'astral_plus', 1, 1, ?)
            `, [userId, weekKey]);
        }
    });
}

module.exports = { getWeekIdentifier, incrementDailyGamble, incrementDailyCraft, incrementWeeklyShiny, incrementWeeklyAstral };