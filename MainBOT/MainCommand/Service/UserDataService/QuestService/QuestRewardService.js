const db = require('../../../Core/Database/dbSetting');
const { DAILY_REWARDS, WEEKLY_REWARDS, ACHIEVEMENT_REWARDS } = require('../../../Configuration/rewardConfig');
const { ACHIEVEMENTS } = require('../../../Configuration/unifiedAchievementConfig');

class QuestRewardService {
    static async getDailyRewards(userId) {
        const rewards = {
            coins: DAILY_REWARDS.BASE_COINS,
            gems: DAILY_REWARDS.BASE_GEMS,
            items: [...DAILY_REWARDS.BASE_ITEMS]
        };

        const bonusChance = Math.random();
        if (bonusChance <= DAILY_REWARDS.BONUS_CHANCE) {
            const bonusQty = Math.floor(Math.random() * 6) + 3;
            rewards.items.push({
                name: 'PrayTicket(R)',
                quantity: bonusQty
            });
            rewards.items.push({
                name: 'FumoTrait(R)',
                quantity: bonusQty
            });
            rewards.bonusTriggered = true;
        }

        await this.grantRewards(userId, rewards);
        return rewards;
    }

    static async getWeeklyRewards(userId) {
        const rewards = {
            coins: WEEKLY_REWARDS.BASE_COINS,
            gems: WEEKLY_REWARDS.BASE_GEMS,
            items: [...WEEKLY_REWARDS.BASE_ITEMS]
        };

        await this.grantRewards(userId, rewards);
        return rewards;
    }

    static async getAchievementRewards(userId, achievements) {
        const rewards = {
            totalCoins: 0,
            totalGems: 0,
            items: [],
            claimed: []
        };

        for (const achievement of ACHIEVEMENTS) {
            const progress = achievements[achievement.id];
            if (!progress) continue;

            const totalMilestones = Math.floor(progress.progress / achievement.unit);
            const claimed = progress.claimed || 0;
            const newMilestones = totalMilestones - claimed;

            if (newMilestones > 0) {
                const achRewards = this.calculateAchievementRewards(
                    achievement,
                    newMilestones,
                    progress.progress,
                    claimed
                );

                rewards.totalCoins += achRewards.coins;
                rewards.totalGems += achRewards.gems;
                rewards.items.push(...achRewards.items);
                rewards.claimed.push({
                    id: achievement.id,
                    milestones: newMilestones
                });

                await this.updateAchievementClaimed(userId, achievement.id, totalMilestones);
            }
        }

        if (rewards.totalCoins > 0 || rewards.totalGems > 0) {
            await this.grantCurrency(userId, rewards.totalCoins, rewards.totalGems);
        }

        if (rewards.items.length > 0) {
            await this.grantItems(userId, rewards.items);
        }

        return rewards;
    }

    static calculateAchievementRewards(achievement, milestones, totalProgress, claimed) {
        const rewards = {
            coins: 0,
            gems: 0,
            items: []
        };

        if (achievement.id === 'total_rolls') {
            rewards.coins = 5000 * milestones;
            rewards.gems = 1000 * milestones;

            const extraTickets = Math.floor(totalProgress / 500) - Math.floor(claimed * achievement.unit / 500);
            const extraTokens = Math.floor(totalProgress / 1000) - Math.floor(claimed * achievement.unit / 1000);

            if (extraTickets > 0) {
                rewards.items.push({
                    name: 'PrayTicket(R)',
                    quantity: extraTickets
                });
            }

            if (extraTokens > 0) {
                rewards.items.push({
                    name: 'FumoChangeToken(E)',
                    quantity: extraTokens
                });
            }
        } else if (achievement.id === 'total_prays') {
            const fumoTraits = 20 * milestones;
            const sfumoTraits = Math.floor(totalProgress / 50) - Math.floor(claimed * achievement.unit / 50);

            rewards.items.push({
                name: 'FumoTrait(R)',
                quantity: fumoTraits
            });

            if (sfumoTraits > 0) {
                rewards.items.push({
                    name: 'SFumoTrait(L)',
                    quantity: sfumoTraits * 5
                });
            }
        }

        return rewards;
    }

    static async grantRewards(userId, rewards) {
        if (rewards.coins > 0 || rewards.gems > 0) {
            await this.grantCurrency(userId, rewards.coins, rewards.gems);
        }

        if (rewards.items && rewards.items.length > 0) {
            await this.grantItems(userId, rewards.items);
        }
    }

    static async grantCurrency(userId, coins, gems) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE userCoins 
                 SET coins = coins + ?, gems = gems + ?
                 WHERE userId = ?`,
                [coins, gems, userId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async grantItems(userId, items) {
        const promises = items.map(item => {
            const quantity = item.quantity || 1;
            return new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO userInventory (userId, itemName, quantity)
                     VALUES (?, ?, ?)
                     ON CONFLICT(userId, itemName) DO UPDATE SET 
                         quantity = quantity + ?`,
                    [userId, item.name, quantity, quantity],
                    (err) => {
                        if (err) return reject(err);
                        resolve();
                    }
                );
            });
        });

        return Promise.all(promises);
    }

    static async grantStreakBadge(userId) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO userInventory (userId, itemName, quantity)
                 VALUES (?, 'StreakBadge(7W)', 1)
                 ON CONFLICT(userId, itemName) DO UPDATE SET 
                     quantity = quantity + 1`,
                [userId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async updateAchievementClaimed(userId, achievementId, totalMilestones) {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE achievementProgress 
                 SET claimed = ?
                 WHERE userId = ? AND achievementId = ?`,
                [totalMilestones, userId, achievementId],
                (err) => {
                    if (err) return reject(err);
                    resolve();
                }
            );
        });
    }

    static async getClaimableAchievements(userId, achievements) {
        let claimableCount = 0;
        const details = [];

        for (const achievement of ACHIEVEMENTS) {
            const progress = achievements[achievement.id];
            if (!progress) continue;

            const totalMilestones = Math.floor(progress.progress / achievement.unit);
            const claimed = progress.claimed || 0;
            const newMilestones = totalMilestones - claimed;

            if (newMilestones > 0) {
                claimableCount += newMilestones;
                details.push({
                    id: achievement.id,
                    name: achievement.name,
                    milestones: newMilestones
                });
            }
        }

        return {
            claimableAchievements: claimableCount,
            details
        };
    }

    static async calculateStreakBonus(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT dailyStreak FROM userCoins WHERE userId = ?`,
                [userId],
                (err, row) => {
                    if (err) return reject(err);
                    
                    const streak = row ? row.dailyStreak : 0;
                    let multiplier = 1;

                    if (streak >= 30) multiplier = 2.0;
                    else if (streak >= 14) multiplier = 1.5;
                    else if (streak >= 7) multiplier = 1.25;
                    else if (streak >= 3) multiplier = 1.1;

                    resolve({ streak, multiplier });
                }
            );
        });
    }

    static async applyStreakBonus(userId, baseRewards) {
        const { streak, multiplier } = await this.calculateStreakBonus(userId);

        return {
            coins: Math.floor(baseRewards.coins * multiplier),
            gems: Math.floor(baseRewards.gems * multiplier),
            items: baseRewards.items,
            streakBonus: {
                applied: multiplier > 1,
                streak,
                multiplier
            }
        };
    }

    static async grantQuestChainBonus(userId, chainId) {
        const chainRewards = {
            basic_chain: { coins: 50000, gems: 5000 },
            advanced_chain: { coins: 200000, gems: 20000 },
            master_chain: { coins: 1000000, gems: 100000 }
        };

        const rewards = chainRewards[chainId];
        if (!rewards) return;

        await this.grantCurrency(userId, rewards.coins, rewards.gems);
        return rewards;
    }
}

module.exports = QuestRewardService;