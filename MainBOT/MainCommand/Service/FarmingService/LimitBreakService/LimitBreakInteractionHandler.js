const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { get, run } = require('../../../Core/database');
const { logToDiscord, LogLevel } = require('../../../Core/logger');
const { 
    getRequirementForUser, 
    clearRequirementForUser,
    validateUserHasFumos 
} = require('./LimitBreakRequirement');

const MAX_LIMIT_BREAKS = 150;

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
    const requirements = calculateRequirements(currentBreaks);

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
        const reqs = calculateRequirements(breaks);
        
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
            await run(`INSERT INTO userUpgrades (userId, limitBreaks, fragmentUses) VALUES (?, 1, 0)`, [userId]);
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

function calculateRequirements(currentBreaks) {
    const baseFragments = 10;
    const baseNullified = 1;
    
    const fragmentIncrease = Math.floor(currentBreaks / 10) * 3;
    const nullifiedIncrease = Math.floor(currentBreaks / 25);
    
    return {
        fragments: baseFragments + fragmentIncrease,
        nullified: baseNullified + nullifiedIncrease
    };
}

function createLimitBreakerEmbed(data) {
    const { currentBreaks, fragmentUses, requirements, requiredFumos, fumoValidation, inventory } = data;
    const nextBreakNumber = currentBreaks + 1;
    const canBreak = currentBreaks < MAX_LIMIT_BREAKS;

    const embed = new EmbedBuilder()
        .setTitle('⚡ Limit Breaker System')
        .setColor(canBreak ? 0xFFD700 : 0xFF0000)
        .setDescription(
            canBreak 
                ? '**Break through your farming limits!**\n\nSacrifice specific items to gain additional farming slots beyond the fragment limit.\n\n**Current Progress:**'
                : '**Maximum Limit Breaks Reached!**\n\nYou have reached the maximum of 150 limit breaks.'
        );

    if (canBreak) {
        const hasFragments = inventory.fragments >= requirements.fragments;
        const hasNullified = inventory.nullified >= requirements.nullified;

        let fumoRequirementText = '';
        for (let i = 0; i < requiredFumos.length; i++) {
            const req = requiredFumos[i];
            const validation = fumoValidation[i];
            const status = validation.found ? '✅' : '❌';
            
            let displayName = req.name;
            if (req.allowAnyTrait) {
                displayName = req.name.replace(/\[.*?\]/g, '') + ' (any variant)';
            }
            
            fumoRequirementText += `${status} **1x** ${displayName}\n`;
        }

        embed.addFields(
            {
                name: '📊 Limit Break Status',
                value: `Current Breaks: **${currentBreaks} / ${MAX_LIMIT_BREAKS}**\n` +
                       `Total Farm Limit: **${5 + fragmentUses + currentBreaks}**\n` +
                       `Next Stage: **${getStageDescription(nextBreakNumber)}**`,
                inline: false
            },
            {
                name: `💎 Next Break Requirements (#${nextBreakNumber})`,
                value: 
                    `${hasFragments ? '✅' : '❌'} **${requirements.fragments}x** FragmentOf1800s(R)\n` +
                    `${hasNullified ? '✅' : '❌'} **${requirements.nullified}x** Nullified(?)\n` +
                    fumoRequirementText,
                inline: false
            },
            {
                name: '📦 Your Inventory',
                value: 
                    `Fragments: **${inventory.fragments}**\n` +
                    `Nullified: **${inventory.nullified}**`,
                inline: false
            }
        );
    } else {
        embed.addFields({
            name: '🏆 Achievement Unlocked',
            value: `You have maxed out the Limit Breaker system!\nYour total farm limit is now: **${5 + fragmentUses + currentBreaks}**`,
            inline: false
        });
    }

    embed.setFooter({ 
        text: canBreak ? '⚡ Click the button below to perform a Limit Break' : '🎉 Congratulations on reaching the maximum!' 
    });

    return embed;
}

function getStageDescription(stage) {
    if (stage <= 50) return 'Easy (1 Fumo, any variant)';
    if (stage <= 100) return 'Medium (1 Higher Rarity Fumo, any variant)';
    return 'Hard (1 Fumo with trait required)';
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
    
    return new EmbedBuilder()
        .setTitle('⚡ LIMIT BREAK SUCCESSFUL!')
        .setColor(0x00FF00)
        .setDescription(
            `**Congratulations!** You've broken through your limits!\n\n` +
            `**Limit Break:** #${newBreaks}\n` +
            `**New Farm Limit:** ${totalLimit} slots\n` +
            `**Stage:** ${getStageDescription(newBreaks)}\n\n` +
            `**Items Consumed:**\n` +
            `• ${reqs.fragments}x FragmentOf1800s(R)\n` +
            `• ${reqs.nullified}x Nullified(?)\n` +
            fumoList
        )
        .setFooter({ text: `Progress: ${newBreaks} / ${MAX_LIMIT_BREAKS}` })
        .setTimestamp();
}

module.exports = {
    handleLimitBreakerInteraction,
    openLimitBreakerMenu,
    handleLimitBreakConfirm
};