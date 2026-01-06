const db = require('../../../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
const { QUEST_POOLS, QUEST_CONFIG } = require('../../../Configuration/questConfig');

const DAILY_QUEST_COUNT = 5;
const WEEKLY_QUEST_COUNT = 4;
const QUEST_SEED_FACTOR = 7919; 

/**
 * Seeded random number generator for consistent quest selection
 * Uses user ID + date as seed for deterministic but varied results
 */
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * Generate a seed from user ID and date
 */
function generateSeed(userId, dateStr) {
    let hash = 0;
    const combined = `${userId}-${dateStr}`;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

/**
 * Shuffle array with seeded randomness
 */
function seededShuffle(array, seed) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        seed = (seed * QUEST_SEED_FACTOR) % 2147483647;
        const j = Math.floor(seededRandom(seed) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Generate random goal within range
 */
function generateRandomGoal(minGoal, maxGoal, seed) {
    const random = seededRandom(seed);
    // Round to nice numbers
    const rawGoal = minGoal + (random * (maxGoal - minGoal));
    
    if (rawGoal >= 1000) {
        return Math.round(rawGoal / 100) * 100; // Round to nearest 100
    } else if (rawGoal >= 100) {
        return Math.round(rawGoal / 10) * 10; // Round to nearest 10
    } else if (rawGoal >= 10) {
        return Math.round(rawGoal / 5) * 5; // Round to nearest 5
    }
    return Math.round(rawGoal);
}

/**
 * Scale reward based on goal difficulty
 */
function scaleReward(baseReward, actualGoal, baseGoal) {
    const multiplier = actualGoal / baseGoal;
    return {
        coins: Math.floor((baseReward.coins || 0) * multiplier),
        gems: Math.floor((baseReward.gems || 0) * multiplier),
        tickets: Math.floor((baseReward.tickets || 0) * multiplier) || 1,
        items: baseReward.items || []
    };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════
class QuestPoolService {
    /**
     * Initialize user quests - ensures both daily and weekly quests exist
     */
    static async initializeUserQuests(userId) {
        await this.getDailyQuests(userId);
        await this.getWeeklyQuests(userId);
    }

    /**
     * Get or generate daily quests for a user
     * Returns cached quests if already generated today
     */
    static async getDailyQuests(userId) {
        const currentDate = new Date().toISOString().slice(0, 10);
        
        // Check if quests already exist for today
        const existing = await this.getStoredQuests(userId, 'daily', currentDate);
        if (existing && existing.length === DAILY_QUEST_COUNT) {
            return existing;
        }
        
        // Generate new quests
        const quests = await this.generateDailyQuests(userId, currentDate);
        await this.storeQuests(userId, 'daily', currentDate, quests);
        
        return quests;
    }

    /**
     * Get or generate weekly quests for a user
     */
    static async getWeeklyQuests(userId) {
        const currentWeek = getWeekIdentifier();
        
        const existing = await this.getStoredQuests(userId, 'weekly', currentWeek);
        if (existing && existing.length === WEEKLY_QUEST_COUNT) {
            return existing;
        }
        
        const quests = await this.generateWeeklyQuests(userId, currentWeek);
        await this.storeQuests(userId, 'weekly', currentWeek, quests);
        
        return quests;
    }

    /**
     * Generate daily quests from pool
     */
    static async generateDailyQuests(userId, dateStr) {
        const seed = generateSeed(userId, dateStr);
        const pool = QUEST_POOLS.daily;
        
        // Get user stats for scaling (optional)
        const userStats = await this.getUserStats(userId);
        
        // Shuffle and select quests ensuring category diversity
        const selectedQuests = this.selectDiverseQuests(pool, DAILY_QUEST_COUNT, seed);
        
        // Generate dynamic goals
        return selectedQuests.map((quest, index) => {
            const questSeed = seed + index * QUEST_SEED_FACTOR;
            const actualGoal = generateRandomGoal(quest.minGoal, quest.maxGoal, questSeed);
            const scaledReward = scaleReward(quest.baseReward, actualGoal, quest.baseGoal);
            
            return {
                id: `daily_${quest.templateId}_${dateStr}`,
                uniqueId: `daily_${quest.templateId}_${dateStr}`,
                templateId: quest.templateId,
                desc: quest.descTemplate.replace('{goal}', actualGoal.toLocaleString()),
                descTemplate: quest.descTemplate,
                goal: actualGoal,
                minGoal: quest.minGoal,
                maxGoal: quest.maxGoal,
                category: quest.category,
                difficulty: this.calculateDifficulty(actualGoal, quest.minGoal, quest.maxGoal),
                icon: quest.icon,
                reward: scaledReward,
                scaledReward: scaledReward,
                trackingType: quest.trackingType
            };
        });
    }

    /**
     * Generate weekly quests from pool
     */
    static async generateWeeklyQuests(userId, weekStr) {
        const seed = generateSeed(userId, weekStr);
        const pool = QUEST_POOLS.weekly;
        
        const selectedQuests = this.selectDiverseQuests(pool, WEEKLY_QUEST_COUNT, seed);
        
        return selectedQuests.map((quest, index) => {
            const questSeed = seed + index * QUEST_SEED_FACTOR;
            const actualGoal = generateRandomGoal(quest.minGoal, quest.maxGoal, questSeed);
            const scaledReward = scaleReward(quest.baseReward, actualGoal, quest.baseGoal);
            
            return {
                id: `weekly_${quest.templateId}_${weekStr}`,
                uniqueId: `weekly_${quest.templateId}_${weekStr}`,
                templateId: quest.templateId,
                desc: quest.descTemplate.replace('{goal}', actualGoal.toLocaleString()),
                descTemplate: quest.descTemplate,
                goal: actualGoal,
                minGoal: quest.minGoal,
                maxGoal: quest.maxGoal,
                category: quest.category,
                difficulty: this.calculateDifficulty(actualGoal, quest.minGoal, quest.maxGoal),
                icon: quest.icon,
                reward: scaledReward,
                scaledReward: scaledReward,
                trackingType: quest.trackingType
            };
        });
    }

    /**
     * Select quests ensuring category diversity
     * Prevents all quests from being the same type
     */
    static selectDiverseQuests(pool, count, seed) {
        const shuffled = seededShuffle(pool, seed);
        const selected = [];
        const usedCategories = new Set();
        const maxPerCategory = Math.ceil(count / 2);
        
        // First pass: try to get diverse categories
        for (const quest of shuffled) {
            if (selected.length >= count) break;
            
            const categoryCount = selected.filter(q => q.category === quest.category).length;
            if (categoryCount < maxPerCategory) {
                selected.push(quest);
                usedCategories.add(quest.category);
            }
        }
        
        // Second pass: fill remaining slots if needed
        if (selected.length < count) {
            for (const quest of shuffled) {
                if (selected.length >= count) break;
                if (!selected.includes(quest)) {
                    selected.push(quest);
                }
            }
        }
        
        return selected;
    }

    /**
     * Calculate difficulty based on where goal falls in range
     */
    static calculateDifficulty(goal, minGoal, maxGoal) {
        const range = maxGoal - minGoal;
        const position = (goal - minGoal) / range;
        
        if (position <= 0.33) return 'easy';
        if (position <= 0.66) return 'medium';
        if (position <= 0.9) return 'hard';
        return 'legendary';
    }

    /**
     * Get stored quests from database
     */
    static async getStoredQuests(userId, type, period) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questData FROM userActiveQuests 
                 WHERE userId = ? AND questType = ? AND period = ?`,
                [userId, type, period],
                (err, rows) => {
                    if (err) return reject(err);
                    if (!rows || rows.length === 0) return resolve(null);
                    
                    try {
                        const quests = rows.map(r => JSON.parse(r.questData));
                        resolve(quests);
                    } catch (e) {
                        resolve(null);
                    }
                }
            );
        });
    }

    /**
     * Store generated quests in database
     */
    static async storeQuests(userId, type, period, quests) {
        // Delete old quests first
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM userActiveQuests WHERE userId = ? AND questType = ? AND period != ?`,
                [userId, type, period],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });

        // Insert new quests with trackingType and uniqueQuestId for middleware tracking
        const insertPromises = quests.map(quest => {
            return new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO userActiveQuests 
                     (userId, questType, period, questId, uniqueQuestId, trackingType, questData, goal)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId, 
                        type, 
                        period, 
                        quest.id, 
                        quest.uniqueId || quest.id,
                        quest.trackingType || null,
                        JSON.stringify(quest),
                        quest.goal || 1
                    ],
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        });

        return Promise.all(insertPromises);
    }

    /**
     * Get user stats for potential quest scaling
     */
    static async getUserStats(userId) {
        // Get level from userLevelProgress and other stats from userCoins
        const [levelData, userData] = await Promise.all([
            new Promise((resolve, reject) => {
                db.get(`SELECT level FROM userLevelProgress WHERE userId = ?`, [userId],
                    (err, row) => err ? reject(err) : resolve(row));
            }),
            new Promise((resolve, reject) => {
                db.get(`SELECT rebirth, totalRolls FROM userCoins WHERE userId = ?`, [userId],
                    (err, row) => err ? reject(err) : resolve(row));
            })
        ]);
        
        return {
            level: levelData?.level || 1,
            rebirth: userData?.rebirth || 0,
            totalRolls: userData?.totalRolls || 0
        };
    }

    /**
     * Reroll a specific quest (costs gems)
     */
    static async rerollQuest(userId, questId, type = 'daily') {
        const period = type === 'daily' 
            ? new Date().toISOString().slice(0, 10)
            : getWeekIdentifier();
        
        // Check reroll limit
        const rerollData = await this.getRerollCount(userId, type, period);
        if (rerollData.count >= QUEST_CONFIG.maxRerolls) {
            return { success: false, reason: 'REROLL_LIMIT_REACHED' };
        }
        
        // Get current quests
        const quests = await this.getStoredQuests(userId, type, period);
        if (!quests) {
            return { success: false, reason: 'NO_QUESTS_FOUND' };
        }
        
        // Find quest to reroll
        const questIndex = quests.findIndex(q => q.id === questId);
        if (questIndex === -1) {
            return { success: false, reason: 'QUEST_NOT_FOUND' };
        }
        
        // Check if quest already has progress
        const progress = await this.getQuestProgress(userId, questId, type);
        if (progress > 0) {
            return { success: false, reason: 'QUEST_IN_PROGRESS' };
        }
        
        // Get pool and generate new quest
        const pool = type === 'daily' ? QUEST_POOLS.daily : QUEST_POOLS.weekly;
        const usedIds = quests.map(q => q.templateId);
        const availableQuests = pool.filter(q => !usedIds.includes(q.templateId));
        
        if (availableQuests.length === 0) {
            return { success: false, reason: 'NO_ALTERNATIVE_QUESTS' };
        }
        
        // Generate replacement
        const seed = generateSeed(userId, `${period}-reroll-${rerollData.count}`);
        const shuffled = seededShuffle(availableQuests, seed);
        const newQuestTemplate = shuffled[0];
        
        const actualGoal = generateRandomGoal(newQuestTemplate.minGoal, newQuestTemplate.maxGoal, seed);
        const scaledReward = scaleReward(newQuestTemplate.baseReward, actualGoal, newQuestTemplate.baseGoal);
        
        const newQuest = {
            id: `${type}_${newQuestTemplate.templateId}_${Date.now()}`,
            uniqueId: `${type}_${newQuestTemplate.templateId}_${Date.now()}`,
            templateId: newQuestTemplate.templateId,
            desc: newQuestTemplate.descTemplate.replace('{goal}', actualGoal.toLocaleString()),
            descTemplate: newQuestTemplate.descTemplate,
            goal: actualGoal,
            minGoal: newQuestTemplate.minGoal,
            maxGoal: newQuestTemplate.maxGoal,
            category: newQuestTemplate.category,
            difficulty: this.calculateDifficulty(actualGoal, newQuestTemplate.minGoal, newQuestTemplate.maxGoal),
            icon: newQuestTemplate.icon,
            reward: scaledReward,
            scaledReward: scaledReward,
            trackingType: newQuestTemplate.trackingType
        };
        
        // Update quests
        quests[questIndex] = newQuest;
        await this.storeQuests(userId, type, period, quests);
        
        // Increment reroll counter
        await this.incrementRerollCount(userId, type, period);
        
        return { success: true, newQuest };
    }

    /**
     * Get reroll count for user
     */
    static async getRerollCount(userId, type, period) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT rerollCount FROM questRerolls 
                 WHERE userId = ? AND questType = ? AND period = ?`,
                [userId, type, period],
                (err, row) => {
                    if (err) return reject(err);
                    resolve({ count: row?.rerollCount || 0 });
                }
            );
        });
    }

    /**
     * Increment reroll count
     */
    static async incrementRerollCount(userId, type, period) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO questRerolls (userId, questType, period, rerollCount)
                 VALUES (?, ?, ?, 1)
                 ON CONFLICT(userId, questType, period) DO UPDATE SET
                     rerollCount = rerollCount + 1`,
                [userId, type, period],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    /**
     * Get quest progress
     */
    static async getQuestProgress(userId, questId, type) {
        const table = type === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
        const timeField = type === 'daily' ? 'date' : 'week';
        const period = type === 'daily' 
            ? new Date().toISOString().slice(0, 10)
            : getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT progress FROM ${table} 
                 WHERE userId = ? AND questId = ? AND ${timeField} = ?`,
                [userId, questId, period],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row?.progress || 0);
                }
            );
        });
    }

    /**
     * Cleanup old quest data (call periodically)
     */
    static async cleanupOldQuests() {
        const currentDate = new Date().toISOString().slice(0, 10);
        const currentWeek = getWeekIdentifier();
        
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(
                    `DELETE FROM userActiveQuests WHERE questType = 'daily' AND period < ?`,
                    [currentDate]
                );
                db.run(
                    `DELETE FROM userActiveQuests WHERE questType = 'weekly' AND period < ?`,
                    [currentWeek]
                );
                db.run(
                    `DELETE FROM questRerolls WHERE (questType = 'daily' AND period < ?) 
                     OR (questType = 'weekly' AND period < ?)`,
                    [currentDate, currentWeek],
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        });
    }

    /**
     * Get all quest progress for a user (daily + weekly)
     */
    static async getAllQuestProgress(userId) {
        const currentDate = new Date().toISOString().slice(0, 10);
        const currentWeek = getWeekIdentifier();
        
        const [dailyQuests, weeklyQuests, dailyProgress, weeklyProgress] = await Promise.all([
            this.getDailyQuests(userId),
            this.getWeeklyQuests(userId),
            this.getDailyProgressMap(userId, currentDate),
            this.getWeeklyProgressMap(userId, currentWeek)
        ]);
        
        const daily = dailyQuests.map(quest => ({
            ...quest,
            progress: dailyProgress[quest.id]?.progress || 0,
            completed: dailyProgress[quest.id]?.completed || false
        }));
        
        const weekly = weeklyQuests.map(quest => ({
            ...quest,
            progress: weeklyProgress[quest.id]?.progress || 0,
            completed: weeklyProgress[quest.id]?.completed || false
        }));
        
        return { daily, weekly };
    }

    /**
     * Get daily progress map
     */
    static async getDailyProgressMap(userId, date) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, progress, completed FROM dailyQuestProgress
                 WHERE userId = ? AND date = ?`,
                [userId, date],
                (err, rows) => {
                    if (err) return reject(err);
                    const map = {};
                    (rows || []).forEach(row => {
                        map[row.questId] = {
                            progress: row.progress,
                            completed: row.completed === 1
                        };
                    });
                    resolve(map);
                }
            );
        });
    }

    /**
     * Get weekly progress map
     */
    static async getWeeklyProgressMap(userId, week) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT questId, progress, completed FROM weeklyQuestProgress
                 WHERE userId = ? AND week = ?`,
                [userId, week],
                (err, rows) => {
                    if (err) return reject(err);
                    const map = {};
                    (rows || []).forEach(row => {
                        map[row.questId] = {
                            progress: row.progress,
                            completed: row.completed === 1
                        };
                    });
                    resolve(map);
                }
            );
        });
    }

    /**
     * Force regenerate quests for a user (clears existing and creates new)
     * Useful when quest structure changes or tracking isn't working
     */
    static async forceRegenerateQuests(userId) {
        const currentDate = new Date().toISOString().slice(0, 10);
        const currentWeek = getWeekIdentifier();
        
        // Delete all existing quests for this user
        await new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM userActiveQuests WHERE userId = ?`,
                [userId],
                (err) => err ? reject(err) : resolve()
            );
        });
        
        // Generate fresh quests
        const dailyQuests = await this.generateDailyQuests(userId, currentDate);
        await this.storeQuests(userId, 'daily', currentDate, dailyQuests);
        
        const weeklyQuests = await this.generateWeeklyQuests(userId, currentWeek);
        await this.storeQuests(userId, 'weekly', currentWeek, weeklyQuests);
        
        return { daily: dailyQuests, weekly: weeklyQuests };
    }

    /**
     * Migration: Fix quests without trackingType by regenerating them
     * Call once on startup or when needed
     */
    static async migrateQuestsWithoutTrackingType() {
        try {
            // Find users with quests missing trackingType
            const usersWithBadQuests = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT DISTINCT userId FROM userActiveQuests WHERE trackingType IS NULL`,
                    [],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });
            
            if (usersWithBadQuests.length === 0) {
                return { migrated: 0 };
            }
            
            console.log(`[QuestPoolService] Migrating ${usersWithBadQuests.length} users with missing trackingType...`);
            
            for (const row of usersWithBadQuests) {
                await this.forceRegenerateQuests(row.userId);
            }
            
            console.log(`[QuestPoolService] Migration complete: ${usersWithBadQuests.length} users migrated`);
            return { migrated: usersWithBadQuests.length };
        } catch (error) {
            console.error('[QuestPoolService] Migration failed:', error);
            return { migrated: 0, error: error.message };
        }
    }
}

module.exports = QuestPoolService;
