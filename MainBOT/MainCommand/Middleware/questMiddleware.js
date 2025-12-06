const QuestProgressService = require('../Service/UserDataService/QuestService/QuestProgressService');
const { getCurrentDate } = require('../Ultility/timeUtils');
const { getWeekIdentifier } = require('../Ultility/weekly');

class QuestMiddleware {
    static async trackRoll(userId, increment = 1) {
        try {
            const date = getCurrentDate();
            const week = getWeekIdentifier();
            
            await Promise.all([
                QuestProgressService.updateDailyProgress(userId, 'roll_1000', increment, 1000),
                QuestProgressService.updateWeeklyProgress(userId, 'roll_15000', increment, 15000),
                QuestProgressService.incrementAchievementProgress(userId, 'total_rolls', increment)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track roll for ${userId}:`, error);
        }
    }

    static async trackPray(userId, success = true) {
        if (!success) return;
        
        try {
            const date = getCurrentDate();
            const week = getWeekIdentifier();
            
            await Promise.all([
                QuestProgressService.updateDailyProgress(userId, 'pray_5', 1, 5),
                QuestProgressService.updateWeeklyProgress(userId, 'pray_success_25', 1, 25),
                QuestProgressService.incrementAchievementProgress(userId, 'total_prays', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track pray for ${userId}:`, error);
        }
    }

    static async trackGamble(userId) {
        try {
            const date = getCurrentDate();
            const week = getWeekIdentifier();
            
            await Promise.all([
                QuestProgressService.updateDailyProgress(userId, 'gamble_10', 1, 10),
                QuestProgressService.updateWeeklyProgress(userId, 'gamble_25', 1, 25)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track gamble for ${userId}:`, error);
        }
    }

    static async trackCraft(userId) {
        try {
            const date = getCurrentDate();
            const week = getWeekIdentifier();
            
            await Promise.all([
                QuestProgressService.updateDailyProgress(userId, 'craft_1', 1, 1),
                QuestProgressService.updateWeeklyProgress(userId, 'craft_15', 1, 15)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track craft for ${userId}:`, error);
        }
    }

    static async trackShiny(userId) {
        try {
            const week = getWeekIdentifier();
            await QuestProgressService.updateWeeklyProgress(userId, 'shiny_25', 1, 25);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track shiny for ${userId}:`, error);
        }
    }

    static async trackAstralPlus(userId) {
        try {
            const week = getWeekIdentifier();
            await QuestProgressService.updateWeeklyProgress(userId, 'astral_plus', 1, 1);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track astral+ for ${userId}:`, error);
        }
    }

    static async trackPassiveCoins(userId, amount) {
        try {
            const date = getCurrentDate();
            await QuestProgressService.updateDailyProgress(userId, 'coins_1m', amount, 1_000_000);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track passive coins for ${userId}:`, error);
        }
    }

    static async batchTrackRolls(userId, count) {
        try {
            await this.trackRoll(userId, count);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to batch track rolls for ${userId}:`, error);
        }
    }

    static async trackFumoObtained(userId, rarity) {
        try {
            const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
            if (astralPlus.includes(rarity)) {
                await this.trackAstralPlus(userId);
            }
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track fumo obtained for ${userId}:`, error);
        }
    }
}

module.exports = QuestMiddleware;