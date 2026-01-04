const db = require('../../../Core/Database/dbSetting');
const { getWeekIdentifier } = require('../../../Ultility/timeUtils');
const QuestProgressService = require('./QuestProgressService');
const QuestRewardService = require('./QuestRewardService');
const { QUEST_CONFIG, getStreakBonus } = require('../../../Configuration/questConfig');
const { ACHIEVEMENTS } = require('../../../Configuration/unifiedAchievementConfig');

class QuestClaimService {
    static async claimDaily(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        const claimKey = `daily_${date}`;

        const alreadyClaimed = await this.checkClaimed(userId, claimKey);
        if (alreadyClaimed) {
            return { success: false, reason: 'ALREADY_CLAIMED' };
        }

        const progress = await QuestProgressService.getDailyProgress(userId);
        const completedCount = Object.values(progress).filter(p => p.completed).length;

        if (completedCount !== DAILY_QUESTS.length) {
            return { 
                success: false, 
                reason: 'INCOMPLETE',
                completed: completedCount,
                total: DAILY_QUESTS.length
            };
        }

        const rewards = await QuestRewardService.getDailyRewards(userId);
        await this.markClaimed(userId, claimKey);
        await this.incrementWeeklyDailiesCompleted(userId, week);

        return {
            success: true,
            rewards,
            type: 'daily'
        };
    }

    static async claimWeekly(userId) {
        const week = getWeekIdentifier();
        const claimKey = `weekly_${week}`;

        const alreadyClaimed = await this.checkClaimed(userId, claimKey);
        if (alreadyClaimed) {
            return { success: false, reason: 'ALREADY_CLAIMED' };
        }

        const progress = await QuestProgressService.getWeeklyProgress(userId);
        const completedCount = Object.values(progress).filter(p => p.completed).length;

        if (completedCount !== WEEKLY_QUESTS.length) {
            return { 
                success: false, 
                reason: 'INCOMPLETE',
                completed: completedCount,
                total: WEEKLY_QUESTS.length
            };
        }

        const rewards = await QuestRewardService.getWeeklyRewards(userId);
        await this.markClaimed(userId, claimKey);
        await this.checkWeeklyStreak(userId);

        return {
            success: true,
            rewards,
            type: 'weekly'
        };
    }

    /**
     * Claim achievements using the new milestone-based system with infinite scaling
     */
    static async claimAchievements(userId) {
        const achievements = await QuestProgressService.getAchievementProgress(userId);
        
        const rewards = {
            totalCoins: 0,
            totalGems: 0,
            totalTickets: 0,
            items: [],
            claimedCount: 0,
            claimedMilestones: []
        };

        for (const achievement of ACHIEVEMENTS) {
            const progress = achievements[achievement.id] || { progress: 0, claimedMilestones: [] };
            const claimed = progress.claimedMilestones || [];
            
            // Get scaled milestones (infinite scaling)
            const dynamicMilestones = this.getScalingMilestones(achievement, claimed.length);
            
            // Check each milestone
            for (let i = 0; i < dynamicMilestones.length; i++) {
                const milestone = dynamicMilestones[i];
                
                // If progress >= milestone count AND not already claimed
                if (progress.progress >= milestone.count && !claimed.includes(i)) {
                    // Add rewards from this milestone
                    rewards.totalCoins += milestone.reward.coins || 0;
                    rewards.totalGems += milestone.reward.gems || 0;
                    rewards.totalTickets += milestone.reward.tickets || 0;
                    
                    if (milestone.reward.items) {
                        for (const item of milestone.reward.items) {
                            rewards.items.push({ name: item, quantity: 1 });
                        }
                    }
                    
                    rewards.claimedCount++;
                    rewards.claimedMilestones.push({
                        achievementId: achievement.id,
                        milestoneIndex: i
                    });
                    
                    // Mark this milestone as claimed in the database
                    await this.markAchievementMilestoneClaimed(userId, achievement.id, i);
                }
            }
        }

        if (rewards.claimedCount === 0) {
            return { success: false, reason: 'NO_ACHIEVEMENTS' };
        }

        // Grant the rewards
        if (rewards.totalCoins > 0 || rewards.totalGems > 0) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE userCoins SET 
                        coins = coins + ?,
                        gems = gems + ?
                     WHERE userId = ?`,
                    [rewards.totalCoins, rewards.totalGems, userId],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        if (rewards.totalTickets > 0) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity)
                     VALUES (?, 'PrayTicket(R)', ?)
                     ON CONFLICT(userId, itemName) DO UPDATE SET
                         quantity = quantity + ?`,
                    [userId, rewards.totalTickets, rewards.totalTickets],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        if (rewards.items.length > 0) {
            for (const item of rewards.items) {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO userInventory (userId, itemName, quantity)
                         VALUES (?, ?, ?)
                         ON CONFLICT(userId, itemName) DO UPDATE SET
                             quantity = quantity + ?`,
                        [userId, item.name, item.quantity, item.quantity],
                        (err) => err ? reject(err) : resolve()
                    );
                });
            }
        }

        return {
            success: true,
            rewards,
            type: 'achievement'
        };
    }
    
    /**
     * Generate scaling milestones for achievements (infinite scaling)
     */
    static getScalingMilestones(achievement, claimedCount) {
        const baseMilestones = achievement.milestones;
        
        // If we haven't claimed all base milestones, return base + a few more
        if (claimedCount < baseMilestones.length) {
            return baseMilestones;
        }
        
        // Generate additional milestones beyond the base
        const result = [...baseMilestones];
        const lastBase = baseMilestones[baseMilestones.length - 1];
        const scalingLevels = claimedCount - baseMilestones.length + 3;
        
        for (let i = 0; i < scalingLevels; i++) {
            const tier = baseMilestones.length + i;
            const scaleFactor = Math.pow(2, i + 1);
            
            const newCount = Math.floor(lastBase.count * scaleFactor);
            const rewardScale = Math.pow(1.5, i + 1);
            
            const newReward = {
                coins: Math.floor((lastBase.reward.coins || 0) * rewardScale),
                gems: Math.floor((lastBase.reward.gems || 0) * rewardScale),
                tickets: Math.floor((lastBase.reward.tickets || 0) * rewardScale)
            };
            
            // Award badges at certain tiers
            if ((tier + 1) % 3 === 0) {
                const badgeType = this.getBadgeTier(tier);
                const badgeName = achievement.name.replace(/\s+/g, '') + `Badge(${badgeType})`;
                newReward.items = [badgeName];
            }
            
            result.push({ count: newCount, reward: newReward });
        }
        
        return result;
    }
    
    /**
     * Get badge tier based on milestone tier
     */
    static getBadgeTier(tier) {
        if (tier >= 15) return '?';
        if (tier >= 12) return 'T';
        if (tier >= 9) return 'M';
        if (tier >= 6) return 'L';
        return 'E';
    }
    
    /**
     * Mark a specific achievement milestone as claimed
     */
    static async markAchievementMilestoneClaimed(userId, achievementId, milestoneIndex) {
        // Get current claimed milestones
        const current = await new Promise((resolve, reject) => {
            db.get(
                `SELECT claimedMilestones FROM achievementProgress WHERE userId = ? AND achievementId = ?`,
                [userId, achievementId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });
        
        let claimedMilestones = [];
        if (current && current.claimedMilestones) {
            try {
                claimedMilestones = JSON.parse(current.claimedMilestones);
            } catch (e) {
                claimedMilestones = [];
            }
        }
        
        if (!claimedMilestones.includes(milestoneIndex)) {
            claimedMilestones.push(milestoneIndex);
        }
        
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE achievementProgress SET claimedMilestones = ? WHERE userId = ? AND achievementId = ?`,
                [JSON.stringify(claimedMilestones), userId, achievementId],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    /**
     * Claim all rewards for dynamic quest system
     * Claims individual completed quests rather than requiring all quests complete
     */
    static async claimAll(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();
        
        const results = {
            daily: false,
            weekly: false,
            achievements: false,
            dailyClaimed: 0,
            weeklyClaimed: 0,
            achievementsClaimed: 0,
            totalCoins: 0,
            totalGems: 0,
            totalTickets: 0,
            allItems: [],
            streakBonus: false,
            streakMultiplier: 1.0
        };

        // Get active quests
        const QuestPoolService = require('./QuestPoolService');
        const dailyQuests = await QuestPoolService.getDailyQuests(userId);
        const weeklyQuests = await QuestPoolService.getWeeklyQuests(userId);

        // Get progress
        const dailyProgress = await QuestProgressService.getDailyProgress(userId, date);
        const weeklyProgress = await QuestProgressService.getWeeklyProgress(userId, week);

        // Claim completed daily quests
        for (const quest of dailyQuests) {
            const prog = dailyProgress[quest.uniqueId];
            if (prog?.completed && !prog.claimed) {
                // Mark as claimed
                await this.markQuestClaimed(userId, quest.uniqueId, 'daily', date);
                
                // Add rewards
                results.totalCoins += quest.scaledReward.coins || 0;
                results.totalGems += quest.scaledReward.gems || 0;
                results.totalTickets += quest.scaledReward.tickets || 0;
                if (quest.scaledReward.items) {
                    results.allItems.push(...quest.scaledReward.items);
                }
                results.dailyClaimed++;
                results.daily = true;
            }
        }

        // Claim completed weekly quests
        for (const quest of weeklyQuests) {
            const prog = weeklyProgress[quest.uniqueId];
            if (prog?.completed && !prog.claimed) {
                // Mark as claimed
                await this.markQuestClaimed(userId, quest.uniqueId, 'weekly', week);
                
                // Add rewards
                results.totalCoins += quest.scaledReward.coins || 0;
                results.totalGems += quest.scaledReward.gems || 0;
                results.totalTickets += quest.scaledReward.tickets || 0;
                if (quest.scaledReward.items) {
                    results.allItems.push(...quest.scaledReward.items);
                }
                results.weeklyClaimed++;
                results.weekly = true;
            }
        }

        // Check for all dailies completed bonus (streak)
        const allDailiesComplete = dailyQuests.every(q => dailyProgress[q.uniqueId]?.completed);
        if (allDailiesComplete && results.dailyClaimed > 0) {
            // Get user streak
            const userData = await new Promise((resolve, reject) => {
                db.get(`SELECT dailyStreak FROM userCoins WHERE userId = ?`, [userId], (err, row) => {
                    err ? reject(err) : resolve(row);
                });
            });
            
            const streakInfo = getStreakBonus(userData?.dailyStreak || 0);
            
            if (streakInfo.multiplier > 1) {
                results.streakBonus = true;
                results.streakMultiplier = streakInfo.multiplier;
                
                // Apply streak multiplier to coins and gems
                const bonusCoins = Math.floor(results.totalCoins * (streakInfo.multiplier - 1));
                const bonusGems = Math.floor(results.totalGems * (streakInfo.multiplier - 1));
                
                results.totalCoins += bonusCoins;
                results.totalGems += bonusGems;
            }
            
            // Increment streak
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE userCoins SET dailyStreak = COALESCE(dailyStreak, 0) + 1 WHERE userId = ?`,
                    [userId],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // Claim achievements (rewards are granted within claimAchievements now)
        const achievementResult = await this.claimAchievements(userId);
        if (achievementResult.success) {
            results.achievements = true;
            results.achievementsClaimed = achievementResult.rewards.claimedCount || 1;
            // Note: Achievement rewards are already granted in claimAchievements()
            // We only track them for display purposes, don't add to totals that get granted again
            results.totalCoins += achievementResult.rewards.totalCoins || 0;
            results.totalGems += achievementResult.rewards.totalGems || 0;
            results.totalTickets += achievementResult.rewards.totalTickets || 0;
            results.allItems.push(...(achievementResult.rewards.items || []));
        }

        // Grant currency for daily/weekly quests only (achievements already granted)
        // Calculate the non-achievement totals
        const questCoins = results.totalCoins - (achievementResult.success ? (achievementResult.rewards.totalCoins || 0) : 0);
        const questGems = results.totalGems - (achievementResult.success ? (achievementResult.rewards.totalGems || 0) : 0);
        const questTickets = results.totalTickets - (achievementResult.success ? (achievementResult.rewards.totalTickets || 0) : 0);
        
        if (questCoins > 0 || questGems > 0) {
            await new Promise((resolve, reject) => {
                db.run(
                    `UPDATE userCoins SET 
                        coins = coins + ?,
                        gems = gems + ?
                     WHERE userId = ?`,
                    [questCoins, questGems, userId],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        // Grant tickets as items for daily/weekly quests only
        if (questTickets > 0) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity)
                     VALUES (?, 'PrayTicket(R)', ?)
                     ON CONFLICT(userId, itemName) DO UPDATE SET
                         quantity = quantity + ?`,
                    [userId, questTickets, questTickets],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
        
        // Grant items from daily/weekly quests (achievement items already granted in claimAchievements)
        // Filter out achievement items to avoid double-granting
        const questItems = results.allItems.filter(item => {
            // Achievement items are objects with name/quantity, quest items might be strings
            return typeof item === 'string' || !achievementResult.success || 
                   !achievementResult.rewards.items.some(ai => ai.name === item.name);
        });
        
        for (const item of questItems) {
            const itemName = typeof item === 'string' ? item : item.name;
            const quantity = typeof item === 'string' ? 1 : (item.quantity || 1);
            
            // Skip if this item came from achievements (already granted)
            if (achievementResult.success && achievementResult.rewards.items.some(ai => ai.name === itemName)) {
                continue;
            }
            
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity)
                     VALUES (?, ?, ?)
                     ON CONFLICT(userId, itemName) DO UPDATE SET
                         quantity = quantity + ?`,
                    [userId, itemName, quantity, quantity],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        const claimedSomething = results.daily || results.weekly || results.achievements;

        return {
            success: claimedSomething,
            nothingToClaim: !claimedSomething,
            // Spread results for backward compatibility with quest.js
            ...results
        };
    }

    /**
     * Mark a specific quest as claimed
     */
    static async markQuestClaimed(userId, questId, questType, period) {
        const table = questType === 'daily' ? 'dailyQuestProgress' : 'weeklyQuestProgress';
        const timeField = questType === 'daily' ? 'date' : 'week';
        
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE ${table} SET claimed = 1 WHERE userId = ? AND questId = ? AND ${timeField} = ?`,
                [userId, questId, period],
                (err) => err ? reject(err) : resolve()
            );
        });
    }

    static async checkClaimed(userId, claimKey) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT claimed FROM achievementProgress 
                 WHERE userId = ? AND achievementId = ?`,
                [userId, claimKey],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row && row.claimed === 1);
                }
            );
        });
    }

    static async markClaimed(userId, claimKey) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO achievementProgress (userId, achievementId, claimed)
                 VALUES (?, ?, 1)
                 ON CONFLICT(userId, achievementId) DO UPDATE SET claimed = 1`,
                [userId, claimKey],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async incrementWeeklyDailiesCompleted(userId, week) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO weeklyQuestProgress (userId, week, questId, progress, completed)
                 VALUES (?, ?, 'complete_dailies', 1, 0)
                 ON CONFLICT(userId, week, questId) DO UPDATE SET 
                     progress = MIN(weeklyQuestProgress.progress + 1, 7),
                     completed = CASE WHEN weeklyQuestProgress.progress + 1 >= 7 THEN 1 
                                 ELSE weeklyQuestProgress.completed END`,
                [userId, week],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async checkWeeklyStreak(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT achievementId FROM achievementProgress 
                 WHERE userId = ? AND achievementId LIKE 'weekly_%' AND claimed = 1`,
                [userId],
                async (err, rows) => {
                    if (err) return reject(err);
                    
                    if (rows && rows.length >= 7) {
                        await QuestRewardService.grantStreakBadge(userId);
                    }
                    
                    resolve(rows ? rows.length : 0);
                }
            );
        });
    }

    static async getClaimableStatus(userId) {
        const date = new Date().toISOString().slice(0, 10);
        const week = getWeekIdentifier();

        // Get active quests for dynamic system
        const QuestPoolService = require('./QuestPoolService');
        const dailyQuests = await QuestPoolService.getDailyQuests(userId);
        const weeklyQuests = await QuestPoolService.getWeeklyQuests(userId);

        // Fetch all progress and claim status
        const [dailyProgress, weeklyProgress, achievements] = await Promise.all([
            QuestProgressService.getDailyProgress(userId, date),
            QuestProgressService.getWeeklyProgress(userId, week),
            QuestProgressService.getAchievementProgress(userId)
        ]);

        // Count completed and claimable quests
        let dailyCompleted = 0, dailyClaimable = 0;
        for (const quest of dailyQuests) {
            const prog = dailyProgress[quest.uniqueId];
            if (prog?.completed) {
                dailyCompleted++;
                if (!prog.claimed) dailyClaimable++;
            }
        }

        let weeklyCompleted = 0, weeklyClaimable = 0;
        for (const quest of weeklyQuests) {
            const prog = weeklyProgress[quest.uniqueId];
            if (prog?.completed) {
                weeklyCompleted++;
                if (!prog.claimed) weeklyClaimable++;
            }
        }

        const { claimableAchievements } = await QuestRewardService.getClaimableAchievements(userId, achievements);

        return {
            daily: {
                completed: dailyCompleted,
                total: dailyQuests.length,
                canClaim: dailyClaimable > 0,
                claimable: dailyClaimable
            },
            weekly: {
                completed: weeklyCompleted,
                total: weeklyQuests.length,
                canClaim: weeklyClaimable > 0,
                claimable: weeklyClaimable
            },
            achievements: {
                claimable: claimableAchievements,
                canClaim: claimableAchievements > 0
            }
        };
    }
}

module.exports = QuestClaimService;