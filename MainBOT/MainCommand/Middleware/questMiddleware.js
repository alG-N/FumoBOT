/**
 * ═══════════════════════════════════════════════════════════════════
 * QUEST MIDDLEWARE v2.0 - Automatic Quest Progress Tracking
 * ═══════════════════════════════════════════════════════════════════
 * 
 * This middleware hooks into various bot actions to track quest progress.
 * Import and call the appropriate method when an action occurs.
 */

const QuestProgressService = require('../Service/UserDataService/QuestService/QuestProgressService');

// Helper to get current date string
function getCurrentDate() {
    return new Date().toISOString().slice(0, 10);
}

// Helper to get week identifier
function getWeekIdentifier() {
    const now = new Date();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((now - yearStart) / 86400000) + yearStart.getUTCDay() + 1) / 7);
    return `${now.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

class QuestMiddleware {
    // ═══════════════════════════════════════════════════════════════════
    // GACHA TRACKING (Rolls)
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackRoll(userId, increment = 1) {
        try {
            await Promise.all([
                // Daily: daily_rolls (100 rolls goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_rolls', increment, 100),
                // Weekly: weekly_rolls (1000 rolls goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_rolls', increment, 1000),
                // Achievement: total rolls
                QuestProgressService.incrementAchievementProgress(userId, 'total_rolls', increment)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track roll for ${userId}:`, error);
        }
    }

    static async batchTrackRolls(userId, count) {
        await this.trackRoll(userId, count);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PRAYER TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackPray(userId, success = true) {
        if (!success) return;
        
        try {
            await Promise.all([
                // Daily: daily_prayers (5 prayers goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_prayers', 1, 5),
                // Weekly: weekly_prayers (35 prayers goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_prayers', 1, 35),
                // Achievement: total prays
                QuestProgressService.incrementAchievementProgress(userId, 'total_prays', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track pray for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // GAMBLING TRACKING (Flip, Slots, Dice Duel)
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackGamble(userId) {
        try {
            await Promise.all([
                // Daily: daily_gambles (10 gambles goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_gambles', 1, 10),
                // Weekly: weekly_gambles (50 gambles goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_gambles', 1, 50),
                // Achievement: total gambles
                QuestProgressService.incrementAchievementProgress(userId, 'total_gambles', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track gamble for ${userId}:`, error);
        }
    }

    static async trackGambleWin(userId, amount = 0) {
        try {
            await Promise.all([
                // Daily: win_gamble (1 win goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_gamble_wins', 1, 3),
                // Weekly: big_win (win 500k total)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_gamble_profit', amount, 500000)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track gamble win for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CRAFTING TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackCraft(userId) {
        try {
            await Promise.all([
                // Daily: daily_crafts (3 crafts goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_crafts', 1, 3),
                // Weekly: weekly_crafts (15 crafts goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_crafts', 1, 15),
                // Achievement: total crafts
                QuestProgressService.incrementAchievementProgress(userId, 'total_crafts', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track craft for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PET TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackPetFeed(userId) {
        try {
            await Promise.all([
                // Daily: daily_pet_feeds (5 feeds goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_pet_feeds', 1, 5),
                // Achievement: pet interactions
                QuestProgressService.incrementAchievementProgress(userId, 'pet_interactions', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track pet feed for ${userId}:`, error);
        }
    }

    static async trackPetHatch(userId) {
        try {
            await Promise.all([
                // Weekly: hatch_pet (1 hatch goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_pet_hatches', 1, 3),
                // Achievement: pets hatched
                QuestProgressService.incrementAchievementProgress(userId, 'total_pet_hatches', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track pet hatch for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // TRADING TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackTrade(userId) {
        try {
            await Promise.all([
                // Daily: daily_trades (2 trades goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_trades', 1, 2),
                // Weekly: weekly_trades (10 trades goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_trades', 1, 10),
                // Achievement: total trades
                QuestProgressService.incrementAchievementProgress(userId, 'total_trades', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track trade for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // MARKET TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackMarketSale(userId) {
        try {
            await Promise.all([
                // Daily: daily_market_sales (1 sale goal)
                QuestProgressService.updateDailyProgress(userId, 'daily_market_sales', 1, 1),
                // Weekly: weekly_market_sales (5 sales goal)
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_market_sales', 1, 5)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track market sale for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ECONOMY TRACKING (Coins)
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackCoinsEarned(userId, amount) {
        try {
            await Promise.all([
                // Daily: earn 100k coins
                QuestProgressService.updateDailyProgress(userId, 'daily_coins_earn', amount, 100000),
                // Weekly: earn 1M coins
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_coins_earn', amount, 1000000),
                // Achievement: total coins earned
                QuestProgressService.incrementAchievementProgress(userId, 'lifetime_coins', amount)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track coins for ${userId}:`, error);
        }
    }

    static async trackCoinsSpent(userId, amount) {
        try {
            await Promise.all([
                // Daily: spend 50k coins
                QuestProgressService.updateDailyProgress(userId, 'daily_coins_spend', amount, 50000),
                // Weekly: spend 500k coins
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_coins_spend', amount, 500000)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track coins spent for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUILDING TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackBuildingUpgrade(userId) {
        try {
            await Promise.all([
                // Weekly: upgrade buildings
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_building_upgrades', 1, 5),
                // Achievement: total upgrades
                QuestProgressService.incrementAchievementProgress(userId, 'total_building_upgrades', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track building upgrade for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // RARITY TRACKING (Shinies, Astral+)
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackShiny(userId) {
        try {
            await Promise.all([
                // Daily: find shiny
                QuestProgressService.updateDailyProgress(userId, 'daily_shinies', 1, 1),
                // Weekly: find shinies
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_shinies', 1, 10),
                // Achievement: total shinies
                QuestProgressService.incrementAchievementProgress(userId, 'total_shinies', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track shiny for ${userId}:`, error);
        }
    }

    static async trackAstralPlus(userId) {
        try {
            await Promise.all([
                // Weekly: obtain astral+ rarity
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_astral_plus', 1, 1),
                // Achievement: total astral+
                QuestProgressService.incrementAchievementProgress(userId, 'total_astral_plus', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track astral+ for ${userId}:`, error);
        }
    }

    static async trackFumoObtained(userId, rarity) {
        try {
            // Track for achievements
            await QuestProgressService.incrementAchievementProgress(userId, 'unique_fumos', 1);
            
            const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
            if (astralPlus.includes(rarity?.toUpperCase())) {
                await this.trackAstralPlus(userId);
            }
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track fumo obtained for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DAILY LOGIN/ACTIVITY TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackDailyLogin(userId) {
        try {
            await Promise.all([
                // Daily: claim daily reward
                QuestProgressService.updateDailyProgress(userId, 'daily_claim', 1, 1),
                // Achievement: login streak
                QuestProgressService.incrementAchievementProgress(userId, 'total_logins', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track daily login for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // MYSTERY CRATE TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackCrateOpen(userId) {
        try {
            await Promise.all([
                // Weekly: open mystery crates
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_crates', 1, 5),
                // Achievement: total crates
                QuestProgressService.incrementAchievementProgress(userId, 'total_crates_opened', 1)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track crate open for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // SOCIAL TRACKING
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackGift(userId) {
        try {
            await Promise.all([
                // Daily: send gift
                QuestProgressService.updateDailyProgress(userId, 'daily_gifts', 1, 1),
                // Weekly: generous giving
                QuestProgressService.updateWeeklyProgress(userId, 'weekly_gifts', 1, 7)
            ]);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track gift for ${userId}:`, error);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // LEGACY SUPPORT (for backwards compatibility)
    // ═══════════════════════════════════════════════════════════════════
    
    static async trackPassiveCoins(userId, amount) {
        await this.trackCoinsEarned(userId, amount);
    }
}

module.exports = QuestMiddleware;