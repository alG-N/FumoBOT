const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { formatNumber } = require('../../../Ultility/formatting');
const { buildSecureCustomId } = require('../../../Middleware/buttonOwnership');
const {
    REBIRTH_LEVEL_REQUIREMENT,
    REBIRTH_MILESTONES,
    getRebirthMultiplier,
    getMultiplierDescription,
    getRebirthTitle,
    getNextRebirthMilestone,
    getRebirthColor,
    getResetSummary,
    getPreservedSummary,
    formatRebirthDisplay
} = require('../../../Configuration/rebirthConfig');

const COLORS = {
    DEFAULT: '#5865F2',
    SUCCESS: '#00FF7F',
    WARNING: '#FFD700',
    DANGER: '#FF4444',
    REBIRTH: '#FF00FF'
};

/**
 * Create the main rebirth overview embed
 * @param {Object} user - Discord user
 * @param {Object} rebirthData - Rebirth status data
 * @param {Object} levelData - Level data
 * @returns {EmbedBuilder}
 */
function createRebirthOverviewEmbed(user, rebirthData, levelData) {
    const currentMult = getRebirthMultiplier(rebirthData.rebirth);
    const nextMult = getRebirthMultiplier(rebirthData.rebirth + 1);
    const title = getRebirthTitle(rebirthData.rebirth);
    const nextMilestone = getNextRebirthMilestone(rebirthData.rebirth);
    
    const embed = new EmbedBuilder()
        .setTitle(`♻️ ${user.username}'s Rebirth Status`)
        .setColor(getRebirthColor(rebirthData.rebirth))
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            {
                name: '📊 Current Status',
                value: [
                    `**Rebirth:** ${rebirthData.rebirth > 0 ? `♻️ ${rebirthData.rebirth}` : 'None'}`,
                    `**Title:** ${title.emoji} ${title.title}`,
                    `**Level:** ${levelData.level} / ${REBIRTH_LEVEL_REQUIREMENT}`,
                    `**Multiplier:** x${currentMult.toFixed(2)} 💰💎`
                ].join('\n'),
                inline: true
            },
            {
                name: '⬆️ Next Rebirth',
                value: [
                    `**Required:** Level ${REBIRTH_LEVEL_REQUIREMENT}`,
                    `**New Multiplier:** x${nextMult.toFixed(2)} 💰💎`,
                    `**Gain:** +${((nextMult - currentMult) * 100).toFixed(0)}% earnings`
                ].join('\n'),
                inline: true
            }
        );
    
    // Eligibility status
    if (rebirthData.canRebirth) {
        embed.addFields({
            name: '✅ ELIGIBLE FOR REBIRTH',
            value: [
                '**You can perform a rebirth now!**',
                'Click the **Rebirth** button to start.',
                '',
                '⚠️ **Warning:** This will reset most of your progress!'
            ].join('\n'),
            inline: false
        });
    } else {
        const levelsNeeded = REBIRTH_LEVEL_REQUIREMENT - levelData.level;
        embed.addFields({
            name: '🔒 Not Yet Eligible',
            value: [
                `You need **${levelsNeeded} more levels** to rebirth.`,
                `Current: Level ${levelData.level}`,
                `Required: Level ${REBIRTH_LEVEL_REQUIREMENT}`
            ].join('\n'),
            inline: false
        });
    }
    
    // Next milestone
    if (nextMilestone) {
        embed.addFields({
            name: `🎯 Next Milestone: ${nextMilestone.name}`,
            value: [
                `At **Rebirth ${nextMilestone.rebirth}**: ${nextMilestone.bonus}`,
                `Unlocks: ${nextMilestone.unlocks.join(', ')}`
            ].join('\n'),
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Use buttons below to navigate or perform rebirth' })
        .setTimestamp();
    
    return embed;
}

/**
 * Create confirmation embed before rebirth
 * @param {Object} user - Discord user
 * @param {Object} rebirthData - Current rebirth data
 * @returns {EmbedBuilder}
 */
function createRebirthConfirmEmbed(user, rebirthData) {
    const newRebirth = rebirthData.rebirth + 1;
    const newMult = getRebirthMultiplier(newRebirth);
    
    const resetList = getResetSummary();
    const keepList = getPreservedSummary();
    
    return new EmbedBuilder()
        .setTitle('⚠️ REBIRTH CONFIRMATION')
        .setColor(COLORS.WARNING)
        .setDescription([
            '**Are you absolutely sure you want to rebirth?**',
            '',
            'This action **CANNOT** be undone!'
        ].join('\n'))
        .addFields(
            {
                name: '❌ Will Be RESET',
                value: resetList.join('\n'),
                inline: true
            },
            {
                name: '✅ Will Be PRESERVED',
                value: keepList.join('\n'),
                inline: true
            },
            {
                name: '🎁 You Will Receive',
                value: [
                    `♻️ **Rebirth ${newRebirth}**`,
                    `💫 **x${newMult.toFixed(2)} Permanent Multiplier**`,
                    newRebirth === 1 ? '🌍 **Unlock: Other Place**' : ''
                ].filter(Boolean).join('\n'),
                inline: false
            }
        )
        .setFooter({ text: '⚠️ Select a fumo to keep, then confirm rebirth' })
        .setTimestamp();
}

/**
 * Create fumo selection embed
 * @param {Object} user - Discord user
 * @param {Object[]} fumos - Available fumos to choose from
 * @param {string|null} selectedFumo - Currently selected fumo name
 * @returns {EmbedBuilder}
 */
function createFumoSelectionEmbed(user, fumos, selectedFumo = null) {
    const embed = new EmbedBuilder()
        .setTitle('🌟 Select a Fumo to Keep')
        .setColor(COLORS.DEFAULT)
        .setDescription([
            '**Choose ONE fumo to keep after rebirth:**',
            '',
            'Your rarest fumos are shown below.',
            selectedFumo ? `\n**Currently Selected:** ${selectedFumo}` : '\n*No fumo selected yet*',
            '',
            '⚠️ All other fumos will be **permanently deleted**!'
        ].join('\n'));
    
    if (fumos.length === 0) {
        embed.addFields({
            name: '📦 No Fumos Found',
            value: 'You have no fumos to keep. You will start fresh after rebirth.',
            inline: false
        });
    } else {
        const fumoList = fumos.slice(0, 10).map((f, i) => {
            const selected = f.fumoName === selectedFumo ? '✅ ' : '';
            return `${selected}\`${i + 1}.\` **${f.fumoName}** (${f.rarity}) x${f.quantity}`;
        });
        
        embed.addFields({
            name: '📦 Your Rarest Fumos',
            value: fumoList.join('\n'),
            inline: false
        });
    }
    
    embed.setFooter({ text: 'Use the dropdown menu to select a fumo' })
        .setTimestamp();
    
    return embed;
}

/**
 * Create rebirth success embed
 * @param {Object} user - Discord user
 * @param {number} newRebirth - New rebirth count
 * @param {number} newMultiplier - New multiplier
 * @param {string|null} keptFumo - Name of kept fumo
 * @returns {EmbedBuilder}
 */
function createRebirthSuccessEmbed(user, newRebirth, newMultiplier, keptFumo) {
    const title = getRebirthTitle(newRebirth);
    const milestone = REBIRTH_MILESTONES.find(m => m.rebirth === newRebirth);
    
    const embed = new EmbedBuilder()
        .setTitle('🎊 REBIRTH COMPLETE!')
        .setColor(COLORS.REBIRTH)
        .setThumbnail(user.displayAvatarURL())
        .setDescription([
            `**${user.username}** has been reborn!`,
            '',
            `${title.emoji} You are now **${title.title}**`
        ].join('\n'))
        .addFields(
            {
                name: '♻️ Rebirth',
                value: `${newRebirth}`,
                inline: true
            },
            {
                name: '💫 Multiplier',
                value: `x${newMultiplier.toFixed(2)}`,
                inline: true
            },
            {
                name: '⭐ Kept Fumo',
                value: keptFumo || 'None',
                inline: true
            }
        );
    
    if (milestone) {
        embed.addFields({
            name: `🏆 Milestone Achieved: ${milestone.name}!`,
            value: [
                `**Bonus:** ${milestone.bonus}`,
                `**Unlocked:** ${milestone.unlocks.join(', ')}`
            ].join('\n'),
            inline: false
        });
    }
    
    if (newRebirth === 1) {
        embed.addFields({
            name: '🌍 NEW FEATURE UNLOCKED!',
            value: [
                '**Other Place** is now available!',
                'Send extra fumos to earn passive income.',
                'Access it through `.farm` command.'
            ].join('\n'),
            inline: false
        });
    }
    
    embed.addFields({
        name: '🚀 What\'s Next?',
        value: [
            '• Start collecting fumos again',
            '• Your earnings are now boosted!',
            '• Progress through Main Quests',
            '• Reach Level 100 for another rebirth'
        ].join('\n'),
        inline: false
    })
    .setFooter({ text: 'Your journey begins anew... with power!' })
    .setTimestamp();
    
    return embed;
}

/**
 * Create rebirth milestones embed
 * @param {Object} user - Discord user
 * @param {number} currentRebirth - Current rebirth count
 * @param {number[]} claimedMilestones - Array of claimed milestone rebirth levels
 * @returns {EmbedBuilder}
 */
function createMilestonesEmbed(user, currentRebirth, claimedMilestones = []) {
    const claimedSet = new Set(claimedMilestones);
    let hasUnclaimed = false;
    
    const milestoneLines = REBIRTH_MILESTONES.map(m => {
        const achieved = currentRebirth >= m.rebirth;
        const claimed = claimedSet.has(m.rebirth);
        const mult = getRebirthMultiplier(m.rebirth);
        
        let status;
        if (!achieved) {
            status = '🔒';
        } else if (claimed) {
            status = '✅';
        } else {
            status = '🎁';
            hasUnclaimed = true;
        }
        
        const rewardText = m.rewards ? 
            `💰 ${formatNumber(m.rewards.coins)} | 💎 ${formatNumber(m.rewards.gems)}` : 
            'No rewards';
        
        return [
            `${status} **Rebirth ${m.rebirth} - ${m.name}**`,
            `├ ${m.bonus}`,
            `├ x${mult.toFixed(2)} multiplier`,
            `├ Rewards: ${rewardText}`,
            `└ Unlocks: ${m.unlocks.join(', ')}`
        ].join('\n');
    });
    
    const legendText = hasUnclaimed ? 
        '\n🎁 = Claimable | ✅ = Claimed | 🔒 = Locked' : 
        '\n✅ = Claimed | 🔒 = Locked';
    
    return new EmbedBuilder()
        .setTitle(`🏆 ${user.username}'s Rebirth Milestones`)
        .setColor(getRebirthColor(currentRebirth))
        .setDescription([
            `Current Rebirth: **${currentRebirth}**`,
            legendText,
            '',
            milestoneLines.join('\n\n')
        ].join('\n'))
        .setFooter({ text: 'Each rebirth grants permanent bonuses!' })
        .setTimestamp();
}

/**
 * Create navigation buttons for rebirth command
 * @param {string} userId 
 * @param {string} currentView - 'overview', 'milestones', 'confirm'
 * @param {boolean} canRebirth - Whether user can rebirth
 * @param {number} unclaimedCount - Number of unclaimed milestones
 * @returns {ActionRowBuilder[]}
 */
function createRebirthButtons(userId, currentView = 'overview', canRebirth = false, unclaimedCount = 0) {
    const rows = [];
    
    // Navigation buttons
    const milestonesLabel = unclaimedCount > 0 ? `🏆 Milestones (${unclaimedCount})` : '🏆 Milestones';
    
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_overview', userId))
            .setLabel('📊 Overview')
            .setStyle(currentView === 'overview' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_milestones', userId))
            .setLabel(milestonesLabel)
            .setStyle(currentView === 'milestones' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_start', userId))
            .setLabel('♻️ Rebirth')
            .setStyle(canRebirth ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setDisabled(!canRebirth)
    );
    rows.push(navRow);
    
    // Add claim button if on milestones view and has unclaimed
    if (currentView === 'milestones' && unclaimedCount > 0) {
        const claimRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(buildSecureCustomId('rebirth_claim_all', userId))
                .setLabel(`🎁 Claim All Rewards (${unclaimedCount})`)
                .setStyle(ButtonStyle.Success)
        );
        rows.push(claimRow);
    }
    
    return rows;
}

/**
 * Create fumo selection dropdown
 * @param {string} userId 
 * @param {Object[]} fumos - Available fumos
 * @param {string|null} selectedFumo - Currently selected fumo
 * @returns {ActionRowBuilder}
 */
function createFumoSelectMenu(userId, fumos, selectedFumo = null) {
    if (fumos.length === 0) {
        return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(buildSecureCustomId('rebirth_fumo_select', userId))
                .setPlaceholder('No fumos available')
                .setDisabled(true)
                .addOptions([{ label: 'No fumos', value: 'none' }])
        );
    }
    
    const options = fumos.slice(0, 25).map((f, i) => ({
        label: f.fumoName.substring(0, 100),
        description: `${f.rarity} - x${f.quantity}`,
        value: f.fumoName.substring(0, 100),
        default: f.fumoName === selectedFumo
    }));
    
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(buildSecureCustomId('rebirth_fumo_select', userId))
            .setPlaceholder('Select a fumo to keep...')
            .addOptions(options)
    );
}

/**
 * Create confirmation buttons
 * @param {string} userId 
 * @param {boolean} fumoSelected - Whether a fumo has been selected
 * @returns {ActionRowBuilder}
 */
function createConfirmButtons(userId, fumoSelected = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_cancel', userId))
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_skip_fumo', userId))
            .setLabel('⏭️ Skip (Keep Nothing)')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('rebirth_confirm', userId))
            .setLabel('✅ CONFIRM REBIRTH')
            .setStyle(ButtonStyle.Danger)
    );
}

/**
 * Create claim success embed for rebirth milestones
 * @param {Object} user - Discord user
 * @param {Object[]} claimed - Array of claimed milestones
 * @param {Object} totalRewards - Total rewards object {coins, gems, tickets}
 * @returns {EmbedBuilder}
 */
function createClaimSuccessEmbed(user, claimed, totalRewards) {
    const claimedNames = claimed.map(m => `♻️ Rebirth ${m.rebirth} - ${m.name}`).join('\n');
    
    return new EmbedBuilder()
        .setTitle('🎁 Rebirth Milestone Rewards Claimed!')
        .setColor(COLORS.SUCCESS)
        .setThumbnail(user.displayAvatarURL())
        .setDescription([
            `**Claimed ${claimed.length} milestone${claimed.length > 1 ? 's' : ''}:**`,
            claimedNames,
            '',
            '**Total Rewards:**',
            `💰 **${formatNumber(totalRewards.coins)}** Coins`,
            `💎 **${formatNumber(totalRewards.gems)}** Gems`
        ].join('\n'))
        .setFooter({ text: 'Keep rebirthing for more rewards!' })
        .setTimestamp();
}

module.exports = {
    createRebirthOverviewEmbed,
    createRebirthConfirmEmbed,
    createFumoSelectionEmbed,
    createRebirthSuccessEmbed,
    createMilestonesEmbed,
    createClaimSuccessEmbed,
    createRebirthButtons,
    createFumoSelectMenu,
    createConfirmButtons,
    COLORS
};
