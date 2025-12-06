const { EmbedBuilder } = require('discord.js');
const { PAGES, COLORS } = require('../../../Configuration/balanceConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const {
    getCoinDescription,
    getGemDescription,
    getCrateDescription,
    getStreakDescription,
    formatProgressBar,
    formatTimeAgo,
    formatRatio,
    getWinLossEmoji
} = require('../../../Ultility/balanceFormatter');
const {
    calculateTotalFarmingRate,
    calculateBoostMultipliers,
    calculateNetWorth,
    getLevelProgress,
    getPlayerRank,
    calculateDailyValue,
    getPityProgress
} = require('./BalanceStatsService');

function createOverviewPage(targetUser, userData, farmingFumos, activeBoosts) {
    const farmingRate = calculateTotalFarmingRate(farmingFumos);
    const boostMult = calculateBoostMultipliers(activeBoosts);
    const dailyValue = calculateDailyValue(farmingRate, boostMult);
    const netWorth = calculateNetWorth(userData);
    const rank = getPlayerRank(userData);
    
    return new EmbedBuilder()
        .setTitle(`${rank.emoji} ${targetUser.username}'s Profile`)
        .setColor(COLORS.DEFAULT)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            {
                name: '💰 Coins',
                value: `${getCoinDescription(userData.coins)}\n💰 ${formatNumber(userData.coins)}`,
                inline: true
            },
            {
                name: '💎 Gems',
                value: `${getGemDescription(userData.gems)}\n💎 ${formatNumber(userData.gems)}`,
                inline: true
            },
            {
                name: '🌸 Fumo Tokens',
                value: `🌸 ${formatNumber(userData.spiritTokens)}`,
                inline: true
            },
            {
                name: '📊 Net Worth',
                value: `💵 ${formatNumber(netWorth)}`,
                inline: true
            },
            {
                name: '🏆 Rank',
                value: `${rank.rank} (Tier ${rank.tier})`,
                inline: true
            },
            {
                name: '📈 Daily Income',
                value: `💰 ${formatNumber(dailyValue.coins)}/day\n💎 ${formatNumber(dailyValue.gems)}/day`,
                inline: true
            },
            {
                name: '⚡ Active Boosts',
                value: activeBoosts.length > 0 
                    ? `${activeBoosts.length} boost(s) active`
                    : 'No active boosts',
                inline: true
            },
            {
                name: '\u200B',
                value: '\u200B',
                inline: true
            }
        )
        .setFooter({ text: 'Page 1/6 - Overview | Use buttons to navigate' })
        .setTimestamp();
}

function createPrayerPage(targetUser, userData) {
    const reimuProgress = formatProgressBar(userData.reimuPityCount, 15);
    const marisaProgress = formatProgressBar(userData.marisaDonationCount, 5);
    const yukariProgress = formatProgressBar(userData.yukariMark, 10);
    
    return new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Prayer & Devotion`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '🔮 Reimu Stats',
                value: 
                    `Status: ${userData.reimuStatus}\n` +
                    `Penalty Stack: ${userData.reimuPenalty}\n` +
                    `Pity: ${reimuProgress}`,
                inline: false
            },
            {
                name: '🙏 Marisa Stats',
                value:
                    `Prayed: ${userData.prayedToMarisa}\n` +
                    `Donation: ${marisaProgress}`,
                inline: false
            },
            {
                name: '🌀 Yukari Stats',
                value:
                    `Coins Earned: ${formatNumber(userData.yukariCoins)}\n` +
                    `Gems Earned: ${formatNumber(userData.yukariGems)}\n` +
                    `Mark: ${yukariProgress}`,
                inline: false
            },
            {
                name: '🍀 Luck Stat',
                value: `✨ ShinyMark+: ${userData.luck}/1\n🎲 Rolls Left: ${formatNumber(userData.rollsLeft)}`,
                inline: false
            }
        )
        .setFooter({ text: 'Page 2/6 - Prayer & Stats' })
        .setTimestamp();
}

function createStatsPage(targetUser, userData) {
    const levelProgress = getLevelProgress(userData);
    const winLossEmoji = getWinLossEmoji(userData.wins, userData.losses);
    
    return new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Statistics`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '📦 Gacha Stats',
                value:
                    `${getCrateDescription(userData.totalRolls)}\n` +
                    `📦 Total Rolls: ${formatNumber(userData.totalRolls)}\n` +
                    `🔥 Daily Streak: ${userData.dailyStreak} days\n` +
                    `${getStreakDescription(userData.dailyStreak)}`,
                inline: false
            },
            {
                name: '📈 Progression',
                value:
                    `Level: ${levelProgress.currentLevel}\n` +
                    `Experience: ${formatProgressBar(levelProgress.currentExp, levelProgress.expToNextLevel)}\n` +
                    `Rebirth: ${userData.rebirth}`,
                inline: false
            },
            {
                name: `${winLossEmoji} Win/Loss Record`,
                value: formatRatio(userData.wins, userData.losses),
                inline: false
            },
            {
                name: '📅 Account Info',
                value: userData.joinDate 
                    ? `Joined: ${new Date(userData.joinDate).toLocaleDateString()}`
                    : 'Join date unknown',
                inline: false
            }
        )
        .setFooter({ text: 'Page 3/6 - Main Statistics' })
        .setTimestamp();
}

async function createAchievementsPage(targetUser, achievements) {
    const achievementList = achievements.length > 0
        ? achievements.join('\n')
        : 'No achievements yet! Keep playing to unlock them.';
    
    return new EmbedBuilder()
        .setTitle(`🏆 ${targetUser.username}'s Achievements`)
        .setColor(COLORS.DEFAULT)
        .setDescription(achievementList)
        .addFields(
            {
                name: '📊 Progress',
                value: `${achievements.length}/8 achievements unlocked`,
                inline: false
            }
        )
        .setFooter({ text: 'Page 4/6 - Achievements' })
        .setTimestamp();
}

function createProgressionPage(targetUser, userData) {
    const pities = getPityProgress(userData);
    
    const pityFields = Object.entries(pities).map(([key, data]) => ({
        name: `${data.name} Pity`,
        value: formatProgressBar(data.current, data.max) + ` (${formatNumber(data.current)}/${formatNumber(data.max)})`,
        inline: false
    }));
    
    return new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Pity Progress`)
        .setColor(COLORS.DEFAULT)
        .addFields(...pityFields)
        .setFooter({ text: 'Page 5/6 - Pity Progression' })
        .setTimestamp();
}

function createActivityPage(targetUser, activityData) {
    const salesText = activityData.recentSales.length > 0
        ? activityData.recentSales
            .map(s => `${s.fumoName} x${s.quantity} - ${formatTimeAgo(s.timestamp)}`)
            .join('\n')
        : 'No recent sales';
    
    const craftsText = activityData.recentCrafts.length > 0
        ? activityData.recentCrafts
            .map(c => `${c.itemName} x${c.amount} - ${formatTimeAgo(c.craftedAt)}`)
            .join('\n')
        : 'No recent crafts';
    
    return new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Recent Activity`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '📊 Last Roll',
                value: formatTimeAgo(activityData.rollStats.lastRoll || 0),
                inline: false
            },
            {
                name: '💰 Recent Sales',
                value: salesText,
                inline: false
            },
            {
                name: '🔨 Recent Crafts',
                value: craftsText,
                inline: false
            }
        )
        .setFooter({ text: 'Page 6/6 - Recent Activity' })
        .setTimestamp();
}

async function generateAllPages(targetUser, userData, farmingFumos, activeBoosts, achievements, activityData) {
    return [
        createOverviewPage(targetUser, userData, farmingFumos, activeBoosts),
        createPrayerPage(targetUser, userData),
        createStatsPage(targetUser, userData),
        await createAchievementsPage(targetUser, achievements),
        createProgressionPage(targetUser, userData),
        createActivityPage(targetUser, activityData)
    ];
}

module.exports = {
    createOverviewPage,
    createPrayerPage,
    createStatsPage,
    createAchievementsPage,
    createProgressionPage,
    createActivityPage,
    generateAllPages
};