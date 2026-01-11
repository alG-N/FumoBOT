const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { formatProgressBar } = require('../../../Ultility/balanceFormatter');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const {
    LEVEL_MILESTONES,
    FEATURE_UNLOCKS,
    getLevelTier,
    formatLevelDisplay,
    getNextFeatureUnlock,
    MAX_LEVEL
} = require('../../../Configuration/levelConfig');

const COLORS = {
    DEFAULT: '#5865F2',
    SUCCESS: '#00FF7F',
    GOLD: '#FFD700',
    REBIRTH: '#FF00FF'
};

/**
 * Create the main level overview embed
 * @param {Object} user - Discord user object
 * @param {Object} levelData - Level data from database
 * @returns {EmbedBuilder}
 */
function createLevelOverviewEmbed(user, levelData) {
    const tier = getLevelTier(levelData.level);
    const progressBar = formatProgressBar(levelData.currentExp, levelData.expToNext, 15);
    const progressPercent = levelData.progress.toFixed(1);
    
    const nextFeature = getNextFeatureUnlock(levelData.level);
    const nextFeatureStr = nextFeature 
        ? `🔓 **Next Unlock:** ${formatFeatureName(nextFeature.feature)} at Lv.${nextFeature.level}`
        : '✨ **All features unlocked!**';
    
    // Find next milestone
    const nextMilestone = LEVEL_MILESTONES.find(m => m.level > levelData.level);
    const nextMilestoneStr = nextMilestone
        ? `🎯 **Next Milestone:** ${nextMilestone.name} at Lv.${nextMilestone.level}`
        : '🏆 **All milestones reached!**';
    
    const embed = new EmbedBuilder()
        .setTitle(`${tier.emoji} ${user.username}'s Level Progress`)
        .setColor(tier.color)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            {
                name: '📊 Current Level',
                value: [
                    `**Level:** ${levelData.level} / ${MAX_LEVEL}`,
                    `**Tier:** ${tier.name}`,
                    levelData.rebirth > 0 ? `**Rebirth:** ♻️ ${levelData.rebirth}` : ''
                ].filter(Boolean).join('\n'),
                inline: true
            },
            {
                name: '✨ Experience',
                value: [
                    `**Total EXP:** ${formatNumber(levelData.totalExp)}`,
                    `**To Next:** ${formatNumber(levelData.expToNext - levelData.currentExp)}`
                ].join('\n'),
                inline: true
            },
            {
                name: '📈 Progress to Next Level',
                value: `${progressBar} ${progressPercent}%\n\`${formatNumber(levelData.currentExp)} / ${formatNumber(levelData.expToNext)}\``,
                inline: false
            },
            {
                name: '🎯 Goals',
                value: [nextMilestoneStr, nextFeatureStr].join('\n'),
                inline: false
            }
        )
        .setFooter({ text: 'Earn EXP from Main Quests, Daily & Weekly Quests!' })
        .setTimestamp();
    
    if (levelData.level >= MAX_LEVEL) {
        embed.addFields({
            name: '🌟 MAX LEVEL REACHED!',
            value: 'You can now perform a **Rebirth** to start a new journey with permanent bonuses!\nUse `.rebirth` to learn more.',
            inline: false
        });
    }
    
    return embed;
}

/**
 * Create milestones page embed
 * @param {Object} user - Discord user
 * @param {Object} levelData - Level data
 * @param {number[]} claimedLevels - Array of claimed milestone levels
 * @param {number} page - Current page
 * @returns {{embed: EmbedBuilder, totalPages: number}}
 */
function createMilestonesEmbed(user, levelData, claimedLevels = [], page = 0) {
    const milestonesPerPage = 5;
    const totalPages = Math.ceil(LEVEL_MILESTONES.length / milestonesPerPage);
    const startIdx = page * milestonesPerPage;
    const pageMilestones = LEVEL_MILESTONES.slice(startIdx, startIdx + milestonesPerPage);
    
    const milestoneLines = pageMilestones.map(m => {
        const reached = levelData.level >= m.level;
        const claimed = claimedLevels.includes(m.level);
        
        let status;
        if (claimed) {
            status = '✅'; // Claimed
        } else if (reached) {
            status = '🎁'; // Ready to claim
        } else {
            status = '🔒'; // Locked
        }
        
        // Handle milestones with null rewards
        const rewardStr = m.rewards ? [
            m.rewards.coins ? `💰${formatNumber(m.rewards.coins)}` : '',
            m.rewards.gems ? `💎${formatNumber(m.rewards.gems)}` : '',
            m.rewards.tickets ? `🎫${m.rewards.tickets}` : ''
        ].filter(Boolean).join(' ') : '*No reward*';
        
        return [
            `${status} **Lv.${m.level} - ${m.name}**`,
            `├ ${m.description}`,
            `├ 🎁 ${rewardStr}`,
            `└ 🔓 ${m.unlocks.join(', ')}`
        ].join('\n');
    });
    
    const unclaimedCount = LEVEL_MILESTONES.filter(m => 
        levelData.level >= m.level && !claimedLevels.includes(m.level)
    ).length;
    
    const embed = new EmbedBuilder()
        .setTitle(`🏆 ${user.username}'s Level Milestones`)
        .setColor(unclaimedCount > 0 ? COLORS.SUCCESS : COLORS.DEFAULT)
        .setDescription([
            unclaimedCount > 0 ? `🎁 **${unclaimedCount} milestone(s) ready to claim!**\n` : '',
            milestoneLines.join('\n\n')
        ].filter(Boolean).join(''))
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Current Level: ${levelData.level}` })
        .setTimestamp();
    
    return { embed, totalPages };
}

/**
 * Create feature unlocks embed
 * @param {Object} user - Discord user
 * @param {Object} levelData - Level data
 * @returns {EmbedBuilder}
 */
function createFeatureUnlocksEmbed(user, levelData) {
    const featureList = Object.entries(FEATURE_UNLOCKS)
        .sort((a, b) => a[1] - b[1])
        .map(([feature, level]) => {
            const unlocked = levelData.level >= level;
            const status = unlocked ? '✅' : '🔒';
            return `${status} **Lv.${level}** - ${formatFeatureName(feature)}`;
        });
    
    const embed = new EmbedBuilder()
        .setTitle(`🔓 ${user.username}'s Feature Unlocks`)
        .setColor(COLORS.DEFAULT)
        .setDescription([
            '> Features unlock as you level up!\n',
            featureList.join('\n')
        ].join('\n'))
        .setFooter({ text: `Current Level: ${levelData.level}` })
        .setTimestamp();
    
    return embed;
}

/**
 * Create level up notification embed
 * @param {Object} user - Discord user
 * @param {number} oldLevel - Previous level
 * @param {number} newLevel - New level
 * @param {Object[]} newMilestones - Newly reached milestones
 * @returns {EmbedBuilder}
 */
function createLevelUpEmbed(user, oldLevel, newLevel, newMilestones = []) {
    const tier = getLevelTier(newLevel);
    
    const embed = new EmbedBuilder()
        .setTitle('🎉 LEVEL UP!')
        .setColor(COLORS.GOLD)
        .setThumbnail(user.displayAvatarURL())
        .setDescription([
            `**${user.username}** has reached **Level ${newLevel}**!`,
            `${tier.emoji} Tier: **${tier.name}**`,
            '',
            `📊 ${oldLevel} → ${newLevel}`
        ].join('\n'));
    
    if (newMilestones.length > 0) {
        embed.addFields({
            name: '🎁 New Milestones Reached!',
            value: newMilestones.map(m => 
                `• **${m.name}** (Lv.${m.level}) - Use \`.level\` to claim!`
            ).join('\n'),
            inline: false
        });
    }
    
    // Check for special unlocks
    const specialUnlocks = [];
    if (oldLevel < 50 && newLevel >= 50) {
        specialUnlocks.push('🌍 **BIOME SYSTEM UNLOCKED!**');
    }
    if (oldLevel < 100 && newLevel >= 100) {
        specialUnlocks.push('♻️ **REBIRTH UNLOCKED!**');
    }
    
    if (specialUnlocks.length > 0) {
        embed.addFields({
            name: '✨ Special Unlocks!',
            value: specialUnlocks.join('\n'),
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Keep earning EXP to unlock more features!' })
        .setTimestamp();
    
    return embed;
}

/**
 * Create milestone claimed embed
 * @param {Object} milestone - The claimed milestone
 * @param {Object} rewards - Rewards received
 * @returns {EmbedBuilder}
 */
function createMilestoneClaimedEmbed(milestone, rewards) {
    const rewardLines = [];
    if (rewards.coins) rewardLines.push(`💰 **${formatNumber(rewards.coins)}** Coins`);
    if (rewards.gems) rewardLines.push(`💎 **${formatNumber(rewards.gems)}** Gems`);
    if (rewards.tickets) rewardLines.push(`🎫 **${rewards.tickets}** Tickets`);
    
    return new EmbedBuilder()
        .setTitle('🎁 Milestone Claimed!')
        .setColor(COLORS.SUCCESS)
        .setDescription([
            `**${milestone.name}** (Level ${milestone.level})`,
            '',
            '**Rewards Received:**',
            rewardLines.join('\n'),
            '',
            milestone.unlocks.length > 0 
                ? `**Unlocked:** ${milestone.unlocks.join(', ')}`
                : ''
        ].filter(Boolean).join('\n'))
        .setTimestamp();
}

/**
 * Create navigation buttons for level command
 * @param {string} userId 
 * @param {string} currentView - 'overview', 'milestones', 'features'
 * @param {number} page - Current page for milestones
 * @param {number} totalPages - Total pages for milestones
 * @param {boolean} hasClaimable - Whether there are claimable milestones
 * @returns {ActionRowBuilder[]}
 */
function createLevelButtons(userId, currentView = 'overview', page = 0, totalPages = 1, hasClaimable = false) {
    const rows = [];
    
    // Navigation buttons
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('level_overview', userId))
            .setLabel('📊 Overview')
            .setStyle(currentView === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('level_milestones', userId))
            .setLabel('🏆 Milestones')
            .setStyle(currentView === 'milestones' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('level_features', userId))
            .setLabel('🔓 Features')
            .setStyle(currentView === 'features' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );
    rows.push(navRow);
    
    // Milestone-specific buttons
    if (currentView === 'milestones') {
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('level_milestone_prev', userId))
                .setLabel('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 0),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('level_claim_all', userId))
                .setLabel(hasClaimable ? '🎁 Claim All' : 'Nothing to Claim')
                .setStyle(hasClaimable ? ButtonStyle.Success : ButtonStyle.Secondary)
                .setDisabled(!hasClaimable),
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('level_milestone_next', userId))
                .setLabel('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page >= totalPages - 1)
        );
        rows.push(actionRow);
    }
    
    return rows;
}

/**
 * Format feature name for display
 * @param {string} feature - Feature key
 * @returns {string}
 */
function formatFeatureName(feature) {
    const names = {
        BIOME_SYSTEM: '🌍 Biome System',
        REBIRTH: '♻️ Rebirth',
        QUEST_REROLL_DISCOUNT: '🔄 Quest Reroll Discount',
        EXTRA_FARM_SLOT: '🌾 Extra Farm Slot',
        MARKET_FEE_REDUCTION: '💹 Market Fee Reduction',
        PRAYER_COOLDOWN_REDUCTION: '🙏 Prayer Cooldown Reduction',
        CRAFT_SUCCESS_BOOST: '🛠️ Craft Success Boost',
        FARM_INCOME_BOOST: '💰 Farm Income Boost',
        EXTRA_DAILY_QUEST: '📋 Extra Daily Quest',
        LEGENDARY_PITY_REDUCTION: '⭐ Legendary Pity Reduction',
        MYTHICAL_RATE_BOOST: '🌟 Mythical Rate Boost'
    };
    return names[feature] || feature.replace(/_/g, ' ');
}

module.exports = {
    createLevelOverviewEmbed,
    createMilestonesEmbed,
    createFeatureUnlocksEmbed,
    createLevelUpEmbed,
    createMilestoneClaimedEmbed,
    createLevelButtons,
    formatFeatureName,
    COLORS
};
