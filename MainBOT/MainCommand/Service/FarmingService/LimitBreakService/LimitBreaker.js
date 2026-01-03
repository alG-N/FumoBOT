const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { checkRestrictions } = require('../../../Middleware/restrictions');
const { checkButtonOwnership } = require('../../../Middleware/buttonOwnership');
const { get, run, all } = require('../../../Core/database');
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
    MILESTONE_STAGES,
    TRAIT_TAGS,
    extractTraitFromName,
    getBaseNameWithoutTrait
} = require('./LimitBreakRequirement');

// ============================================================
// TIER COLORS AND EMOJIS
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

/**
 * Calculate requirements using the new exponential scaling system
 */
function calculateRequirements(currentBreaks) {
    return calculateResourceRequirements(currentBreaks);
}

/**
 * Format fumo requirement for display
 */
function formatFumoRequirement(fumoReq, hasIt) {
    const icon = hasIt ? '✅' : '❌';
    let display = `${icon} **1x** ${fumoReq.name}`;
    
    if (fumoReq.allowAnyTrait) {
        display += ' *(any trait ok)*';
    } else if (fumoReq.allowHigherTrait) {
        display += ' *(or higher trait)*';
    }
    
    return display;
}

/**
 * Create the main limit breaker embed with tier information
 */
function createLimitBreakerEmbed(userId, currentBreaks, requirements, userRequirement, userInventory, fumoValidation) {
    const nextBreakNumber = currentBreaks + 1;
    const canBreak = currentBreaks < MAX_LIMIT_BREAKS;
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
            `Your total farm limit is now: **${5 + (userInventory.fragmentUses || 0) + currentBreaks}**`
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
    
    // Status field
    const progressBar = createProgressBar(currentBreaks, MAX_LIMIT_BREAKS, 15);
    embed.addFields({
        name: '📊 Limit Break Status',
        value: 
            `**Progress:** ${currentBreaks} / ${MAX_LIMIT_BREAKS}\n` +
            `${progressBar}\n` +
            `**Current Tier:** ${tier.emoji} ${tier.name}\n` +
            `**Total Farm Limit:** ${5 + (userInventory.fragmentUses || 0) + currentBreaks}`,
        inline: false
    });
    
    // Resource requirements
    const hasFragments = userInventory.fragments >= requirements.fragments;
    const hasNullified = userInventory.nullified >= requirements.nullified;
    
    embed.addFields({
        name: `💎 Resource Requirements (#${nextBreakNumber})`,
        value: 
            `${hasFragments ? '✅' : '❌'} **${requirements.fragments}x** FragmentOf1800s(R)\n` +
            `${hasNullified ? '✅' : '❌'} **${requirements.nullified}x** Nullified(?)`,
        inline: true
    });
    
    // Fumo requirements
    const fumoReqText = userRequirement.requirements.fumos.map((fumo, idx) => {
        const validation = fumoValidation[idx];
        return formatFumoRequirement(fumo, validation?.found);
    }).join('\n');
    
    embed.addFields({
        name: `🎭 Fumo Sacrifice${userRequirement.requirements.fumos.length > 1 ? 's' : ''}`,
        value: fumoReqText || 'None required',
        inline: true
    });
    
    // User inventory
    embed.addFields({
        name: '📦 Your Resources',
        value: 
            `Fragments: **${userInventory.fragments}**\n` +
            `Nullified: **${userInventory.nullified}**`,
        inline: false
    });
    
    // Next milestone info
    if (nextMilestone && nextMilestone !== nextBreakNumber) {
        const milestoneInfo = MILESTONE_STAGES[nextMilestone];
        embed.addFields({
            name: '🎯 Next Milestone',
            value: `**Stage ${nextMilestone}:** ${milestoneInfo.name}\n*${milestoneInfo.bonus}*`,
            inline: false
        });
    }
    
    // Tier progression info
    if (!milestone) {
        const tierProgress = getTierProgressText(nextBreakNumber);
        if (tierProgress) {
            embed.addFields({
                name: '📈 Tier Progression',
                value: tierProgress,
                inline: false
            });
        }
    }
    
    embed.setFooter({ 
        text: canBreak 
            ? `⚡ ${tier.emoji} ${tier.name} Tier | Stage ${nextBreakNumber}/${MAX_LIMIT_BREAKS}` 
            : '🎉 Maximum achieved!' 
    });
    
    embed.setTimestamp();

    return embed;
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

/**
 * Get tier progression text
 */
function getTierProgressText(stage) {
    const tier = getTierInfo(stage);
    const [min, max] = tier.range;
    const stagesInTier = stage - min;
    const totalInTier = max - min + 1;
    
    // Check for next tier
    const tierKeys = Object.keys(TIER_CONFIG);
    const currentIdx = tierKeys.indexOf(tier.key);
    const nextTier = currentIdx < tierKeys.length - 1 ? TIER_CONFIG[tierKeys[currentIdx + 1]] : null;
    
    let text = `**In ${tier.name}:** ${stagesInTier + 1}/${totalInTier} stages`;
    
    if (nextTier) {
        const stagesToNext = max - stage + 1;
        text += `\n**Next tier (${nextTier.emoji} ${nextTier.name}):** ${stagesToNext} stages away`;
    }
    
    return text;
}

module.exports = async (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        if (!message.content.startsWith('.limitbreaker') && !message.content.startsWith('.lb')) return;

        const restriction = checkRestrictions(message.author.id);
        if (restriction.blocked) {
            return message.reply({ embeds: [restriction.embed] });
        }

        const userId = message.author.id;

        try {
            // Get user's current limit break status
            const userRow = await get(
                `SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`,
                [userId]
            );

            const currentBreaks = userRow?.limitBreaks || 0;
            const fragmentUses = userRow?.fragmentUses || 0;

            // Get or generate requirement for user's current stage
            const userRequirement = getRequirementForUser(userId, currentBreaks + 1);
            const requirements = calculateRequirements(currentBreaks);

            // Get user's resources
            const fragmentRow = await get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, 'FragmentOf1800s(R)']
            );

            const nullifiedRow = await get(
                `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                [userId, 'Nullified(?)']
            );

            // Validate fumo requirements
            const fumoValidation = await validateUserHasFumos(userId, userRequirement.requirements.fumos);

            const userInventory = {
                fragments: fragmentRow?.quantity || 0,
                nullified: nullifiedRow?.quantity || 0,
                fragmentUses
            };

            // Create embed with new tier system
            const embed = createLimitBreakerEmbed(
                userId, 
                currentBreaks, 
                requirements, 
                userRequirement,
                userInventory,
                fumoValidation
            );

            // Check if user can perform limit break
            const hasAllResources = userInventory.fragments >= requirements.fragments &&
                                   userInventory.nullified >= requirements.nullified;
            const hasAllFumos = fumoValidation.every(v => v.found);
            const canBreak = currentBreaks < MAX_LIMIT_BREAKS && hasAllResources && hasAllFumos;

            // Encode fumo data for button (limit to prevent overflow)
            const fumoData = fumoValidation.map(v => v.id).filter(Boolean).join(',');
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`limitbreak_${userId}_${fumoData}`)
                        .setLabel('⚡ Perform Limit Break')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(!canBreak)
                );

            const msg = await message.reply({ 
                embeds: [embed],
                components: currentBreaks < MAX_LIMIT_BREAKS ? [row] : []
            });

            const collector = msg.createMessageComponentCollector({
                time: 120000 
            });

            collector.on('collect', async (interaction) => {
                if (!await checkButtonOwnership(interaction)) return;

                try {
                    await interaction.deferUpdate();

                    // Re-validate everything at time of click (prevent race conditions)
                    const checkRow = await get(
                        `SELECT limitBreaks, fragmentUses FROM userUpgrades WHERE userId = ?`,
                        [userId]
                    );

                    const breaks = checkRow?.limitBreaks || 0;

                    if (breaks >= MAX_LIMIT_BREAKS) {
                        return interaction.followUp({
                            content: '❌ You have already reached the maximum limit breaks!',
                            ephemeral: true
                        });
                    }

                    // Re-get requirements (stage might have changed)
                    const currentRequirement = getRequirementForUser(userId, breaks + 1);
                    const reqs = calculateRequirements(breaks);

                    // Re-validate resources
                    const fragCheck = await get(
                        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                        [userId, 'FragmentOf1800s(R)']
                    );

                    const nullCheck = await get(
                        `SELECT quantity FROM userInventory WHERE userId = ? AND itemName = ?`,
                        [userId, 'Nullified(?)']
                    );

                    const frags = fragCheck?.quantity || 0;
                    const nulls = nullCheck?.quantity || 0;

                    if (frags < reqs.fragments) {
                        return interaction.followUp({
                            content: `❌ You need ${reqs.fragments} FragmentOf1800s(R) but only have ${frags}!`,
                            ephemeral: true
                        });
                    }

                    if (nulls < reqs.nullified) {
                        return interaction.followUp({
                            content: `❌ You need ${reqs.nullified} Nullified(?) but only have ${nulls}!`,
                            ephemeral: true
                        });
                    }

                    // Re-validate fumo requirements
                    const fumoRevalidation = await validateUserHasFumos(userId, currentRequirement.requirements.fumos);
                    
                    const missingFumos = fumoRevalidation.filter(v => !v.found);
                    if (missingFumos.length > 0) {
                        return interaction.followUp({
                            content: `❌ Missing required fumo(s):\n${missingFumos.map(f => `• ${f.required}`).join('\n')}`,
                            ephemeral: true
                        });
                    }

                    // === PERFORM THE LIMIT BREAK ===
                    
                    // Consume fragments
                    await run(
                        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                        [reqs.fragments, userId, 'FragmentOf1800s(R)']
                    );

                    // Consume nullified
                    await run(
                        `UPDATE userInventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ?`,
                        [reqs.nullified, userId, 'Nullified(?)']
                    );

                    // Consume fumos
                    const consumedFumos = [];
                    for (const validation of fumoRevalidation) {
                        if (validation.id) {
                            await run(
                                `DELETE FROM userInventory WHERE id = ?`,
                                [validation.id]
                            );
                            consumedFumos.push(validation.actualName || validation.required);
                        }
                    }

                    // Update limit breaks
                    if (checkRow) {
                        await run(
                            `UPDATE userUpgrades SET limitBreaks = limitBreaks + 1 WHERE userId = ?`,
                            [userId]
                        );
                    } else {
                        await run(
                            `INSERT INTO userUpgrades (userId, limitBreaks, fragmentUses) VALUES (?, 1, 0)
                             ON CONFLICT(userId) DO UPDATE SET limitBreaks = limitBreaks + 1`,
                            [userId]
                        );
                    }

                    // Clear the requirement so next stage generates new one
                    clearRequirementForUser(userId);

                    const newBreaks = breaks + 1;
                    const totalLimit = 5 + (checkRow?.fragmentUses || 0) + newBreaks;
                    const tier = getTierInfo(newBreaks);
                    const milestone = getMilestoneInfo(newBreaks);

                    await logToDiscord(
                        client,
                        `User ${message.author.tag} performed Limit Break #${newBreaks} (${tier.name} Tier)`,
                        null,
                        LogLevel.ACTIVITY
                    );

                    // Create success embed
                    const successEmbed = new EmbedBuilder()
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
                            consumedFumos.map(f => `• 1x ${f}`).join('\n')
                        )
                        .setFooter({ text: `Progress: ${newBreaks} / ${MAX_LIMIT_BREAKS} | ${tier.emoji} ${tier.name} Tier` })
                        .setTimestamp();

                    // Add milestone bonus info if applicable
                    if (milestone) {
                        successEmbed.addFields({
                            name: '🎯 Milestone Bonus',
                            value: milestone.bonus,
                            inline: false
                        });
                    }

                    // Check for tier advancement
                    const previousTier = getTierInfo(newBreaks - 1);
                    if (tier.key !== previousTier.key) {
                        successEmbed.addFields({
                            name: '🎉 TIER ADVANCEMENT!',
                            value: `${previousTier.emoji} ${previousTier.name} → ${tier.emoji} ${tier.name}`,
                            inline: false
                        });
                    }

                    await interaction.editReply({
                        embeds: [successEmbed],
                        components: []
                    });

                } catch (error) {
                    console.error('Error in limit break button:', error);
                    await interaction.followUp({
                        content: '❌ An error occurred during the limit break.',
                        ephemeral: true
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    await msg.edit({ components: [] });
                } catch (error) {
                    // Message might be deleted
                }
            });

        } catch (error) {
            console.error('Error in .limitbreaker:', error);
            await logToDiscord(client, `Error in .limitbreaker for ${message.author.tag}`, error, LogLevel.ERROR);

            return message.reply({
                content: '⚠️ Something went wrong.',
                ephemeral: true
            });
        }
    });
};