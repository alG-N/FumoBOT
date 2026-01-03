const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../Core/database');
const { logToDiscord, LogLevel } = require('../../../Core/logger');
const { 
    getRequirementForUser, 
    clearRequirementForUser,
    validateUserHasFumos,
    getTierInfo,
    getMilestoneInfo,
    getNextMilestone,
    calculateResourceRequirements,
    MAX_LIMIT_BREAKS,
    TIER_CONFIG,
    TRAIT_TAGS,
    TRAIT_HIERARCHY
} = require('./LimitBreakRequirement');

// ============================================================
// TIER COLORS FOR UI
// ============================================================
const TIER_COLORS = {
    NOVICE: 0x90EE90,      // Light green
    ADEPT: 0x4169E1,       // Royal blue
    EXPERT: 0xFF6347,      // Tomato red
    MASTER: 0x9932CC,      // Dark orchid
    GRANDMASTER: 0xFFD700, // Gold
    TRANSCENDENT: 0xFF00FF // Magenta/cosmic
};

const MILESTONE_COLOR = 0xFF1493; // Deep pink for milestones

async function handleLimitBreakerInteraction(interaction, userId, message, client) {
    const { customId } = interaction;

    if (customId.startsWith('open_limitbreaker_')) {
        await openLimitBreakerMenu(interaction, userId);
    } 
    else if (customId.startsWith('limitbreak_confirm_')) {
        await handleLimitBreakConfirm(interaction, userId, message, client);
    }
    else if (customId.startsWith('limitbreak_back_')) {
        await handleLimitBreakBack(interaction, userId);
    }
}

async function openLimitBreakerMenu(interaction, userId) {
    await interaction.deferUpdate();

    try {
        const data = await getLimitBreakerData(userId);
        const embed = createLimitBreakerEmbed(data);
        const buttons = createLimitBreakerButtons(userId, data);

        await interaction.editReply({
            embeds: [embed],
            components: buttons
        });
    } catch (error) {
        console.error('Error opening limit breaker menu:', error);
        await interaction.followUp({
            content: '❌ Failed to open Limit Breaker menu.',
            ephemeral: true
        });
    }
}

async function handleLimitBreakBack(interaction, userId) {
    try {
        if (interaction.deferred || interaction.replied) {
            return;
        }
        await interaction.deferUpdate();
    } catch (error) {
        console.log('Interaction already handled:', error.message);
        return;
    }

    try {
        const username = interaction.user.username;
        
        const { getFarmStatusData, createFarmStatusEmbed } = require('../FarmStatusHelper');
        const farmData = await getFarmStatusData(userId, username);
        const embed = createFarmStatusEmbed(farmData);
        
        const mainButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`open_buildings_${userId}`)
                    .setLabel('🏗️ Farm Buildings')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`open_limitbreaker_${userId}`)
                    .setLabel('⚡ Limit Breaker')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [mainButtons]
        });
    } catch (error) {
        console.error('Error returning to farm:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.followUp({
                content: '❌ Failed to return to farm status.',
                ephemeral: true
            }).catch(() => {});
        }
    }
}

async function getLimitBreakerData(userId) {
    const userRow = await get(`SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
    const currentBreaks = userRow?.limitBreaks || 0;
    const fragmentUses = userRow?.fragmentUses || 0;

    const requirementData = getRequirementForUser(userId, currentBreaks + 1);
    const requirements = calculateResourceRequirements(currentBreaks); // Use the new function

    const fumoValidation = await validateUserHasFumos(userId, requirementData.requirements.fumos);

    const [fragmentRow, nullifiedRow] = await Promise.all([
        get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, 'FragmentOf1800s(R)']),
        get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, 'Nullified(?)'])
    ]);

    return {
        currentBreaks,
        fragmentUses,
        requirements,
        requiredFumos: requirementData.requirements.fumos,
        fumoValidation,
        inventory: {
            fragments: fragmentRow?.quantity || 0,
            nullified: nullifiedRow?.quantity || 0
        }
    };
}

async function handleLimitBreakConfirm(interaction, userId, message, client) {
    await interaction.deferUpdate();

    try {
        const checkRow = await get(`SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`, [userId]);
        const breaks = checkRow?.limitBreaks || 0;

        if (breaks >= MAX_LIMIT_BREAKS) {
            return interaction.followUp({
                content: '❌ You have already reached the maximum limit breaks!',
                ephemeral: true
            });
        }

        const requirementData = getRequirementForUser(userId, breaks + 1);
        const reqs = calculateResourceRequirements(breaks); // Use the new function
        
        const validation = await validateResources(userId, reqs, requirementData.requirements.fumos);

        if (!validation.valid) {
            return interaction.followUp({
                content: validation.error,
                ephemeral: true
            });
        }

        await consumeResources(userId, reqs, validation.fumoIds);
        
        if (checkRow) {
            await run(`UPDATE userUpgrades SET limitBreaks = limitBreaks + 1 WHERE userId = ?`, [userId]);
        } else {
            await run(
                `INSERT INTO userUpgrades (userId, limitBreaks, fragmentUses) VALUES (?, 1, 0)
                 ON CONFLICT(userId) DO UPDATE SET limitBreaks = limitBreaks + 1`,
                [userId]
            );
        }

        clearRequirementForUser(userId);

        const newBreaks = breaks + 1;
        const totalLimit = 5 + (checkRow?.fragmentUses || 0) + newBreaks;

        await logToDiscord(client, `User ${message.author.username} performed Limit Break #${newBreaks}`, null, LogLevel.ACTIVITY);

        const updatedData = await getLimitBreakerData(userId);
        const updatedEmbed = createLimitBreakerEmbed(updatedData);
        const updatedButtons = createLimitBreakerButtons(userId, updatedData);

        await interaction.editReply({
            embeds: [updatedEmbed],
            components: updatedButtons
        });

        const successEmbed = createSuccessEmbed(newBreaks, totalLimit, reqs, requirementData.requirements.fumos);
        await interaction.followUp({
            embeds: [successEmbed],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error in limit break confirm:', error);
        await interaction.followUp({
            content: '❌ An error occurred during the limit break.',
            ephemeral: true
        });
    }
}

async function validateResources(userId, reqs, requiredFumos) {
    const [fragCheck, nullCheck] = await Promise.all([
        get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, 'FragmentOf1800s(R)']),
        get(`SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`, [userId, 'Nullified(?)'])
    ]);

    const frags = fragCheck?.quantity || 0;
    const nulls = nullCheck?.quantity || 0;

    if (frags < reqs.fragments) {
        return { valid: false, error: `❌ You need ${reqs.fragments} FragmentOf1800s(R) but only have ${frags}!` };
    }
    if (nulls < reqs.nullified) {
        return { valid: false, error: `❌ You need ${reqs.nullified} Nullified(?) but only have ${nulls}!` };
    }

    const fumoValidation = await validateUserHasFumos(userId, requiredFumos);
    const missingFumos = fumoValidation.filter(v => !v.found);

    if (missingFumos.length > 0) {
        const missingList = missingFumos.map(m => m.required).join(', ');
        return { valid: false, error: `❌ You're missing required Fumos: ${missingList}` };
    }

    return { 
        valid: true, 
        fumoIds: fumoValidation.map(v => v.id)
    };
}

async function consumeResources(userId, reqs, fumoIds) {
    await Promise.all([
        run(`UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`, 
            [reqs.fragments, userId, 'FragmentOf1800s(R)']),
        run(`UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`, 
            [reqs.nullified, userId, 'Nullified(?)'])
    ]);

    for (const fumoId of fumoIds) {
        await run(`DELETE FROM userInventory WHERE id = ?`, [fumoId]);
    }
}

/**
 * Create a visual progress bar
 */
function createProgressBar(current, max, length = 10) {
    const percentage = current / max;
    const filled = Math.round(percentage * length);
    const empty = length - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return `${filledChar.repeat(filled)}${emptyChar.repeat(empty)} ${(percentage * 100).toFixed(1)}%`;
}

function createLimitBreakerEmbed(data) {
    const { currentBreaks, fragmentUses, requirements, requiredFumos, fumoValidation, inventory } = data;
    const nextBreakNumber = currentBreaks + 1;
    const canBreak = currentBreaks < MAX_LIMIT_BREAKS;
    
    // Get tier and milestone info
    const tier = getTierInfo(nextBreakNumber);
    const milestone = getMilestoneInfo(nextBreakNumber);
    const nextMilestone = getNextMilestone(nextBreakNumber);
    
    const embedColor = milestone ? MILESTONE_COLOR : (TIER_COLORS[tier.key] || 0xFFD700);

    const embed = new EmbedBuilder()
        .setTitle(milestone ? `🌟 MILESTONE: ${milestone.name}` : `⚡ Limit Breaker - ${tier.emoji} ${tier.name} Tier`)
        .setColor(canBreak ? embedColor : 0xFF0000);
    
    if (!canBreak) {
        embed.setDescription(
            '**🏆 MAXIMUM LIMIT BREAKS REACHED!**\n\n' +
            'You have achieved the ultimate transcendence!\n' +
            `Your total farm limit is now: **${5 + fragmentUses + currentBreaks}**`
        );
        return embed;
    }
    
    // Build description
    let description = '';
    if (milestone) {
        description += `**${milestone.bonus}**\n\n`;
    }
    description += `*${tier.description}*\n\n`;
    description += '**Break through your farming limits!**\n';
    description += 'Sacrifice specific items to gain additional farming slots.\n';
    
    embed.setDescription(description);

    // Status with progress bar
    const progressBar = createProgressBar(currentBreaks, MAX_LIMIT_BREAKS, 15);
    
    embed.addFields({
        name: '📊 Limit Break Status',
        value: 
            `**Progress:** ${currentBreaks} / ${MAX_LIMIT_BREAKS}\n` +
            `${progressBar}\n` +
            `**Current Tier:** ${tier.emoji} ${tier.name}\n` +
            `**Total Farm Limit:** ${5 + fragmentUses + currentBreaks}`,
        inline: false
    });

    // Resource requirements
    const hasFragments = inventory.fragments >= requirements.fragments;
    const hasNullified = inventory.nullified >= requirements.nullified;
    
    embed.addFields({
        name: `💎 Resource Requirements (#${nextBreakNumber})`,
        value: 
            `${hasFragments ? '✅' : '❌'} **${requirements.fragments}x** FragmentOf1800s(R)\n` +
            `${hasNullified ? '✅' : '❌'} **${requirements.nullified}x** Nullified(?)`,
        inline: true
    });

    // Fumo requirements with trait info
    let fumoRequirementText = '';
    for (let i = 0; i < requiredFumos.length; i++) {
        const req = requiredFumos[i];
        const validation = fumoValidation[i];
        const status = validation?.found ? '✅' : '❌';
        
        let displayName = req.name;
        if (req.allowAnyTrait) {
            displayName += ' *(any trait)*';
        } else if (req.allowHigherTrait) {
            displayName += ' *(or higher trait)*';
        }
        
        fumoRequirementText += `${status} **1x** ${displayName}\n`;
    }

    embed.addFields({
        name: `🎭 Fumo Sacrifice${requiredFumos.length > 1 ? 's' : ''}`,
        value: fumoRequirementText || 'None required',
        inline: true
    });

    // User inventory
    embed.addFields({
        name: '📦 Your Resources',
        value: 
            `Fragments: **${inventory.fragments}**\n` +
            `Nullified: **${inventory.nullified}**`,
        inline: false
    });

    // Next milestone info
    if (nextMilestone && nextMilestone !== nextBreakNumber) {
        const milestoneInfo = getMilestoneInfo(nextMilestone);
        if (milestoneInfo) {
            embed.addFields({
                name: '🎯 Next Milestone',
                value: `**Stage ${nextMilestone}:** ${milestoneInfo.name}\n*${milestoneInfo.bonus}*`,
                inline: false
            });
        }
    }

    // Tier progression info
    if (!milestone) {
        const [min, max] = tier.range;
        const stagesInTier = nextBreakNumber - min;
        const totalInTier = max - min + 1;
        const tierKeys = Object.keys(TIER_CONFIG);
        const currentIdx = tierKeys.indexOf(tier.key);
        const nextTier = currentIdx < tierKeys.length - 1 ? TIER_CONFIG[tierKeys[currentIdx + 1]] : null;
        
        let progressText = `**In ${tier.name}:** ${stagesInTier + 1}/${totalInTier} stages`;
        if (nextTier) {
            const stagesToNext = max - nextBreakNumber + 1;
            progressText += `\n**Next tier (${nextTier.emoji} ${nextTier.name}):** ${stagesToNext} stages away`;
        }
        
        embed.addFields({
            name: '📈 Tier Progression',
            value: progressText,
            inline: false
        });
    }

    embed.setFooter({ 
        text: `⚡ ${tier.emoji} ${tier.name} Tier | Stage ${nextBreakNumber}/${MAX_LIMIT_BREAKS}` 
    });
    
    embed.setTimestamp();

    return embed;
}

function getStageDescription(stage) {
    const tier = getTierInfo(stage);
    return `${tier.emoji} ${tier.name} - ${tier.description}`;
}

function createLimitBreakerButtons(userId, data) {
    const { currentBreaks, requirements, fumoValidation, inventory } = data;
    
    const hasFragments = inventory.fragments >= requirements.fragments;
    const hasNullified = inventory.nullified >= requirements.nullified;
    const hasFumos = fumoValidation.every(v => v.found);
    
    const canBreak = currentBreaks < MAX_LIMIT_BREAKS && hasFragments && hasNullified && hasFumos;

    const row = new ActionRowBuilder();
    
    if (currentBreaks < MAX_LIMIT_BREAKS) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`limitbreak_confirm_${userId}`)
                .setLabel('⚡ Perform Limit Break')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!canBreak)
        );
    }
    
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`limitbreak_back_${userId}`)
            .setLabel('◀️ Back to Farm')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row];
}

function createSuccessEmbed(newBreaks, totalLimit, reqs, requiredFumos) {
    const fumoList = requiredFumos.map(f => `• 1x ${f.name}`).join('\n');
    const tier = getTierInfo(newBreaks);
    const milestone = getMilestoneInfo(newBreaks);
    const previousTier = getTierInfo(newBreaks - 1);
    const tierAdvanced = tier.key !== previousTier.key;
    
    const embed = new EmbedBuilder()
        .setTitle(milestone ? `🌟 MILESTONE ACHIEVED: ${milestone.name}!` : '⚡ LIMIT BREAK SUCCESSFUL!')
        .setColor(milestone ? MILESTONE_COLOR : (TIER_COLORS[tier.key] || 0x00FF00))
        .setDescription(
            `**Congratulations!** You've broken through your limits!\n\n` +
            `${tier.emoji} **Tier:** ${tier.name}\n` +
            `**Limit Break:** #${newBreaks}\n` +
            `**New Farm Limit:** ${totalLimit} slots\n\n` +
            `**Items Consumed:**\n` +
            `• ${reqs.fragments}x FragmentOf1800s(R)\n` +
            `• ${reqs.nullified}x Nullified(?)\n` +
            fumoList
        )
        .setFooter({ text: `Progress: ${newBreaks} / ${MAX_LIMIT_BREAKS} | ${tier.emoji} ${tier.name} Tier` })
        .setTimestamp();
    
    // Add milestone bonus info
    if (milestone) {
        embed.addFields({
            name: '🎯 Milestone Bonus',
            value: milestone.bonus,
            inline: false
        });
    }
    
    // Add tier advancement notification
    if (tierAdvanced) {
        embed.addFields({
            name: '🎉 TIER ADVANCEMENT!',
            value: `${previousTier.emoji} ${previousTier.name} → ${tier.emoji} ${tier.name}`,
            inline: false
        });
    }
    
    return embed;
}

module.exports = {
    handleLimitBreakerInteraction,
    openLimitBreakerMenu,
    handleLimitBreakConfirm
};