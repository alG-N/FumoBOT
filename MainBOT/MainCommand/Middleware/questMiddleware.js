const db = require('../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../Ultility/timeUtils');

/**
 * Universal tracking function that updates progress for any active quest
 * matching the given trackingType
 */
async function track(userId, trackingType, increment = 1) {
    const date = new Date().toISOString().slice(0, 10);
    const week = getWeekIdentifier();
    
    try {
        // Get user's active quests that match this trackingType
        const activeQuests = await new Promise((resolve, reject) => {
            db.all(
                `SELECT uniqueQuestId, questType, goal FROM userActiveQuests 
                 WHERE userId = ? AND trackingType = ? 
                 AND ((questType = 'daily' AND period = ?) OR (questType = 'weekly' AND period = ?))`,
                [userId, trackingType, date, week],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
        
        // Update progress for each matching quest and check for new completions
        for (const quest of activeQuests) {
            const table = quest.questType === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
            const timeField = quest.questType === 'daily' ? 'date' : 'week';
            const timeValue = quest.questType === 'daily' ? date : week;
            
            // Get current progress BEFORE update to detect completion
            const currentProgress = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT progress, completed FROM ${table} WHERE userId = ? AND questId = ? AND ${timeField} = ?`,
                    [userId, quest.uniqueQuestId, timeValue],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            
            const wasCompleted = currentProgress?.completed === 1;
            const oldProgress = currentProgress?.progress || 0;
            
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO ${table} (userId, questId, ${timeField}, progress, completed, claimed)
                     VALUES (?, ?, ?, ?, 0, 0)
                     ON CONFLICT(userId, questId, ${timeField}) DO UPDATE SET
                         progress = MIN(${table}.progress + ?, ?),
                         completed = CASE 
                             WHEN ${table}.progress + ? >= ? THEN 1
                             ELSE ${table}.completed
                         END`,
                    [userId, quest.uniqueQuestId, timeValue, increment, increment, quest.goal, increment, quest.goal],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            // If quest JUST got completed, track it for "complete X quests" meta quest
            // BUT only if we're not already tracking 'quests_completed' (prevent infinite loop)
            if (!wasCompleted && (oldProgress + increment) >= quest.goal && trackingType !== 'quests_completed') {
                await track(userId, 'quests_completed', 1);
            }
        }
        
        // Also track achievements
        await trackAchievement(userId, trackingType, increment);
        
    } catch (error) {
        console.error(`[QuestMiddleware] Failed to track ${trackingType} for ${userId}:`, error);
    }
}

/**
 * Track achievement progress based on trackingType
 */
async function trackAchievement(userId, trackingType, increment = 1) {
    // Map trackingType to achievement IDs
    const achievementMap = {
        'rolls': 'total_rolls',
        'multi_rolls': 'total_rolls',
        'prays': 'total_prays',
        'shinies': 'total_shinies',
        'coins_earned': 'lifetime_coins',
        'crafts': 'total_crafts',
        'pet_hatches': 'total_pet_hatches',
        'building_upgrades': 'total_building_upgrades',
        'gambles': 'total_gambles',
        'trades': 'total_trades',
        'limit_breaks': 'total_limit_breaks'
    };
    
    const achievementId = achievementMap[trackingType];
    if (!achievementId) return;
    
    try {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementProgress (userId, achievementId, progress, claimed)
                 VALUES (?, ?, ?, 0)
                 ON CONFLICT(userId, achievementId) DO UPDATE SET
                     progress = achievementProgress.progress + ?`,
                [userId, achievementId, increment, increment],
                (err) => err ? reject(err) : resolve()
            );
        });
    } catch (error) {
        console.error(`[QuestMiddleware] Failed to track achievement for ${userId}:`, error);
    }
}

class QuestMiddleware {
    // ─── Gacha Tracking ───
    static async trackRoll(userId, increment = 1) {
        await track(userId, 'rolls', increment);
    }

    static async trackMultiRoll(userId, increment = 1) {
        await track(userId, 'multi_rolls', increment);
        await track(userId, 'rolls', increment * 10); // Multi-roll = 10 rolls
    }

    static async batchTrackRolls(userId, count) {
        await this.trackRoll(userId, count);
    }

    static async trackBannerVariety(userId, bannerId) {
        const date = new Date().toISOString().slice(0, 10);
        try {
            // Track unique banners rolled today
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO userBannerVariety (userId, bannerId, date) VALUES (?, ?, ?)`,
                    [userId, bannerId, date],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            // Get count of unique banners
            const result = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(DISTINCT bannerId) as count FROM userBannerVariety WHERE userId = ? AND date = ?`,
                    [userId, date],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            
            // Update quest progress with current count
            await updateQuestProgressDirect(userId, 'banner_variety', result?.count || 1, 'daily');
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track banner variety for ${userId}:`, error);
        }
    }

    // ─── Prayer Tracking ───
    static async trackPray(userId, success = true) {
        if (!success) return;
        await track(userId, 'prays', 1);
    }

    static async trackPrayStreak(userId, streak) {
        await updateQuestProgressDirect(userId, 'pray_streak', streak, 'daily');
    }

    // ─── Gambling Tracking ───
    static async trackGamble(userId) {
        await track(userId, 'gambles', 1);
    }

    static async trackGambleWin(userId, amount = 0) {
        await track(userId, 'gamble_wins', 1);
        await track(userId, 'gamble_profit', amount);
    }

    static async trackFlipStreak(userId, streak) {
        await updateQuestProgressDirect(userId, 'flip_streak', streak, 'daily');
    }

    // ─── Crafting Tracking ───
    static async trackCraft(userId, rarity = 'common') {
        await track(userId, 'crafts', 1);
        
        const rareRarities = ['rare', 'epic', 'legendary', 'mythic', 'astral'];
        if (rareRarities.includes(rarity?.toLowerCase())) {
            await track(userId, 'craft_rare', 1);
        }
    }

    // ─── Pet Tracking ───
    static async trackPetFeed(userId) {
        await track(userId, 'pet_feeds', 1);
    }

    static async trackPetPlay(userId) {
        await track(userId, 'pet_plays', 1);
    }

    static async trackPetHatch(userId) {
        await track(userId, 'pet_hatches', 1);
    }

    static async trackPetLevel(userId, levelsGained = 1) {
        await track(userId, 'pet_levels', levelsGained);
    }

    // ─── Trading Tracking ───
    static async trackTrade(userId) {
        await track(userId, 'trades', 1);
    }

    // ─── Market Tracking ───
    static async trackMarketSale(userId, amount = 0) {
        await track(userId, 'market_sales', 1);
        await track(userId, 'market_profit', amount);
    }

    static async trackMarketBuy(userId) {
        await track(userId, 'market_buys', 1);
    }

    // ─── Economy Tracking ───
    static async trackCoinsEarned(userId, amount) {
        await track(userId, 'coins_earned', amount);
    }

    static async trackCoinsSpent(userId, amount) {
        await track(userId, 'coins_spent', amount);
    }

    static async trackGemsEarned(userId, amount) {
        await track(userId, 'gems_earned', amount);
    }

    // ─── Building Tracking ───
    static async trackBuildingUpgrade(userId) {
        await track(userId, 'building_upgrades', 1);
    }

    static async trackBuildingCollect(userId) {
        await track(userId, 'building_collects', 1);
    }

    // ─── Rarity Tracking ───
    static async trackShiny(userId) {
        await track(userId, 'shinies', 1);
    }

    static async trackAstralPlus(userId) {
        await track(userId, 'astral_plus', 1);
    }

    static async trackNewFumo(userId) {
        await track(userId, 'new_fumos', 1);
    }

    static async trackFumoObtained(userId, rarity, isNew = false) {
        if (isNew) {
            await this.trackNewFumo(userId);
        }
        
        const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        if (astralPlus.includes(rarity?.toUpperCase())) {
            await this.trackAstralPlus(userId);
        }
    }

    // ─── Daily/Login Tracking ───
    static async trackDailyLogin(userId) {
        await track(userId, 'daily_claim', 1);
    }

    static async trackLoginStreak(userId, streak) {
        await updateQuestProgressDirect(userId, 'login_streak', streak, 'weekly');
    }

    // ─── Crate Tracking ───
    static async trackCrateOpen(userId) {
        await track(userId, 'crates_opened', 1);
    }

    // ─── Social Tracking ───
    static async trackGift(userId) {
        await track(userId, 'gifts', 1);
    }

    // ─── Limit Break Tracking ───
    static async trackLimitBreak(userId) {
        await track(userId, 'limit_breaks', 1);
    }

    // ─── Command Variety Tracking ───
    static async trackCommandVariety(userId, commandName) {
        const date = new Date().toISOString().slice(0, 10);
        try {
            // Track unique commands used today
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR IGNORE INTO userCommandVariety (userId, commandName, date) VALUES (?, ?, ?)`,
                    [userId, commandName, date],
                    (err) => err ? reject(err) : resolve()
                );
            });
            
            // Get count of unique commands
            const result = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(DISTINCT commandName) as count FROM userCommandVariety WHERE userId = ? AND date = ?`,
                    [userId, date],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            
            // Update quest progress with current count
            await updateQuestProgressDirect(userId, 'command_variety', result?.count || 1, 'daily');
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track command variety for ${userId}:`, error);
        }
    }

    // ─── Quest Completion Tracking ───
    static async trackQuestCompleted(userId) {
        await track(userId, 'quests_completed', 1);
    }

    static async trackDailyCompletion(userId) {
        await track(userId, 'daily_completions', 1);
    }

    // ─── Legacy Support ───
    static async trackPassiveCoins(userId, amount) {
        await this.trackCoinsEarned(userId, amount);
    }
}

/**
 * Directly update quest progress (for variety-type quests where we set absolute value)
 */
async function updateQuestProgressDirect(userId, trackingType, value, questType) {
    const date = new Date().toISOString().slice(0, 10);
    const week = getWeekIdentifier();
    
    try {
        // Get user's active quests that match this trackingType
        const activeQuests = await new Promise((resolve, reject) => {
            db.all(
                `SELECT uniqueQuestId, goal FROM userActiveQuests 
                 WHERE userId = ? AND trackingType = ? AND questType = ?
                 AND period = ?`,
                [userId, trackingType, questType, questType === 'daily' ? date : week],
                (err, rows) => err ? reject(err) : resolve(rows || [])
            );
        });
        
        // Update progress for each matching quest
        for (const quest of activeQuests) {
            const table = questType === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
            const timeField = questType === 'daily' ? 'date' : 'week';
            const timeValue = questType === 'daily' ? date : week;
            
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO ${table} (userId, questId, ${timeField}, progress, completed, claimed)
                     VALUES (?, ?, ?, ?, ?, 0)
                     ON CONFLICT(userId, questId, ${timeField}) DO UPDATE SET
                         progress = ?,
                         completed = CASE WHEN ? >= ${table}.goal OR ? >= ? THEN 1 ELSE ${table}.completed END`,
                    [userId, quest.uniqueQuestId, timeValue, value, value >= quest.goal ? 1 : 0, 
                     value, value, value, quest.goal],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
    } catch (error) {
        console.error(`[QuestMiddleware] Failed to update ${trackingType} directly for ${userId}:`, error);
    }
}

module.exports = QuestMiddleware;
