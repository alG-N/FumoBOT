const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { 
    PRAY_CHARACTERS, 
    getFaithCostMultiplier, 
    getFaithRewardMultiplier, 
    getFaithTierUpgradeChance,
    getSanaeDonationCosts 
} = require('../../../../Configuration/prayConfig');
const { formatNumber } = require('../../../../Ultility/formatting');
const FumoPool = require('../../../../Data/FumoPool');
const { run, all, get } = require('../../../../Core/database');
const {
    getUserData,
    deductUserCurrency,
    updateUserCoins,
    updateUserLuck,
    addToInventory,
    deleteFumoFromInventory,
    incrementDailyPray,
    getSanaeData,
    updateSanaeData,
    checkSanaePrayImmunity
} = require('../../PrayDatabaseService');

const activeSanaeSessions = new Map();

/**
 * Get fumos of MYTHICAL+ rarity for Sanae offering
 * Fixed: Properly counts quantity and filters by rarity column
 */
async function getMythicalPlusFumos(userId, minRarities) {
    // Build LIKE conditions to extract rarity from fumoName
    const rarityConditions = minRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    // Define rarity order - LOWEST value = consume first
    const rarityOrder = {
        'MYTHICAL': 1,      // Consume first
        'EXCLUSIVE': 2,
        '???': 3,
        'ASTRAL': 4,
        'CELESTIAL': 5,
        'INFINITE': 6,
        'ETERNAL': 7,
        'TRANSCENDENT': 8   // Consume last (most valuable)
    };
    
    const orderCase = minRarities.map(r => 
        `WHEN fumoName LIKE '%(${r})%' THEN ${rarityOrder[r] || 99}`
    ).join('\n             ');
    
    const fumos = await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${minRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'MYTHICAL'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         AND COALESCE(quantity, 1) > 0
         ORDER BY 
           CASE 
             ${orderCase}
             ELSE 99
           END ASC`,
        [userId],
        true
    );
    
    return fumos || [];
}

/**
 * Get fumos of LEGENDARY+ rarity for Sanae offering
 * Fixed: Properly counts quantity and filters by rarity column
 */
async function getLegendaryPlusFumos(userId, minRarities) {
    // Build LIKE conditions to extract rarity from fumoName
    const rarityConditions = minRarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    // Define rarity order - LOWEST value = consume first
    const rarityOrder = {
        'LEGENDARY': 1,     // Consume first
        'MYTHICAL': 2,
        'EXCLUSIVE': 3,
        '???': 4,
        'ASTRAL': 5,
        'CELESTIAL': 6,
        'INFINITE': 7,
        'ETERNAL': 8,
        'TRANSCENDENT': 9   // Consume last (most valuable)
    };
    
    const orderCase = minRarities.map(r => 
        `WHEN fumoName LIKE '%(${r})%' THEN ${rarityOrder[r] || 99}`
    ).join('\n             ');
    
    const fumos = await all(
        `SELECT id, fumoName, COALESCE(quantity, 1) as quantity,
         CASE 
           ${minRarities.map(r => `WHEN fumoName LIKE '%(${r})%' THEN '${r}'`).join('\n           ')}
           ELSE 'LEGENDARY'
         END as rarity
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         ORDER BY 
           CASE 
             ${orderCase}
             ELSE 99
           END ASC`,
        [userId],
        true
    );
    
    return fumos || [];
}

/**
 * Get total count of fumos matching rarities
 */
async function getFumoCountByRarities(userId, rarities) {
    // Build LIKE conditions to extract rarity from fumoName
    const rarityConditions = rarities.map(r => `fumoName LIKE '%(${r})%' OR fumoName LIKE '%(${r})[%'`).join(' OR ');
    
    const result = await get(
        `SELECT COALESCE(SUM(COALESCE(quantity, 1)), 0) as total 
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND fumoName != ''
         AND (${rarityConditions})
         AND COALESCE(quantity, 1) > 0`,
        [userId],
        true
    );
    
    return result?.total || 0;
}

async function handleSanae(userId, channel) {
    const config = PRAY_CHARACTERS.SANAE;

    try {
        const [user, sanaeData] = await Promise.all([
            getUserData(userId),
            getSanaeData(userId)
        ]);

        if (!user) {
            await channel.send('❌ User data not found.');
            return;
        }

        const eventRoll = Math.random();
        const prayImmunity = await checkSanaePrayImmunity(userId);
        
        if (eventRoll < config.specialEvents.trainingChance && !prayImmunity.active) {
            await channel.send({
                embeds: [new EmbedBuilder()
                    .setTitle('🌊 Sanae is Training 🌊')
                    .setDescription(
                        'Sanae is currently training at the Moriya Shrine.\n' +
                        'She cannot offer blessings right now, but your faith has been noted.\n\n' +
                        `**Current Faith Points:** ${sanaeData.faithPoints}/${config.faithPoints.max}`
                    )
                    .setColor('#808080')
                    .setTimestamp()]
            });
            return;
        }

        if (sanaeData.faithPoints >= config.faithPoints.divineInterventionThreshold) {
            await handleDivineIntervention(userId, channel, config, sanaeData);
            return;
        }

        await sendDonationOptions(userId, channel, user, config, sanaeData);

    } catch (error) {
        console.error('[Sanae] Error:', error);
        await channel.send('❌ An error occurred during Sanae\'s prayer.');
    }
}

async function sendDonationOptions(userId, channel, user, config, sanaeData) {
    const faithPoints = sanaeData.faithPoints || 0;
    const costMult = getFaithCostMultiplier(faithPoints);
    const rewardMult = getFaithRewardMultiplier(faithPoints);
    
    // Fixed: Get actual fumo counts using proper queries
    const [mythicalFumos, legendaryFumos, totalMythical, totalLegendary] = await Promise.all([
        getMythicalPlusFumos(userId, config.mythicalPlusRarities),
        getLegendaryPlusFumos(userId, config.legendaryPlusRarities),
        getFumoCountByRarities(userId, config.mythicalPlusRarities),
        getFumoCountByRarities(userId, config.legendaryPlusRarities)
    ]);

    const costA = getSanaeDonationCosts('A', faithPoints);
    const costB = getSanaeDonationCosts('B', faithPoints);
    const costC = getSanaeDonationCosts('C', faithPoints);
    const costD = getSanaeDonationCosts('D', faithPoints);

    const requiredMythical = costC.fumoRequirement?.count || 3;
    const requiredLegendary = costD.fumoRequirement?.count || 1;

    const canAffordA = user.coins >= costA.coins;
    const canAffordB = user.gems >= costB.gems;
    const canAffordC = totalMythical >= requiredMythical;
    const canAffordD = user.coins >= costD.coins && user.gems >= costD.gems && totalLegendary >= requiredLegendary;

    const costMultPercent = Math.round((costMult - 1) * 100);
    const rewardMultPercent = Math.round((rewardMult - 1) * 100);

    const embed = new EmbedBuilder()
        .setTitle('🌊⛩️ Sanae Kochiya - Faith Exchange ⛩️🌊')
        .setDescription(
            '*The living goddess of the Moriya Shrine appears before you...*\n\n' +
            '**"Your faith shall be rewarded. Choose your offering."**\n\n' +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Current Faith Points:** ${faithPoints}/${config.faithPoints.max}\n` +
            `**Cost Scaling:** ${costMultPercent > 0 ? `+${costMultPercent}%` : 'Base'}\n` +
            `**Reward Scaling:** ${rewardMultPercent > 0 ? `+${rewardMultPercent}%` : 'Base'}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
            {
                name: '💰 Option A: Coin Offering',
                value: `${canAffordA ? '✅' : '❌'} ${formatNumber(costA.coins)} coins → **1 Faith Point**\nYou have: ${formatNumber(user.coins)} coins`,
                inline: true
            },
            {
                name: '💎 Option B: Gem Offering',
                value: `${canAffordB ? '✅' : '❌'} ${formatNumber(costB.gems)} gems → **2 Faith Points**\nYou have: ${formatNumber(user.gems)} gems`,
                inline: true
            },
            {
                name: '🎴 Option C: Fumo Sacrifice',
                value: `${canAffordC ? '✅' : '❌'} ${requiredMythical} MYTHICAL+ fumos → **3 Faith Points**\nYou have: **${totalMythical}** eligible fumos`,
                inline: true
            },
            {
                name: '✨ Option D: Combo Offering',
                value: `${canAffordD ? '✅' : '❌'} ${formatNumber(costD.coins)} coins + ${formatNumber(costD.gems)} gems + ${requiredLegendary} LEGENDARY+ fumo → **4 Faith Points**\nYou have: **${totalLegendary}** eligible fumos`,
                inline: true
            }
        )
        .addFields({
            name: '📊 Faith Point Milestones & Scaling',
            value: 
                `• **5 FP:** Reroll blessing (+25% cost, +50% rewards)\n` +
                `• **10 FP:** Unlock 4th blessing (+50% cost, +100% rewards)\n` +
                `• **15 FP:** Upgrade blessing tiers (+100% cost, +200% rewards)\n` +
                `• **20 FP:** 🌟 DIVINE INTERVENTION (+150% cost, +400% rewards)`,
            inline: false
        })
        .setColor(config.color)
        .setThumbnail(config.picture)
        .setFooter({ text: `Faith Points persist! Higher faith = higher costs but MUCH higher rewards!` })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sanae_donate_A_${userId}`)
            .setLabel(`💰 ${formatNumber(costA.coins)}c`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordA),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_B_${userId}`)
            .setLabel(`💎 ${formatNumber(costB.gems)}g`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordB),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_C_${userId}`)
            .setLabel(`🎴 ${requiredMythical} Fumos`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordC),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_D_${userId}`)
            .setLabel('✨ Combo')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canAffordD)
    );

    const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sanae_cancel_${userId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ 
        embeds: [embed], 
        components: [row, cancelRow] 
    });

    activeSanaeSessions.set(userId, {
        messageId: msg.id,
        channelId: channel.id,
        mythicalFumos,
        legendaryFumos,
        totalMythical,
        totalLegendary,
        faithPoints
    });

    const filter = (i) => {
        const parts = i.customId.split('_');
        return parts[0] === 'sanae' && parts[parts.length - 1] === userId;
    };
    
    const collector = msg.createMessageComponentCollector({ filter, time: 120000 });

    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: '❌ This is not your prayer session!', ephemeral: true });
            return;
        }

        const parts = interaction.customId.split('_');
        const action = parts[1];

        try {
            if (action === 'cancel') {
                activeSanaeSessions.delete(userId);
                await interaction.update({
                    embeds: [new EmbedBuilder()
                        .setTitle('🌊 Prayer Cancelled')
                        .setDescription('You step away from the shrine...')
                        .setColor('#808080')
                        .setTimestamp()],
                    components: []
                });
                collector.stop('cancelled');
                return;
            }

            if (action === 'donate') {
                const option = parts[2];
                await handleDonation(interaction, userId, option, config, collector, msg);
                return;
            }

            if (action === 'blessing') {
                const blessingIndex = parseInt(parts[2]);
                await handleBlessingSelection(interaction, userId, blessingIndex, config);
                collector.stop('blessed');
                return;
            }

            if (action === 'reroll') {
                await handleReroll(interaction, userId, config);
                return;
            }
        } catch (error) {
            console.error('[Sanae] Button handler error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => {});
            }
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            activeSanaeSessions.delete(userId);
            msg.edit({ components: [] }).catch(() => {});
        }
    });
}

async function handleDonation(interaction, userId, option, config, collector, msg) {
    await interaction.deferUpdate();

    const session = activeSanaeSessions.get(userId);
    if (!session) {
        await interaction.followUp({ content: '❌ Session expired!', ephemeral: true });
        return;
    }

    const sanaeData = await getSanaeData(userId);
    const faithPoints = sanaeData.faithPoints || 0;
    const costs = getSanaeDonationCosts(option, faithPoints);
    
    let faithGained = costs.faithPoints;
    let consumedItems = [];
    let costDescription = '';

    try {
        if (option === 'A') {
            await deductUserCurrency(userId, costs.coins, 0);
            costDescription = `${formatNumber(costs.coins)} coins`;
        } else if (option === 'B') {
            await deductUserCurrency(userId, 0, costs.gems);
            costDescription = `${formatNumber(costs.gems)} gems`;
        } else if (option === 'C') {
            const fumoCount = costs.fumoRequirement?.count || 3;
            let remaining = fumoCount;
            for (const fumo of session.mythicalFumos) {
                if (remaining <= 0) break;
                const toConsume = Math.min(fumo.quantity || 1, remaining);
                await deleteFumoFromInventory(userId, fumo.id, toConsume);
                consumedItems.push(`${fumo.fumoName} x${toConsume}`);
                remaining -= toConsume;
            }
            costDescription = `${fumoCount} MYTHICAL+ fumos`;
        } else if (option === 'D') {
            await deductUserCurrency(userId, costs.coins, costs.gems);
            const fumoToConsume = session.legendaryFumos[0];
            if (fumoToConsume) {
                await deleteFumoFromInventory(userId, fumoToConsume.id, 1);
                consumedItems.push(fumoToConsume.fumoName);
            }
            costDescription = `${formatNumber(costs.coins)} coins + ${formatNumber(costs.gems)} gems + 1 LEGENDARY+ fumo`;
        }

        const newFaithPoints = Math.min(faithPoints + faithGained, config.faithPoints.max);
        await updateSanaeData(userId, { faithPoints: newFaithPoints });

        const eventRoll = Math.random();
        let miracleSurge = false;
        let divineScam = false;

        const prayImmunity = await checkSanaePrayImmunity(userId);

        if (eventRoll < config.specialEvents.divineScamChance && !prayImmunity.active) {
            divineScam = true;
        } else if (eventRoll < config.specialEvents.divineScamChance + config.specialEvents.miracleSurgeChance) {
            miracleSurge = true;
        }

        if (divineScam) {
            await updateSanaeData(userId, { faithPoints: 0 });
            
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setTitle('⚡ Kanako\'s Intervention! ⚡')
                    .setDescription(
                        '*Suddenly, Kanako appears and intercepts your offering!*\n\n' +
                        '**"I\'ll be taking this faith for myself, mortal."**\n\n' +
                        `You paid: ${costDescription}\n` +
                        'Your Faith Points have been consumed by Kanako!\n' +
                        '(This is a 3% chance event - better luck next time!)'
                    )
                    .setColor('#FF4500')
                    .setTimestamp()],
                components: []
            });
            
            activeSanaeSessions.delete(userId);
            collector.stop('scammed');
            await incrementDailyPray(userId);
            return;
        }

        session.faithPoints = newFaithPoints;
        activeSanaeSessions.set(userId, session);

        await showBlessingOptions(interaction, userId, config, newFaithPoints, miracleSurge, consumedItems, faithGained, costDescription);
    } catch (error) {
        console.error('[Sanae] Donation error:', error);
        await interaction.followUp({ content: '❌ An error occurred during donation.', ephemeral: true }).catch(() => {});
    }
}

async function showBlessingOptions(interaction, userId, config, faithPoints, miracleSurge, consumedItems, faithGained, costDescription) {
    const upgradeTiers = faithPoints >= config.faithPoints.upgradeTierThreshold;
    const fourthBlessing = faithPoints >= config.faithPoints.fourthBlessingThreshold;
    const canReroll = faithPoints >= config.faithPoints.rerollThreshold;
    
    const rewardMult = getFaithRewardMultiplier(faithPoints);
    const tierUpgradeChance = getFaithTierUpgradeChance(faithPoints);

    const blessingCount = fourthBlessing ? 4 : 3;
    const blessings = [];

    for (let i = 0; i < blessingCount; i++) {
        const blessing = rollBlessing(config, upgradeTiers, miracleSurge, tierUpgradeChance, rewardMult);
        blessings.push(blessing);
    }

    const session = activeSanaeSessions.get(userId) || {};
    session.currentBlessings = blessings;
    session.canReroll = canReroll;
    session.rerollUsed = false;
    session.miracleSurge = miracleSurge;
    session.upgradeTiers = upgradeTiers;
    session.faithPoints = faithPoints;
    session.rewardMult = rewardMult;
    activeSanaeSessions.set(userId, session);

    const rewardMultPercent = Math.round((rewardMult - 1) * 100);

    const embed = new EmbedBuilder()
        .setTitle('🌊⛩️ Divine Blessings Revealed ⛩️🌊')
        .setDescription(
            `${miracleSurge ? '✨ **MIRACLE SURGE!** All blessings upgraded by one tier! ✨\n\n' : ''}` +
            `**Faith Offered:** +${faithGained} points (Cost: ${costDescription})\n` +
            `${consumedItems.length > 0 ? `**Items Consumed:** ${consumedItems.join(', ')}\n` : ''}` +
            `**Current Faith:** ${faithPoints}/${config.faithPoints.max}\n` +
            `**Reward Bonus:** +${rewardMultPercent}% on all rewards!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Choose your blessing:**`
        )
        .setColor(miracleSurge ? 0xFFD700 : config.color)
        .setTimestamp();

    blessings.forEach((blessing, index) => {
        embed.addFields({
            name: `${index + 1}. ${getTierEmoji(blessing.tier)} ${blessing.name} (${blessing.tier})`,
            value: formatBlessingRewards(blessing.rewards, rewardMult),
            inline: false
        });
    });

    const components = [];
    
    const row1Buttons = blessings.slice(0, 2).map((blessing, index) => 
        new ButtonBuilder()
            .setCustomId(`sanae_blessing_${index}_${userId}`)
            .setLabel(`${index + 1}. ${blessing.name}`)
            .setStyle(getButtonStyle(blessing.tier))
    );
    if (row1Buttons.length > 0) {
        components.push(new ActionRowBuilder().addComponents(row1Buttons));
    }

    if (blessings.length > 2) {
        const row2Buttons = blessings.slice(2).map((blessing, index) => 
            new ButtonBuilder()
                .setCustomId(`sanae_blessing_${index + 2}_${userId}`)
                .setLabel(`${index + 3}. ${blessing.name}`)
                .setStyle(getButtonStyle(blessing.tier))
        );
        components.push(new ActionRowBuilder().addComponents(row2Buttons));
    }

    if (canReroll && !session.rerollUsed) {
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sanae_reroll_${userId}`)
                .setLabel('🔄 Reroll All (Costs 5 Faith)')
                .setStyle(ButtonStyle.Secondary)
        ));
    }

    await interaction.editReply({
        embeds: [embed],
        components
    });
}

async function handleReroll(interaction, userId, config) {
    const session = activeSanaeSessions.get(userId);
    
    if (!session || session.rerollUsed) {
        await interaction.reply({ content: '❌ You cannot reroll!', ephemeral: true });
        return;
    }

    const sanaeData = await getSanaeData(userId);
    if (sanaeData.faithPoints < 5) {
        await interaction.reply({ content: '❌ Not enough Faith Points to reroll! (Need 5)', ephemeral: true });
        return;
    }

    await interaction.deferUpdate();

    const newFaithPoints = sanaeData.faithPoints - 5;
    await updateSanaeData(userId, { faithPoints: newFaithPoints });
    session.rerollUsed = true;
    session.faithPoints = newFaithPoints;
    
    const rewardMult = getFaithRewardMultiplier(newFaithPoints);
    const tierUpgradeChance = getFaithTierUpgradeChance(newFaithPoints);
    session.rewardMult = rewardMult;

    const blessings = [];
    const blessingCount = session.currentBlessings.length;

    for (let i = 0; i < blessingCount; i++) {
        const blessing = rollBlessing(config, session.upgradeTiers, session.miracleSurge, tierUpgradeChance, rewardMult);
        blessings.push(blessing);
    }

    session.currentBlessings = blessings;
    activeSanaeSessions.set(userId, session);

    const rewardMultPercent = Math.round((rewardMult - 1) * 100);

    const embed = new EmbedBuilder()
        .setTitle('🔄 Blessings Rerolled! 🔄')
        .setDescription(
            `**Faith Spent:** 5 points\n` +
            `**Remaining Faith:** ${newFaithPoints}/${config.faithPoints.max}\n` +
            `**Reward Bonus:** +${rewardMultPercent}%\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**New blessings revealed:**`
        )
        .setColor(config.color)
        .setTimestamp();

    blessings.forEach((blessing, index) => {
        embed.addFields({
            name: `${index + 1}. ${getTierEmoji(blessing.tier)} ${blessing.name} (${blessing.tier})`,
            value: formatBlessingRewards(blessing.rewards, rewardMult),
            inline: false
        });
    });

    const components = [];
    
    const row1Buttons = blessings.slice(0, 2).map((blessing, index) => 
        new ButtonBuilder()
            .setCustomId(`sanae_blessing_${index}_${userId}`)
            .setLabel(`${index + 1}. ${blessing.name}`)
            .setStyle(getButtonStyle(blessing.tier))
    );
    if (row1Buttons.length > 0) {
        components.push(new ActionRowBuilder().addComponents(row1Buttons));
    }

    if (blessings.length > 2) {
        const row2Buttons = blessings.slice(2).map((blessing, index) => 
            new ButtonBuilder()
                .setCustomId(`sanae_blessing_${index + 2}_${userId}`)
                .setLabel(`${index + 3}. ${blessing.name}`)
                .setStyle(getButtonStyle(blessing.tier))
        );
        components.push(new ActionRowBuilder().addComponents(row2Buttons));
    }

    await interaction.editReply({
        embeds: [embed],
        components
    });
}

async function handleBlessingSelection(interaction, userId, blessingIndex, config) {
    await interaction.deferUpdate();

    const session = activeSanaeSessions.get(userId);
    if (!session || !session.currentBlessings) {
        await interaction.followUp({ content: '❌ Session expired!', ephemeral: true });
        return;
    }

    const blessing = session.currentBlessings[blessingIndex];
    if (!blessing) {
        await interaction.followUp({ content: '❌ Invalid blessing selection!', ephemeral: true });
        return;
    }

    const rewardMult = session.rewardMult || 1;

    try {
        const rewardsSummary = await applyBlessingRewards(userId, blessing.rewards, config, rewardMult);

        const rewardMultPercent = Math.round((rewardMult - 1) * 100);

        const embed = new EmbedBuilder()
            .setTitle(`🌟 ${blessing.name} Bestowed! 🌟`)
            .setDescription(
                `*Sanae smiles warmly as divine energy flows through you...*\n\n` +
                `**Blessing Tier:** ${getTierEmoji(blessing.tier)} ${blessing.tier}\n` +
                `**Faith Bonus Applied:** +${rewardMultPercent}%\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `**Rewards Received:**\n${rewardsSummary}`
            )
            .setColor(getTierColor(blessing.tier))
            .setThumbnail(config.picture)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            components: []
        });

        activeSanaeSessions.delete(userId);
        await incrementDailyPray(userId);
    } catch (error) {
        console.error('[Sanae] Blessing application error:', error);
        await interaction.followUp({ content: '❌ Error applying blessing rewards.', ephemeral: true }).catch(() => {});
    }
}

async function handleDivineIntervention(userId, channel, config, sanaeData) {
    const miracleBlessing = config.blessingTiers.MIRACLE.blessings[0];
    const faithPoints = sanaeData.faithPoints;
    const rewardMult = getFaithRewardMultiplier(faithPoints);
    
    await updateSanaeData(userId, { faithPoints: 0 });

    const rewardsSummary = await applyBlessingRewards(userId, miracleBlessing.rewards, config, rewardMult);

    const rewardMultPercent = Math.round((rewardMult - 1) * 100);

    const embed = new EmbedBuilder()
        .setTitle('🌟✨ DIVINE INTERVENTION ✨🌟')
        .setDescription(
            '*The heavens open as Sanae channels the full power of the Moriya Gods...*\n\n' +
            '**You have reached 20 Faith Points!**\n' +
            `**Maximum Faith Bonus Applied:** +${rewardMultPercent}%\n\n` +
            `**${miracleBlessing.name}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Divine Rewards:**\n${rewardsSummary}\n\n` +
            `*Your Faith Points have been reset to 0.*`
        )
        .setColor(0xFFD700)
        .setImage(config.picture)
        .setTimestamp();

    await channel.send({ embeds: [embed] });
    await incrementDailyPray(userId);
}

async function applyBlessingRewards(userId, rewards, config, rewardMult = 1) {
    const summary = [];
    const now = Date.now();

    if (rewards.coins) {
        const scaledCoins = Math.floor(rewards.coins * rewardMult);
        await updateUserCoins(userId, scaledCoins, 0);
        summary.push(`💰 **+${formatNumber(scaledCoins)} coins**`);
    }

    if (rewards.gems) {
        const scaledGems = Math.floor(rewards.gems * rewardMult);
        await updateUserCoins(userId, 0, scaledGems);
        summary.push(`💎 **+${formatNumber(scaledGems)} gems**`);
    }

    if (rewards.luck) {
        const scaledLuck = rewards.luck.amount * Math.min(rewardMult, 2);
        if (rewards.luck.permanent) {
            const MAX_PERMANENT_LUCK = 5.0; // 500% cap
            
            // Get current luck to check if we'll hit cap
            const currentData = await get(
                `SELECT luck FROM userCoins WHERE userId = ?`,
                [userId]
            );
            const currentLuck = currentData?.luck || 0;
            const newTotal = Math.min(currentLuck + scaledLuck, MAX_PERMANENT_LUCK);
            const actualAdded = newTotal - currentLuck;
            
            await updateUserLuck(userId, scaledLuck);
            
            if (actualAdded < scaledLuck) {
                summary.push(`🍀 **+${(actualAdded * 100).toFixed(1)}% permanent luck** (Capped at ${(MAX_PERMANENT_LUCK * 100).toFixed(0)}%!)`);
            } else {
                summary.push(`🍀 **+${(scaledLuck * 100).toFixed(1)}% permanent luck** (Total: ${(newTotal * 100).toFixed(1)}%)`);
            }
        } else {
            const expiry = now + rewards.luck.duration;
            const hours = Math.floor(rewards.luck.duration / (60 * 60 * 1000));
            
            // Check for existing Sanae luck boost
            const existingBoost = await get(
                `SELECT multiplier, expiresAt FROM activeBoosts 
                 WHERE userId = ? AND type = 'luck' AND source = 'SanaeBlessing'`,
                [userId]
            );
            
            // Convert luck amount to multiplier (0.50 = +50% = x1.5, 9.0 = +900% = x10)
            const newMultiplier = 1 + scaledLuck;
            
            // Cap the total multiplier at x10 (changed from x50)
            const MAX_LUCK_MULTIPLIER = 10;
            
            if (existingBoost && existingBoost.expiresAt > now) {
                // Use additive stacking with a cap
                const existingBonus = existingBoost.multiplier - 1;
                const newBonus = newMultiplier - 1;
                const combinedBonus = existingBonus + newBonus;
                
                const cappedMultiplier = Math.min(1 + combinedBonus, MAX_LUCK_MULTIPLIER);
                
                // Extend expiry to the longer of the two
                const newExpiry = Math.max(existingBoost.expiresAt, expiry);
                
                await run(
                    `UPDATE activeBoosts 
                     SET multiplier = ?, expiresAt = ?
                     WHERE userId = ? AND type = 'luck' AND source = 'SanaeBlessing'`,
                    [cappedMultiplier, newExpiry, userId]
                );
                
                if (cappedMultiplier >= MAX_LUCK_MULTIPLIER) {
                    summary.push(`🍀 **x${newMultiplier.toFixed(2)} luck added → x${cappedMultiplier.toFixed(2)} total (MAX!) for ${hours}h**`);
                } else {
                    summary.push(`🍀 **x${newMultiplier.toFixed(2)} luck added → x${cappedMultiplier.toFixed(2)} total for ${hours}h**`);
                }
            } else {
                // No existing boost, insert new one (also cap single blessing)
                const cappedNewMultiplier = Math.min(newMultiplier, MAX_LUCK_MULTIPLIER);
                
                await run(
                    `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
                     VALUES (?, 'luck', 'SanaeBlessing', ?, ?)`,
                    [userId, cappedNewMultiplier, expiry]
                );
                
                if (cappedNewMultiplier >= MAX_LUCK_MULTIPLIER) {
                    summary.push(`🍀 **x${cappedNewMultiplier.toFixed(2)} luck (MAX!) for ${hours}h**`);
                } else {
                    summary.push(`🍀 **x${cappedNewMultiplier.toFixed(2)} luck for ${hours}h**`);
                }
            }
        }
    }

    if (rewards.boost) {
        const expiry = now + rewards.boost.duration;
        await run(
            `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
             VALUES (?, ?, 'SanaeBlessing', ?, ?)`,
            [userId, rewards.boost.type, rewards.boost.multiplier, expiry]
        );
        const hours = Math.floor(rewards.boost.duration / (60 * 60 * 1000));
        summary.push(`⚡ **x${rewards.boost.multiplier} ${rewards.boost.type} boost for ${hours}h**`);
    }

    if (rewards.items) {
        for (const item of rewards.items) {
            const scaledQty = Math.floor(item.quantity * rewardMult);
            await addToInventory(userId, item.name, scaledQty);
            summary.push(`📦 **${scaledQty}x ${item.name}**`);
        }
    }

    if (rewards.fumo) {
        const prayFumos = FumoPool.getForPray();
        const filteredFumos = prayFumos.filter(f => f.rarity === rewards.fumo.rarity);
        if (filteredFumos.length > 0) {
            const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];
            await run(
                `INSERT INTO userInventory (userId, fumoName, rarity, quantity) VALUES (?, ?, ?, 1)`,
                [userId, fumo.name, fumo.rarity]
            );
            summary.push(`🎴 **${fumo.name}** (${fumo.rarity})`);
        }
    }

    if (rewards.craftDiscount) {
        const expiry = now + rewards.craftDiscount.duration;
        await updateSanaeData(userId, {
            craftDiscount: rewards.craftDiscount.percent,
            craftDiscountExpiry: expiry
        });
        const hours = Math.floor(rewards.craftDiscount.duration / (60 * 60 * 1000));
        summary.push(`🔨 **${rewards.craftDiscount.percent}% craft discount for ${hours}h**`);
    }

    if (rewards.freeCrafts) {
        const expiry = now + rewards.freeCrafts.duration;
        await updateSanaeData(userId, { freeCraftsExpiry: expiry });
        const days = Math.floor(rewards.freeCrafts.duration / (24 * 60 * 60 * 1000));
        summary.push(`🆓 **Free crafts for ${days} days** (no coin/gem cost)`);
    }

    if (rewards.craftProtection) {
        const sanaeData = await getSanaeData(userId);
        const current = sanaeData.craftProtection || 0;
        await updateSanaeData(userId, { 
            craftProtection: current + Math.floor(rewards.craftProtection.nullifyFails * rewardMult)
        });
        summary.push(`🛡️ **${Math.floor(rewards.craftProtection.nullifyFails * rewardMult)} craft fail protections**`);
    }

    if (rewards.prayImmunity) {
        const expiry = now + rewards.prayImmunity.duration;
        await updateSanaeData(userId, { prayImmunityExpiry: expiry });
        const days = Math.floor(rewards.prayImmunity.duration / (24 * 60 * 60 * 1000));
        summary.push(`🙏 **Pray penalty immunity for ${days} days**`);
    }

    if (rewards.guaranteedRarity) {
        const scaledRolls = Math.floor(rewards.guaranteedRarity.rolls * rewardMult);
        await updateSanaeData(userId, {
            guaranteedRarityRolls: scaledRolls,
            guaranteedMinRarity: rewards.guaranteedRarity.minRarity
        });
        summary.push(`🎲 **Next ${scaledRolls} pulls guarantee ${rewards.guaranteedRarity.minRarity}+**`);
    }

    if (rewards.luckForRolls) {
        const scaledRolls = Math.floor(rewards.luckForRolls.rolls * rewardMult);
        await updateSanaeData(userId, {
            luckForRolls: scaledRolls,
            luckForRollsAmount: rewards.luckForRolls.amount
        });
        summary.push(`🍀 **+${(rewards.luckForRolls.amount * 100).toFixed(0)}% luck for next ${scaledRolls} rolls**`);
    }

    if (rewards.boostMultiplier) {
        const expiry = now + rewards.boostMultiplier.duration;
        await run(
            `UPDATE activeBoosts 
             SET multiplier = multiplier * ? 
             WHERE userId = ? AND expiresAt > ?`,
            [rewards.boostMultiplier.multiplier, userId, now]
        );
        // FIX: Also save the boostMultiplier value, not just the expiry
        await updateSanaeData(userId, { 
            boostMultiplierExpiry: expiry,
            boostMultiplier: rewards.boostMultiplier.multiplier  // ADD THIS
        });
        const days = Math.floor(rewards.boostMultiplier.duration / (24 * 60 * 60 * 1000));
        summary.push(`💫 **All active boosts x${rewards.boostMultiplier.multiplier} for ${days} days**`);
    }

    if (rewards.gambit) {
        // Yasaka's Gambit: Do X pulls, keep the top Y, convert rest to coins
        const pulls = rewards.gambit.pulls || 50;
        const keepTop = rewards.gambit.keepTop || 10;
        const scaledPulls = Math.floor(pulls * rewardMult);
        const scaledKeep = Math.min(keepTop, scaledPulls);
        
        const prayFumos = FumoPool.getForPray();
        const pulledFumos = [];
        
        // Define rarity order for sorting (highest first)
        const rarityOrder = {
            'TRANSCENDENT': 100,
            'ETERNAL': 90,
            'INFINITE': 80,
            'CELESTIAL': 70,
            'ASTRAL': 60,
            '???': 50,
            'EXCLUSIVE': 40,
            'MYTHICAL': 30,
            'LEGENDARY': 20,
            'OTHERWORLDLY': 15,
            'EPIC': 10,
            'RARE': 5,
            'UNCOMMON': 3,
            'Common': 1
        };
        
        // Rarity weights for gambit pulls (slightly boosted compared to normal)
        const rarityWeights = {
            'Common': 35,
            'UNCOMMON': 25,
            'RARE': 15,
            'EPIC': 10,
            'OTHERWORLDLY': 5,
            'LEGENDARY': 5,
            'MYTHICAL': 3,
            'EXCLUSIVE': 1.5,
            '???': 0.5
        };
        
        // Do the pulls
        for (let i = 0; i < scaledPulls; i++) {
            // Pick rarity based on weights
            const totalWeight = Object.values(rarityWeights).reduce((a, b) => a + b, 0);
            let roll = Math.random() * totalWeight;
            let selectedRarity = 'Common';
            
            for (const [rarity, weight] of Object.entries(rarityWeights)) {
                roll -= weight;
                if (roll <= 0) {
                    selectedRarity = rarity;
                    break;
                }
            }
            
            const possibleFumos = prayFumos.filter(f => f.rarity === selectedRarity);
            if (possibleFumos.length > 0) {
                const fumo = possibleFumos[Math.floor(Math.random() * possibleFumos.length)];
                pulledFumos.push({
                    name: fumo.name,
                    rarity: fumo.rarity,
                    rarityValue: rarityOrder[fumo.rarity] || 0
                });
            }
        }
        
        // Sort by rarity (best first)
        pulledFumos.sort((a, b) => b.rarityValue - a.rarityValue);
        
        // Keep top X fumos
        const keptFumos = pulledFumos.slice(0, scaledKeep);
        const convertedFumos = pulledFumos.slice(scaledKeep);
        
        // Add kept fumos to inventory
        for (const fumo of keptFumos) {
            await run(
                `INSERT INTO userInventory (userId, fumoName, rarity, quantity) VALUES (?, ?, ?, 1)`,
                [userId, fumo.name, fumo.rarity]
            );
        }
        
        // Convert rest to coins (based on rarity value)
        const conversionRates = {
            'Common': 100,
            'UNCOMMON': 250,
            'RARE': 500,
            'EPIC': 1000,
            'OTHERWORLDLY': 2500,
            'LEGENDARY': 15000,
            'MYTHICAL': 100000,
            'EXCLUSIVE': 500000,
            '???': 2500000
        };
        
        let totalCoins = 0;
        for (const fumo of convertedFumos) {
            totalCoins += conversionRates[fumo.rarity] || 100;
        }
        
        // Award conversion coins
        if (totalCoins > 0) {
            await updateUserCoins(userId, totalCoins, 0);
        }
        
        // Build summary
        const keptRarities = {};
        for (const fumo of keptFumos) {
            keptRarities[fumo.rarity] = (keptRarities[fumo.rarity] || 0) + 1;
        }
        const keptSummary = Object.entries(keptRarities)
            .sort((a, b) => (rarityOrder[b[0]] || 0) - (rarityOrder[a[0]] || 0))
            .map(([r, c]) => `${c}x ${r}`)
            .join(', ');
        
        summary.push(`🎰 **Yasaka's Gambit activated!**`);
        summary.push(`→ Pulled ${scaledPulls} fumos, kept top ${scaledKeep}:`);
        summary.push(`→ Kept: ${keptSummary}`);
        if (convertedFumos.length > 0) {
            summary.push(`→ Converted ${convertedFumos.length} fumos → 💰 ${formatNumber(totalCoins)} coins`);
        }
    }

    return summary.length > 0 ? summary.join('\n') : 'No rewards specified';
}

function rollBlessing(config, upgradeTiers, miracleSurge, tierUpgradeChance = 0, rewardMult = 1) {
    const tiers = Object.keys(config.blessingTiers);
    
    const weights = tiers.map(tier => {
        const tierConfig = config.blessingTiers[tier];
        let weight = tierConfig.weight;
        
        if (tierConfig.faithWeightReduction && rewardMult > 1) {
            weight = Math.max(tierConfig.minWeight || 10, weight - (tierConfig.faithWeightReduction * (rewardMult - 1) * 5));
        }
        if (tierConfig.faithWeightBonus && rewardMult > 1) {
            weight = Math.min(tierConfig.maxWeight || 50, weight + (tierConfig.faithWeightBonus * (rewardMult - 1) * 5));
        }
        
        return weight;
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let roll = Math.random() * totalWeight;
    let selectedTier = tiers[0];

    for (let i = 0; i < tiers.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
            selectedTier = tiers[i];
            break;
        }
    }

    if (tierUpgradeChance > 0 && Math.random() < tierUpgradeChance) {
        const tierIndex = tiers.indexOf(selectedTier);
        if (tierIndex < tiers.length - 1) {
            selectedTier = tiers[tierIndex + 1];
        }
    }

    if (upgradeTiers || miracleSurge) {
        const tierIndex = tiers.indexOf(selectedTier);
        if (tierIndex < tiers.length - 1) {
            selectedTier = tiers[tierIndex + 1];
        }
    }

    const tierBlessings = config.blessingTiers[selectedTier].blessings;
    const blessing = tierBlessings[Math.floor(Math.random() * tierBlessings.length)];

    return {
        name: blessing.name,
        tier: selectedTier,
        rewards: blessing.rewards
    };
}

function getTierEmoji(tier) {
    const emojis = {
        COMMON: '⚪',
        RARE: '🔵',
        LEGENDARY: '🟡',
        DIVINE: '🟣',
        MIRACLE: '🌟'
    };
    return emojis[tier] || '⚪';
}

function getTierColor(tier) {
    const colors = {
        COMMON: 0x808080,
        RARE: 0x0099FF,
        LEGENDARY: 0xFFAA00,
        DIVINE: 0x9933FF,
        MIRACLE: 0xFFD700
    };
    return colors[tier] || 0x808080;
}

function getButtonStyle(tier) {
    const styles = {
        COMMON: ButtonStyle.Secondary,
        RARE: ButtonStyle.Primary,
        LEGENDARY: ButtonStyle.Success,
        DIVINE: ButtonStyle.Success,
        MIRACLE: ButtonStyle.Danger
    };
    return styles[tier] || ButtonStyle.Secondary;
}

function formatBlessingRewards(rewards, rewardMult = 1) {
    const parts = [];

    if (rewards.coins) {
        const scaled = Math.floor(rewards.coins * rewardMult);
        parts.push(`💰 ${formatNumber(scaled)} coins`);
    }
    if (rewards.gems) {
        const scaled = Math.floor(rewards.gems * rewardMult);
        parts.push(`💎 ${formatNumber(scaled)} gems`);
    }
    if (rewards.luck) {
        const scaledLuck = rewards.luck.amount * Math.min(rewardMult, 2);
        // Convert to multiplier format for display
        const multiplier = 1 + scaledLuck;
        if (rewards.luck.permanent) {
            parts.push(`🍀 +${(scaledLuck * 100).toFixed(1)}% permanent luck`);
        } else {
            const hours = Math.floor(rewards.luck.duration / (60 * 60 * 1000));
            parts.push(`🍀 x${multiplier.toFixed(2)} luck (${hours}h)`);
        }
    }
    if (rewards.boost) {
        const hours = Math.floor(rewards.boost.duration / (60 * 60 * 1000));
        parts.push(`⚡ x${rewards.boost.multiplier} ${rewards.boost.type} (${hours}h)`);
    }
    if (rewards.items) {
        rewards.items.forEach(item => {
            const scaled = Math.floor(item.quantity * rewardMult);
            parts.push(`📦 ${scaled}x ${item.name}`);
        });
    }
    if (rewards.fumo) parts.push(`🎴 Guaranteed ${rewards.fumo.rarity} fumo`);
    if (rewards.craftDiscount) {
        const hours = Math.floor(rewards.craftDiscount.duration / (60 * 60 * 1000));
        parts.push(`🔨 ${rewards.craftDiscount.percent}% craft discount (${hours}h)`);
    }
    if (rewards.freeCrafts) {
        const days = Math.floor(rewards.freeCrafts.duration / (24 * 60 * 60 * 1000));
        parts.push(`🆓 Free crafts for ${days} days`);
    }
    if (rewards.craftProtection) {
        const scaled = Math.floor(rewards.craftProtection.nullifyFails * rewardMult);
        parts.push(`🛡️ ${scaled} craft protections`);
    }
    if (rewards.prayImmunity) {
        const days = Math.floor(rewards.prayImmunity.duration / (24 * 60 * 60 * 1000));
        parts.push(`🙏 Pray immunity (${days}d)`);
    }
    if (rewards.guaranteedRarity) {
        const scaled = Math.floor(rewards.guaranteedRarity.rolls * rewardMult);
        parts.push(`🎲 ${scaled} guaranteed ${rewards.guaranteedRarity.minRarity}+ pulls`);
    }
    if (rewards.luckForRolls) {
        const scaled = Math.floor(rewards.luckForRolls.rolls * rewardMult);
        parts.push(`🍀 +${(rewards.luckForRolls.amount * 100).toFixed(0)}% luck (${scaled} rolls)`);
    }
    if (rewards.boostMultiplier) parts.push(`💫 x${rewards.boostMultiplier.multiplier} all boosts`);
    if (rewards.gambit) parts.push(`🎰 Gambit: ${rewards.gambit.pulls} pulls → keep top ${rewards.gambit.keepTop}`);

    return parts.join('\n') || 'Special blessing';
}

module.exports = { handleSanae };
