const { EmbedBuilder } = require('discord.js');
const { PAGES, COLORS, TOTAL_PAGES, PAGE_INFO } = require('../../../Configuration/balanceConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const {
    getCoinDescription,
    getGemDescription,
    getCrateDescription,
    getStreakDescription,
    formatProgressBar,
    formatTimeAgo,
    formatRatio,
    getWinLossEmoji,
    formatCompactNumber,
    formatDuration
} = require('../../../Ultility/balanceFormatter');
const {
    calculateTotalFarmingRate,
    calculateBoostMultipliers,
    calculateNetWorth,
    getLevelProgress,
    getPlayerRank,
    calculateDailyValue,
    getPityProgress,
    calculateEfficiency
} = require('./BalanceStatsService');

let BUILDING_TYPES = {};
let PET_ABILITIES = {};

try {
    BUILDING_TYPES = require('../../../Configuration/buildingConfig').BUILDING_TYPES;
} catch (e) {
    console.warn('[BalanceUI] buildingConfig not found, using defaults');
}

try {
    PET_ABILITIES = require('../../../Configuration/petConfig').PET_ABILITIES;
} catch (e) {
    console.warn('[BalanceUI] petConfig not found, using defaults');
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 1: OVERVIEW - Main profile summary with key stats
// ═══════════════════════════════════════════════════════════════════
function createOverviewPage(targetUser, userData, farmingFumos, activeBoosts, weather) {
    const farmingRate = calculateTotalFarmingRate(farmingFumos || []);
    const boostMult = calculateBoostMultipliers(activeBoosts || []);
    const dailyValue = calculateDailyValue(farmingRate, boostMult);
    const netWorth = calculateNetWorth(userData);
    const rank = getPlayerRank(userData);
    const levelProgress = getLevelProgress(userData);
    
    const weatherInfo = weather 
        ? `🌤️ ${weather.weatherType}\n(${weather.multiplierCoin}x/${weather.multiplierGem}x)`
        : '☁️ Clear skies';
    
    const embed = new EmbedBuilder()
        .setTitle(`${rank.emoji} ${targetUser.username}'s Profile`)
        .setColor(COLORS.DEFAULT)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            {
                name: '💰 Coins',
                value: `${formatNumber(userData.coins || 0)}`,
                inline: true
            },
            {
                name: '💎 Gems',
                value: `${formatNumber(userData.gems || 0)}`,
                inline: true
            },
            {
                name: '🌸 Tokens',
                value: `${formatNumber(userData.spiritTokens || 0)}`,
                inline: true
            },
            {
                name: '📊 Net Worth',
                value: `💵 ${formatNumber(netWorth)}`,
                inline: true
            },
            {
                name: '🏆 Rank',
                value: `${rank.rank}`,
                inline: true
            },
            {
                name: '📈 Level',
                value: `Lv.${levelProgress.currentLevel} ♻️${userData.rebirth || 0}`,
                inline: true
            },
            {
                name: '📅 Daily Income',
                value: `💰 ${formatNumber(dailyValue.coins)}\n💎 ${formatNumber(dailyValue.gems)}`,
                inline: true
            },
            {
                name: '⚡ Boosts',
                value: (activeBoosts || []).length > 0 
                    ? `${activeBoosts.length} active`
                    : 'None',
                inline: true
            },
            {
                name: '🌤️ Weather',
                value: weatherInfo,
                inline: true
            }
        )
        .setFooter({ text: `Page 1/${TOTAL_PAGES} - Overview | 🏠 Use buttons to navigate` })
        .setTimestamp();
    
    return embed;
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 2: ECONOMY - Detailed wealth breakdown
// ═══════════════════════════════════════════════════════════════════
function createEconomyPage(targetUser, userData, farmingFumos, activeBoosts) {
    const farmingRate = calculateTotalFarmingRate(farmingFumos || []);
    const boostMult = calculateBoostMultipliers(activeBoosts || []);
    const dailyValue = calculateDailyValue(farmingRate, boostMult);
    const netWorth = calculateNetWorth(userData);
    const efficiency = calculateEfficiency(userData);
    
    const effectiveCoinsPerMin = Math.floor(farmingRate.totalCoins * boostMult.coinMultiplier);
    const effectiveGemsPerMin = Math.floor(farmingRate.totalGems * boostMult.gemMultiplier);
    
    return new EmbedBuilder()
        .setTitle(`💰 ${targetUser.username}'s Economy`)
        .setColor(COLORS.ECONOMY || COLORS.DEFAULT)
        .addFields(
            {
                name: '🏦 Currency Holdings',
                value: [
                    `${getCoinDescription(userData.coins || 0)}`,
                    `💰 **Coins:** ${formatNumber(userData.coins || 0)}`,
                    `${getGemDescription(userData.gems || 0)}`,
                    `💎 **Gems:** ${formatNumber(userData.gems || 0)}`,
                    `🌸 **Spirit Tokens:** ${formatNumber(userData.spiritTokens || 0)}`
                ].join('\n'),
                inline: false
            },
            {
                name: '📊 Net Worth Analysis',
                value: [
                    `💵 **Total Value:** ${formatNumber(netWorth)}`,
                    `💰 Coin Value: ${formatNumber(userData.coins || 0)}`,
                    `💎 Gem Value: ${formatNumber((userData.gems || 0) * 10)}`,
                    `🌸 Token Value: ${formatNumber((userData.spiritTokens || 0) * 1000)}`
                ].join('\n'),
                inline: false
            },
            {
                name: '⚙️ Farming Production',
                value: (() => {
                    const fumoList = farmingFumos || [];
                    const totalFumoCount = fumoList.reduce((sum, f) => sum + (f.quantity || 1), 0);
                    return [
                        `🐾 **Fumos Farming:** ${totalFumoCount} (${fumoList.length} unique)`,
                        `💰 **Base Rate:** ${formatNumber(farmingRate.totalCoins)}/min`,
                        `💎 **Base Rate:** ${formatNumber(farmingRate.totalGems)}/min`,
                        `📈 **Boosted:** ${formatNumber(effectiveCoinsPerMin)}💰/${formatNumber(effectiveGemsPerMin)}💎 /min`
                    ].join('\n');
                })(),
                inline: false
            },
            {
                name: '📆 Daily Projections',
                value: [
                    `💰 **Daily Coins:** ${formatNumber(dailyValue.coins)}`,
                    `💎 **Daily Gems:** ${formatNumber(dailyValue.gems)}`,
                    `📊 **Daily Total:** ${formatNumber(dailyValue.total)} value`
                ].join('\n'),
                inline: true
            },
            {
                name: '📈 Efficiency Stats',
                value: [
                    `💰 **Coins/Roll:** ${formatNumber(Math.floor(efficiency.coinsPerRoll))}`,
                    `💎 **Gems/Roll:** ${formatNumber(Math.floor(efficiency.gemsPerRoll))}`,
                    `⚡ **Efficiency:** ${formatNumber(Math.floor(efficiency.totalEfficiency))}`
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ text: `Page 2/${TOTAL_PAGES} - Economy | 💰` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 3: PRAYER - Prayer & devotion statistics
// ═══════════════════════════════════════════════════════════════════
function createPrayerPage(targetUser, userData, sanaeData = {}) {
    const reimuProgress = formatProgressBar(userData.reimuPityCount || 0, 15);
    const marisaProgress = formatProgressBar(userData.marisaDonationCount || 0, 5);
    const yukariProgress = formatProgressBar(userData.yukariMark || 0, 10);
    
    // Sanae faith points - max 20 from prayConfig.faithPoints.max
    const faithPoints = sanaeData.faithPoints || 0;
    const maxFaith = 20; // From prayConfig.faithPoints.max
    const faithProgress = formatProgressBar(faithPoints, maxFaith);
    
    return new EmbedBuilder()
        .setTitle(`🙏 ${targetUser.username}'s Prayer & Devotion`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '🔮 Reimu\'s Blessing',
                value: [
                    `📌 **Status:** ${userData.reimuStatus || 'None'}`,
                    `⚠️ **Penalty Stack:** ${userData.reimuPenalty || 0}`,
                    `🎯 **Pity Progress:** ${reimuProgress}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🧹 Marisa\'s Favor',
                value: [
                    `✨ **Prayed:** ${userData.prayedToMarisa || 'No'}`,
                    `💝 **Donations:** ${marisaProgress}`,
                    `📦 **Borrow Count:** ${userData.marisaBorrowCount || 0}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🌀 Yukari\'s Domain',
                value: [
                    `💰 **Coins Earned:** ${formatNumber(userData.yukariCoins || 0)}`,
                    `💎 **Gems Earned:** ${formatNumber(userData.yukariGems || 0)}`,
                    `🎭 **Yukari Mark:** ${yukariProgress}`
                ].join('\n'),
                inline: false
            },
            {
                name: '⛩️ Sanae\'s Faith',
                value: [
                    `🙏 **Faith Points:** ${formatNumber(faithPoints)} / ${formatNumber(maxFaith)}`,
                    `📈 **Progress:** ${faithProgress}`,
                    `✨ **Permanent Luck:** +${((sanaeData.permanentLuckBonus || 0) * 100).toFixed(1)}%`,
                    `🎲 **Luck Rolls Left:** ${sanaeData.luckForRolls || 0}`,
                    `🎯 **Guaranteed Rolls:** ${sanaeData.guaranteedRarityRolls || 0}`
                ].join('\n'),
                inline: false
            },
            {
                name: '🍀 Luck & Fortune',
                value: [
                    `✨ **ShinyMark+:** ${userData.luck || 0}/1`,
                    `🎲 **Rolls Left:** ${formatNumber(userData.rollsLeft || 0)}`,
                    `🔮 **Boost Charge:** ${userData.boostCharge || 0}%`
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: `Page 3/${TOTAL_PAGES} - Prayer & Stats | 🙏` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 4: STATS - Gacha stats and progression
// ═══════════════════════════════════════════════════════════════════
function createStatsPage(targetUser, userData) {
    const levelProgress = getLevelProgress(userData);
    const winLossEmoji = getWinLossEmoji(userData.wins || 0, userData.losses || 0);
    
    const expBar = formatProgressBar(levelProgress.currentExp, levelProgress.expToNextLevel);
    
    return new EmbedBuilder()
        .setTitle(`📊 ${targetUser.username}'s Statistics`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '📦 Gacha Statistics',
                value: [
                    `${getCrateDescription(userData.totalRolls || 0)}`,
                    `📦 **Total Rolls:** ${formatNumber(userData.totalRolls || 0)}`,
                    `🔥 **Daily Streak:** ${userData.dailyStreak || 0} days`,
                    `${getStreakDescription(userData.dailyStreak || 0)}`
                ].join('\n'),
                inline: false
            },
            {
                name: '📈 Level Progression',
                value: [
                    `🎯 **Level:** ${levelProgress.currentLevel}`,
                    `✨ **Experience:** ${expBar}`,
                    `📊 ${formatNumber(levelProgress.currentExp)}/${formatNumber(levelProgress.expToNextLevel)} EXP`,
                    `♻️ **Rebirth:** ${userData.rebirth || 0}`
                ].join('\n'),
                inline: false
            },
            {
                name: `${winLossEmoji} Gambling Record`,
                value: [
                    `📊 **Win Rate:** ${formatRatio(userData.wins || 0, userData.losses || 0)}`,
                    `✅ **Wins:** ${formatNumber(userData.wins || 0)}`,
                    `❌ **Losses:** ${formatNumber(userData.losses || 0)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '📅 Account Info',
                value: [
                    `📆 **Joined:** ${userData.joinDate ? new Date(userData.joinDate).toLocaleDateString() : 'Unknown'}`,
                    `⚡ **Boost Active:** ${userData.boostActive ? 'Yes' : 'No'}`,
                    `🎫 **Last Daily:** ${userData.lastDailyBonus ? formatTimeAgo(userData.lastDailyBonus) : 'Never'}`
                ].join('\n'),
                inline: true
            }
        )
        .setFooter({ text: `Page 4/${TOTAL_PAGES} - Statistics | 📊` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 5: PETS - Pet collection and bonuses
// ═══════════════════════════════════════════════════════════════════
function createPetsPage(targetUser, petData) {
    const { owned = [], hatching = [] } = petData || {};
    
    // Calculate total bonuses from pets (use ability field)
    const bonuses = { coin: 0, gem: 0, luck: 0, income: 1, exp: 0 };
    
    owned.forEach(pet => {
        if (pet.ability) {
            try {
                const abilityData = typeof pet.ability === 'string' ? JSON.parse(pet.ability) : pet.ability;
                if (abilityData && abilityData.value) {
                    switch (abilityData.type) {
                        case 'Coin': bonuses.coin += abilityData.value; break;
                        case 'Gem': bonuses.gem += abilityData.value; break;
                        case 'Luck': bonuses.luck += abilityData.value; break;
                        case 'Income': bonuses.income *= abilityData.value; break;
                        case 'ExpBonus': bonuses.exp += abilityData.value; break;
                    }
                }
            } catch (e) {}
        }
    });
    
    // Format top pets by level
    const topPets = [...owned].sort((a, b) => (b.level || 0) - (a.level || 0)).slice(0, 5);
    const topPetsText = topPets.length > 0
        ? topPets.map((p, i) => {
            const rarityEmoji = { Common: '⚪', Rare: '🔵', Epic: '🟣', Legendary: '🟡', Mythical: '🔴', Divine: '✨' }[p.rarity] || '⚪';
            return `${i + 1}. ${rarityEmoji} **${p.name}** "${p.petName}" Lv.${p.level || 1}`;
        }).join('\n')
        : 'No pets owned';
    
    // Format hatching eggs
    const hatchingText = hatching.length > 0
        ? hatching.map(egg => {
            const remaining = Math.max(0, (egg.hatchAt || 0) - Date.now());
            return `🥚 ${egg.eggName} - ${formatDuration(remaining)} left`;
        }).join('\n')
        : 'No eggs hatching';
    
    return new EmbedBuilder()
        .setTitle(`🐾 ${targetUser.username}'s Pets`)
        .setColor(COLORS.PETS || COLORS.DEFAULT)
        .addFields(
            {
                name: '📊 Pet Collection',
                value: [
                    `🐾 **Total Pets:** ${owned.length}`,
                    `🥚 **Hatching:** ${hatching.length}/5`
                ].join('\n'),
                inline: true
            },
            {
                name: '💪 Pet Bonuses',
                value: [
                    `💰 Coin: +${bonuses.coin.toFixed(1)}%`,
                    `💎 Gem: +${bonuses.gem.toFixed(1)}%`,
                    `🍀 Luck: +${bonuses.luck.toFixed(1)}%`,
                    `📈 Income: x${bonuses.income.toFixed(2)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '🏆 Top Pets',
                value: topPetsText,
                inline: false
            },
            {
                name: '🥚 Hatching Eggs',
                value: hatchingText,
                inline: false
            }
        )
        .setFooter({ text: `Page 5/${TOTAL_PAGES} - Pets | 🐾 Use .pet for management` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 6: BUILDINGS - Building upgrades and bonuses
// ═══════════════════════════════════════════════════════════════════
function createBuildingsPage(targetUser, buildings) {
    // buildings is now a single object with level fields
    const b = buildings || { coinBoostLevel: 0, gemBoostLevel: 0, criticalFarmingLevel: 0, eventBoostLevel: 0 };
    
    const buildingFields = [];
    const maxLevel = 100;
    
    // Coin Boost Building
    const coinLevel = b.coinBoostLevel || 0;
    buildingFields.push({
        name: '💰 Coin Boost',
        value: [
            `📊 Level: ${coinLevel}/${maxLevel}`,
            `${formatProgressBar(coinLevel, maxLevel, 8)}`,
            `📈 +${(coinLevel * 5).toFixed(0)}% coin bonus`
        ].join('\n'),
        inline: true
    });
    
    // Gem Boost Building
    const gemLevel = b.gemBoostLevel || 0;
    buildingFields.push({
        name: '💎 Gem Boost',
        value: [
            `📊 Level: ${gemLevel}/${maxLevel}`,
            `${formatProgressBar(gemLevel, maxLevel, 8)}`,
            `📈 +${(gemLevel * 5).toFixed(0)}% gem bonus`
        ].join('\n'),
        inline: true
    });
    
    // Critical Farming Building
    const critLevel = b.criticalFarmingLevel || 0;
    buildingFields.push({
        name: '⚡ Critical Farming',
        value: [
            `📊 Level: ${critLevel}/${maxLevel}`,
            `${formatProgressBar(critLevel, maxLevel, 8)}`,
            `📈 +${(critLevel * 2).toFixed(1)}% crit chance`
        ].join('\n'),
        inline: true
    });
    
    // Event Boost Building
    const eventLevel = b.eventBoostLevel || 0;
    buildingFields.push({
        name: '🌟 Event Amplifier',
        value: [
            `📊 Level: ${eventLevel}/${maxLevel}`,
            `${formatProgressBar(eventLevel, maxLevel, 8)}`,
            `📈 +${(eventLevel * 3).toFixed(0)}% event bonus`
        ].join('\n'),
        inline: true
    });
    
    // Calculate total bonus
    const totalCoinBonus = coinLevel * 5;
    const totalGemBonus = gemLevel * 5;
    const critChance = critLevel * 2;
    const eventBoost = eventLevel * 3;
    
    buildingFields.push({
        name: '📊 Total Building Bonuses',
        value: [
            `💰 Coin Production: +${totalCoinBonus.toFixed(0)}%`,
            `💎 Gem Production: +${totalGemBonus.toFixed(0)}%`,
            `⚡ Critical Chance: +${critChance.toFixed(1)}%`,
            `🌟 Event Amplifier: +${eventBoost.toFixed(0)}%`
        ].join('\n'),
        inline: false
    });
    
    return new EmbedBuilder()
        .setTitle(`🏗️ ${targetUser.username}'s Buildings`)
        .setColor(COLORS.BUILDINGS || COLORS.DEFAULT)
        .addFields(...buildingFields)
        .setFooter({ text: `Page 6/${TOTAL_PAGES} - Buildings | 🏗️ Use .build to upgrade` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 7: BOOSTS - Active boost effects
// ═══════════════════════════════════════════════════════════════════
function createBoostsPage(targetUser, activeBoosts, userData) {
    const boostMult = calculateBoostMultipliers(activeBoosts || []);
    
    // Group boosts by type
    const boostGroups = {
        coin: [],
        gem: [],
        luck: [],
        other: []
    };
    
    (activeBoosts || []).forEach(boost => {
        const type = (boost.type || '').toLowerCase();
        const timeLeft = boost.expiresAt ? formatDuration(boost.expiresAt - Date.now()) : 'Permanent';
        const entry = `• ${boost.source}: x${boost.multiplier} (${timeLeft})`;
        
        if (type === 'coin' || type === 'income') boostGroups.coin.push(entry);
        else if (type === 'gem' || type === 'gems') boostGroups.gem.push(entry);
        else if (type === 'luck') boostGroups.luck.push(entry);
        else boostGroups.other.push(entry);
    });
    
    const coinBoostsText = boostGroups.coin.length > 0 ? boostGroups.coin.join('\n') : 'No active coin boosts';
    const gemBoostsText = boostGroups.gem.length > 0 ? boostGroups.gem.join('\n') : 'No active gem boosts';
    const luckBoostsText = boostGroups.luck.length > 0 ? boostGroups.luck.join('\n') : 'No active luck boosts';
    const otherBoostsText = boostGroups.other.length > 0 ? boostGroups.other.join('\n') : 'No other boosts';
    
    return new EmbedBuilder()
        .setTitle(`⚡ ${targetUser.username}'s Active Boosts`)
        .setColor(COLORS.BOOSTS || COLORS.DEFAULT)
        .addFields(
            {
                name: '📊 Total Multipliers',
                value: [
                    `💰 **Coin Multiplier:** x${boostMult.coinMultiplier.toFixed(2)}`,
                    `💎 **Gem Multiplier:** x${boostMult.gemMultiplier.toFixed(2)}`,
                    `⚡ **Boost Charge:** ${userData.boostCharge || 0}%`,
                    `🎯 **Active:** ${userData.boostActive ? 'Yes' : 'No'}`
                ].join('\n'),
                inline: false
            },
            {
                name: '💰 Coin Boosts',
                value: coinBoostsText,
                inline: true
            },
            {
                name: '💎 Gem Boosts',
                value: gemBoostsText,
                inline: true
            },
            {
                name: '🍀 Luck Boosts',
                value: luckBoostsText,
                inline: true
            },
            {
                name: '🔮 Other Boosts',
                value: otherBoostsText,
                inline: true
            }
        )
        .setFooter({ text: `Page 7/${TOTAL_PAGES} - Boosts | ⚡ ${(activeBoosts || []).length} active boosts` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 8: PITY - Gacha pity progression
// ═══════════════════════════════════════════════════════════════════
function createPityPage(targetUser, userData) {
    const pities = getPityProgress(userData);
    
    const pityFields = Object.entries(pities).map(([key, data]) => {
        const percentage = ((data.current / data.max) * 100).toFixed(2);
        const bar = formatProgressBar(data.current, data.max, 10);
        
        return {
            name: `${getRarityEmoji(key)} ${data.name} Pity`,
            value: [
                bar,
                `📊 ${formatNumber(data.current)} / ${formatNumber(data.max)} (${percentage}%)`
            ].join('\n'),
            inline: false
        };
    });
    
    return new EmbedBuilder()
        .setTitle(`🎰 ${targetUser.username}'s Pity Progress`)
        .setColor(COLORS.DEFAULT)
        .setDescription('*Pity guarantees a drop when the counter reaches maximum*')
        .addFields(...pityFields)
        .setFooter({ text: `Page 8/${TOTAL_PAGES} - Pity Progression | 🎰` })
        .setTimestamp();
}

function getRarityEmoji(rarity) {
    const emojis = {
        transcendent: '🌈',
        eternal: '🪐',
        infinite: '♾️',
        celestial: '✨',
        astral: '🌠'
    };
    return emojis[rarity] || '⭐';
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 9: QUESTS - Quest progress summary
// ═══════════════════════════════════════════════════════════════════
function createQuestsPage(targetUser, questSummary) {
    const { ACHIEVEMENTS } = require('../../../Configuration/unifiedAchievementConfig');
    const { daily = { completed: 0, total: 5 }, weekly = { completed: 0, total: 7 }, achievements = [] } = questSummary || {};
    
    const dailyBar = formatProgressBar(daily.completed, daily.total, 10);
    const weeklyBar = formatProgressBar(weekly.completed, weekly.total, 10);
    
    // Calculate claimable achievements using new milestone system
    let claimableAchievements = 0;
    let totalMilestonesClaimed = 0;
    
    ACHIEVEMENTS.forEach(achConfig => {
        const userAch = achievements.find(a => a.achievementId === achConfig.id);
        const progress = userAch?.progress || 0;
        const claimedMilestones = userAch?.claimedMilestones || [];
        
        totalMilestonesClaimed += claimedMilestones.length;
        
        // Check each base milestone
        achConfig.milestones.forEach((milestone, i) => {
            if (progress >= milestone.count && !claimedMilestones.includes(i)) {
                claimableAchievements++;
            }
        });
    });
    
    // Get time until resets
    const now = new Date();
    const nextDaily = new Date();
    nextDaily.setUTCHours(24, 0, 0, 0);
    const dailyTimeLeft = formatDuration(nextDaily - now);
    
    const day = now.getUTCDay();
    const daysUntilMonday = (8 - day) % 7 || 7;
    const nextWeekly = new Date(now);
    nextWeekly.setUTCDate(now.getUTCDate() + daysUntilMonday);
    nextWeekly.setUTCHours(0, 0, 0, 0);
    const weeklyTimeLeft = formatDuration(nextWeekly - now);
    
    return new EmbedBuilder()
        .setTitle(`📜 ${targetUser.username}'s Quest Progress`)
        .setColor(COLORS.QUESTS || COLORS.DEFAULT)
        .addFields(
            {
                name: '🗓️ Daily Quests',
                value: [
                    dailyBar,
                    `✅ **Completed:** ${daily.completed}/${daily.total}`,
                    `⏰ **Resets in:** ${dailyTimeLeft}`,
                    daily.completed === daily.total ? '🎁 **CLAIMABLE!**' : ''
                ].filter(Boolean).join('\n'),
                inline: true
            },
            {
                name: '📅 Weekly Quests',
                value: [
                    weeklyBar,
                    `✅ **Completed:** ${weekly.completed}/${weekly.total}`,
                    `⏰ **Resets in:** ${weeklyTimeLeft}`,
                    weekly.completed === weekly.total ? '🎁 **CLAIMABLE!**' : ''
                ].filter(Boolean).join('\n'),
                inline: true
            },
            {
                name: '🏆 Achievements',
                value: [
                    `📊 **Milestones Claimed:** ${totalMilestonesClaimed}`,
                    `🎁 **Claimable:** ${claimableAchievements}`,
                    claimableAchievements > 0 ? '✨ Use `.claim` to collect!' : '',
                    '',
                    '*Use `.quest achievements` for details*'
                ].filter(Boolean).join('\n'),
                inline: false
            },
            {
                name: '💡 Quick Info',
                value: [
                    '• Use `.quest` for detailed quest view',
                    '• Use `.claim` to collect all rewards',
                    '• Achievements scale infinitely!'
                ].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: `Page 9/${TOTAL_PAGES} - Quests | 📜 Use .quest for full details` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// PAGE 10: ACTIVITY - Recent activity log
// ═══════════════════════════════════════════════════════════════════
function createActivityPage(targetUser, activityData, achievements) {
    const recentSales = activityData?.recentSales || [];
    const recentCrafts = activityData?.recentCrafts || [];
    const rollStats = activityData?.rollStats || { lastRoll: 0, count: 0 };
    
    const salesText = recentSales.length > 0
        ? recentSales
            .slice(0, 5)
            .map(s => `💰 ${s.fumoName} x${s.quantity} - ${formatTimeAgo(s.timestamp)}`)
            .join('\n')
        : 'No recent sales';
    
    const craftsText = recentCrafts.length > 0
        ? recentCrafts
            .slice(0, 5)
            .map(c => `🔨 ${c.itemName} x${c.amount} - ${formatTimeAgo(c.craftedAt)}`)
            .join('\n')
        : 'No recent crafts';
    
    const achievementList = (achievements || []).length > 0
        ? achievements.slice(0, 6).join('\n')
        : 'No achievements unlocked yet';
    
    return new EmbedBuilder()
        .setTitle(`📋 ${targetUser.username}'s Recent Activity`)
        .setColor(COLORS.DEFAULT)
        .addFields(
            {
                name: '🎲 Last Roll',
                value: formatTimeAgo(rollStats.lastRoll || 0),
                inline: true
            },
            {
                name: '📊 Roll Count',
                value: formatNumber(rollStats.count || 0),
                inline: true
            },
            {
                name: '\u200B',
                value: '\u200B',
                inline: true
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
            },
            {
                name: '🏆 Achievements Unlocked',
                value: achievementList,
                inline: false
            }
        )
        .setFooter({ text: `Page 10/${TOTAL_PAGES} - Activity | 📋` })
        .setTimestamp();
}

// ═══════════════════════════════════════════════════════════════════
// GENERATE ALL PAGES
// ═══════════════════════════════════════════════════════════════════
async function generateAllPages(targetUser, userData, farmingFumos, activeBoosts, achievements, activityData, petData, buildings, questSummary, weather, sanaeData) {
    return [
        createOverviewPage(targetUser, userData, farmingFumos, activeBoosts, weather),
        createEconomyPage(targetUser, userData, farmingFumos, activeBoosts),
        createPrayerPage(targetUser, userData, sanaeData),
        createStatsPage(targetUser, userData),
        createPetsPage(targetUser, petData || { owned: [], hatching: [] }),
        createBuildingsPage(targetUser, buildings || []),
        createBoostsPage(targetUser, activeBoosts, userData),
        createPityPage(targetUser, userData),
        createQuestsPage(targetUser, questSummary || { daily: { completed: 0, total: 5 }, weekly: { completed: 0, total: 7 }, achievements: [] }),
        createActivityPage(targetUser, activityData, achievements)
    ];
}

module.exports = {
    createOverviewPage,
    createEconomyPage,
    createPrayerPage,
    createStatsPage,
    createPetsPage,
    createBuildingsPage,
    createBoostsPage,
    createPityPage,
    createQuestsPage,
    createActivityPage,
    generateAllPages
};
