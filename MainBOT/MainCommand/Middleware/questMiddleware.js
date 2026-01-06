const db = require('../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../Ultility/timeUtils');

// Lazy-load MainQuestDatabaseService to avoid circular dependencies
let MainQuestDatabaseService = null;
function getMainQuestService() {
    if (!MainQuestDatabaseService) {
        try {
            MainQuestDatabaseService = require('../Service/UserDataService/MainQuestService/MainQuestDatabaseService');
        } catch (e) {
            console.error('[QuestMiddleware] Could not load MainQuestDatabaseService:', e.message);
        }
    }
    return MainQuestDatabaseService;
}

/**
 * Universal tracking function that updates progress for any active quest
 * matching the given trackingType
 * Optimized: Batch fetch current progress and batch update
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
        
        if (activeQuests.length === 0) {
            // Still track achievements and main quest even if no matching quests
            await trackAchievement(userId, trackingType, increment);
            await trackMainQuest(userId, trackingType, increment);
            return;
        }
        
        // Separate quests by type for optimized batch queries
        const dailyQuests = activeQuests.filter(q => q.questType === 'daily');
        const weeklyQuests = activeQuests.filter(q => q.questType === 'weekly');
        
        // Batch fetch current progress for all quests
        const [dailyProgress, weeklyProgress] = await Promise.all([
            dailyQuests.length > 0 ? new Promise((resolve, reject) => {
                const placeholders = dailyQuests.map(() => '?').join(',');
                db.all(
                    `SELECT questId, progress, completed FROM dailyQuestProgress 
                     WHERE userId = ? AND date = ? AND questId IN (${placeholders})`,
                    [userId, date, ...dailyQuests.map(q => q.uniqueQuestId)],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            }) : Promise.resolve([]),
            weeklyQuests.length > 0 ? new Promise((resolve, reject) => {
                const placeholders = weeklyQuests.map(() => '?').join(',');
                db.all(
                    `SELECT questId, progress, completed FROM weeklyQuestProgress 
                     WHERE userId = ? AND week = ? AND questId IN (${placeholders})`,
                    [userId, week, ...weeklyQuests.map(q => q.uniqueQuestId)],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            }) : Promise.resolve([])
        ]);
        
        // Build progress maps
        const dailyProgressMap = new Map(dailyProgress.map(p => [p.questId, p]));
        const weeklyProgressMap = new Map(weeklyProgress.map(p => [p.questId, p]));
        
        let newlyCompletedCount = 0;
        
        // Update progress for each matching quest
        for (const quest of activeQuests) {
            const table = quest.questType === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
            const timeField = quest.questType === 'daily' ? 'date' : 'week';
            const timeValue = quest.questType === 'daily' ? date : week;
            const progressMap = quest.questType === 'daily' ? dailyProgressMap : weeklyProgressMap;
            
            const currentProgress = progressMap.get(quest.uniqueQuestId);
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
            
            // Count newly completed quests
            if (!wasCompleted && (oldProgress + increment) >= quest.goal) {
                newlyCompletedCount++;
            }
        }
        
        // Batch track "complete X quests" meta quest if any were completed
        if (newlyCompletedCount > 0 && trackingType !== 'quests_completed') {
            await track(userId, 'quests_completed', newlyCompletedCount);
        }
        
        // Also track achievements
        await trackAchievement(userId, trackingType, increment);
        
        // Also track main quest progress
        await trackMainQuest(userId, trackingType, increment);
        
    } catch (error) {
        console.error(`[QuestMiddleware] Failed to track ${trackingType} for ${userId}:`, error);
    }
}

/**
 * Track main quest progress based on trackingType
 */
async function trackMainQuest(userId, trackingType, increment = 1) {
    const mqService = getMainQuestService();
    if (!mqService) return;
    
    try {
        const result = await mqService.updateTracking(userId, trackingType, increment);
        if (result && result.quest) {
            // Quest completed! Could emit an event or log here
            console.log(`[MainQuest] User ${userId} completed Main Quest ${result.quest.id}: ${result.quest.title}`);
        }
    } catch (error) {
        // Silent fail - main quest tracking shouldn't break regular quests
        console.error(`[QuestMiddleware] Failed to track main quest for ${userId}:`, error.message);
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
        
        const rarityUpper = rarity?.toUpperCase();
        
        // Track legendary+ (legendary and above)
        const legendaryPlus = ['LEGENDARY', 'MYTHIC', 'MYTHICAL', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        if (legendaryPlus.includes(rarityUpper)) {
            await this.trackLegendaryPlus(userId);
        }
        
        // Track mythical+ (mythical and above)
        const mythicalPlus = ['MYTHIC', 'MYTHICAL', 'ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        if (mythicalPlus.includes(rarityUpper)) {
            await this.trackMythicalPlus(userId);
        }
        
        // Track astral+
        const astralPlus = ['ASTRAL', 'CELESTIAL', 'INFINITE', 'ETERNAL', 'TRANSCENDENT'];
        if (astralPlus.includes(rarityUpper)) {
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

    // ─── Fragment Tracking ───
    static async trackFragmentUsed(userId, count = 1) {
        await track(userId, 'fragment_used', count);
    }

    // ─── Library Discovery Tracking ───
    static async trackLibraryDiscovery(userId, totalDiscovered) {
        // For absolute value tracking (library is a cumulative count)
        await updateQuestProgressDirect(userId, 'library_discovered', totalDiscovered, 'daily');
        await updateQuestProgressDirect(userId, 'library_discovered', totalDiscovered, 'weekly');
        // Also track for main quests (which use tracking increment style)
        await track(userId, 'library_discovered', 1);
    }

    // ─── Unique Fumo Tracking ───
    static async trackUniqueFumos(userId, totalUnique) {
        await updateQuestProgressDirect(userId, 'unique_fumos', totalUnique, 'daily');
        await updateQuestProgressDirect(userId, 'unique_fumos', totalUnique, 'weekly');
        await track(userId, 'unique_fumos', 1);
    }

    // ─── Farming Tracking ───
    static async trackFarmingAdd(userId, count = 1) {
        await track(userId, 'farming_add', count);
    }

    static async trackFarmingCount(userId, currentCount) {
        await updateQuestProgressDirect(userId, 'farming_count', currentCount, 'daily');
        await updateQuestProgressDirect(userId, 'farming_count', currentCount, 'weekly');
        await track(userId, 'farming_count', 0); // Just trigger check, no increment
    }

    // ─── Weather Farming Tracking ───
    static async trackWeatherFarm(userId) {
        await track(userId, 'weather_farm', 1);
    }

    // ─── Building Levels Tracking ───
    static async trackTotalBuildingLevels(userId, totalLevels) {
        await updateQuestProgressDirect(userId, 'total_building_levels', totalLevels, 'daily');
        await updateQuestProgressDirect(userId, 'total_building_levels', totalLevels, 'weekly');
        await track(userId, 'total_building_levels', 0); // Just trigger check
    }

    // ─── Prayer Variety Tracking ───
    static async trackPrayerVariety(userId, totalUnique) {
        await updateQuestProgressDirect(userId, 'prayer_variety', totalUnique, 'daily');
        await updateQuestProgressDirect(userId, 'prayer_variety', totalUnique, 'weekly');
        await track(userId, 'prayer_variety', 0);
    }

    // ─── Yukari Mark Tracking ───
    static async trackYukariMark(userId, markLevel) {
        await updateQuestProgressDirect(userId, 'yukari_mark', markLevel, 'daily');
        await updateQuestProgressDirect(userId, 'yukari_mark', markLevel, 'weekly');
        await track(userId, 'yukari_mark', 0);
    }

    // ─── Rarity-Based Tracking ───
    static async trackLegendaryPlus(userId) {
        await track(userId, 'legendary_plus', 1);
    }

    static async trackMythicalPlus(userId) {
        await track(userId, 'mythical_plus', 1);
    }

    // ─── Weekly Quest Completion Tracking ───
    static async trackWeeklyQuestCompleted(userId) {
        await track(userId, 'weekly_quest_completed', 1);
    }

    // ─── Achievement Tracking ───
    static async trackAchievementClaimed(userId) {
        await track(userId, 'achievements_claimed', 1);
    }

    // ─── Coins Milestone Tracking ───
    static async trackCoinsMilestone(userId, balance) {
        await updateQuestProgressDirect(userId, 'coins_milestone', balance, 'daily');
        await updateQuestProgressDirect(userId, 'coins_milestone', balance, 'weekly');
        await track(userId, 'coins_milestone', 0);
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

    // ─── EXP Tracking ───
    /**
     * Grant EXP to user (called when completing quests, main quests, etc.)
     * @param {string} userId 
     * @param {number} amount - EXP amount
     * @param {string} source - Source description
     */
    static async grantExp(userId, amount, source = 'quest') {
        try {
            const { addExp } = require('../Service/UserDataService/LevelService/LevelDatabaseService');
            const result = await addExp(userId, amount, source);
            
            if (result.levelUps && result.levelUps.length > 0) {
                console.log(`[EXP] User ${userId} leveled up to ${result.newLevel}!`);
            }
            
            return result;
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to grant EXP to ${userId}:`, error);
            return { success: false };
        }
    }

    /**
     * Grant EXP for daily quest completion
     * @param {string} userId 
     * @param {number} questsCompleted - Number of daily quests completed
     * @param {number} totalQuests - Total daily quests
     * @param {number} streak - Current daily streak
     */
    static async grantDailyQuestExp(userId, questsCompleted, totalQuests, streak = 0) {
        const { calculateDailyQuestExp } = require('../Configuration/levelConfig');
        const exp = calculateDailyQuestExp(questsCompleted, totalQuests, streak);
        return await this.grantExp(userId, exp, 'daily_quest');
    }

    /**
     * Grant EXP for weekly quest completion
     * @param {string} userId 
     * @param {number} questsCompleted - Number of weekly quests completed
     * @param {number} totalQuests - Total weekly quests
     */
    static async grantWeeklyQuestExp(userId, questsCompleted, totalQuests) {
        const { calculateWeeklyQuestExp } = require('../Configuration/levelConfig');
        const exp = calculateWeeklyQuestExp(questsCompleted, totalQuests);
        return await this.grantExp(userId, exp, 'weekly_quest');
    }

    /**
     * Grant EXP for main quest completion
     * @param {string} userId 
     * @param {number} expReward - EXP reward from the main quest
     */
    static async grantMainQuestExp(userId, expReward) {
        return await this.grantExp(userId, expReward, 'main_quest');
    }

    // ─── Main Quest Command Tracking ───
    /**
     * Track command usage for main quests
     * @param {string} userId 
     * @param {string} commandName - Name of the command used
     */
    static async trackMainQuestCommand(userId, commandName) {
        const mqService = getMainQuestService();
        if (!mqService) return null;
        
        try {
            return await mqService.trackCommand(userId, commandName);
        } catch (error) {
            console.error(`[QuestMiddleware] Failed to track main quest command for ${userId}:`, error.message);
            return null;
        }
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
