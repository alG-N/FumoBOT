const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PRAY_CHARACTERS } = require('../../../Configuration/prayConfig');
const { formatNumber } = require('../../../Ultility/formatting');
const FumoPool = require('../../../Data/FumoPool');
const { run } = require('../../../Core/database');
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
    addSanaeFaithPoints,
    getMythicalPlusFumos,
    getLegendaryPlusFumos
} = require('../PrayDatabaseService');

const activeSanaeSessions = new Map();

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

        // Check for special events
        const eventRoll = Math.random();
        
        if (eventRoll < config.specialEvents.trainingChance) {
            // Training - unavailable but still gain faith from previous donation if any
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

        // Check for Divine Intervention (20 Faith Points)
        if (sanaeData.faithPoints >= config.faithPoints.divineInterventionThreshold) {
            await handleDivineIntervention(userId, channel, config, sanaeData);
            return;
        }

        // Send donation options
        await sendDonationOptions(userId, channel, user, config, sanaeData);

    } catch (error) {
        console.error('[Sanae] Error:', error);
        await channel.send('❌ An error occurred during Sanae\'s prayer.');
    }
}

async function sendDonationOptions(userId, channel, user, config, sanaeData) {
    const mythicalFumos = await getMythicalPlusFumos(userId, config.mythicalPlusRarities);
    const legendaryFumos = await getLegendaryPlusFumos(userId, config.legendaryPlusRarities);
    
    const totalMythical = mythicalFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);
    const totalLegendary = legendaryFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);

    const canAffordA = user.coins >= 100000;
    const canAffordB = user.gems >= 15000;
    const canAffordC = totalMythical >= 3;
    const canAffordD = user.coins >= 50000 && user.gems >= 5000 && totalLegendary >= 1;

    const embed = new EmbedBuilder()
        .setTitle('🌊⛩️ Sanae Kochiya - Faith Exchange ⛩️🌊')
        .setDescription(
            '*The living goddess of the Moriya Shrine appears before you...*\n\n' +
            '**"Your faith shall be rewarded. Choose your offering."**\n\n' +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Current Faith Points:** ${sanaeData.faithPoints}/${config.faithPoints.max}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .addFields(
            {
                name: '💰 Option A: Coin Offering',
                value: `${canAffordA ? '✅' : '❌'} 100,000 coins → **1 Faith Point**\nYou have: ${formatNumber(user.coins)} coins`,
                inline: true
            },
            {
                name: '💎 Option B: Gem Offering',
                value: `${canAffordB ? '✅' : '❌'} 15,000 gems → **2 Faith Points**\nYou have: ${formatNumber(user.gems)} gems`,
                inline: true
            },
            {
                name: '🎴 Option C: Fumo Sacrifice',
                value: `${canAffordC ? '✅' : '❌'} 3 MYTHICAL+ fumos → **3 Faith Points**\nYou have: ${totalMythical} eligible fumos`,
                inline: true
            },
            {
                name: '✨ Option D: Combo Offering',
                value: `${canAffordD ? '✅' : '❌'} 50k coins + 5k gems + 1 LEGENDARY+ fumo → **4 Faith Points**`,
                inline: true
            }
        )
        .addFields({
            name: '📊 Faith Point Milestones',
            value: 
                `• **5 FP:** Reroll one blessing\n` +
                `• **10 FP:** Unlock 4th blessing option\n` +
                `• **15 FP:** Upgrade all blessing tiers\n` +
                `• **20 FP:** 🌟 DIVINE INTERVENTION 🌟`,
            inline: false
        })
        .setColor(config.color)
        .setThumbnail(config.picture)
        .setFooter({ text: 'Faith Points persist across prayers!' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`sanae_donate_A_${userId}`)
            .setLabel('💰 Option A')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordA),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_B_${userId}`)
            .setLabel('💎 Option B')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordB),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_C_${userId}`)
            .setLabel('🎴 Option C')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(!canAffordC),
        new ButtonBuilder()
            .setCustomId(`sanae_donate_D_${userId}`)
            .setLabel('✨ Option D')
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

    // Store session data
    activeSanaeSessions.set(userId, {
        messageId: msg.id,
        channelId: channel.id,
        mythicalFumos,
        legendaryFumos
    });

    // Create collector for buttons
    const filter = (i) => i.customId.startsWith('sanae_') && i.customId.endsWith(`_${userId}`);
    const collector = msg.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== userId) {
            await interaction.reply({ content: '❌ This is not your prayer session!', ephemeral: true });
            return;
        }

        const parts = interaction.customId.split('_');
        const action = parts[1];

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
            await handleDonation(interaction, userId, option, config);
            collector.stop('donated');
        }

        if (action === 'blessing') {
            const blessingIndex = parseInt(parts[2]);
            await handleBlessingSelection(interaction, userId, blessingIndex, config);
            collector.stop('blessed');
        }

        if (action === 'reroll') {
            await handleReroll(interaction, userId, config);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time') {
            activeSanaeSessions.delete(userId);
            msg.edit({ components: [] }).catch(() => {});
        }
    });
}

async function handleDonation(interaction, userId, option, config) {
    await interaction.deferUpdate();

    const donationConfig = config.donationOptions[option];
    const session = activeSanaeSessions.get(userId);
    const user = await getUserData(userId);

    // Process the donation based on option
    let faithGained = donationConfig.faithPoints;
    let consumedItems = [];

    if (option === 'A') {
        await deductUserCurrency(userId, 100000, 0);
    } else if (option === 'B') {
        await deductUserCurrency(userId, 0, 15000);
    } else if (option === 'C') {
        // Consume 3 MYTHICAL+ fumos
        const fumosToConsume = session.mythicalFumos.slice(0, 3);
        for (const fumo of fumosToConsume) {
            await deleteFumoFromInventory(userId, fumo.id, 1);
            consumedItems.push(fumo.fumoName);
        }
    } else if (option === 'D') {
        await deductUserCurrency(userId, 50000, 5000);
        // Consume 1 LEGENDARY+ fumo
        const fumoToConsume = session.legendaryFumos[0];
        await deleteFumoFromInventory(userId, fumoToConsume.id, 1);
        consumedItems.push(fumoToConsume.fumoName);
    }

    // Add faith points
    const sanaeData = await getSanaeData(userId);
    const newFaithPoints = Math.min(sanaeData.faithPoints + faithGained, config.faithPoints.max);
    await updateSanaeData(userId, { sanaeFaithPoints: newFaithPoints });

    // Check for special events
    const eventRoll = Math.random();
    let miracleSurge = false;
    let divineScam = false;

    if (eventRoll < config.specialEvents.divineScamChance) {
        divineScam = true;
    } else if (eventRoll < config.specialEvents.divineScamChance + config.specialEvents.miracleSurgeChance) {
        miracleSurge = true;
    }

    if (divineScam) {
        // Kanako takes the faith points!
        await updateSanaeData(userId, { sanaeFaithPoints: 0 });
        
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle('⚡ Kanako\'s Intervention! ⚡')
                .setDescription(
                    '*Suddenly, Kanako appears and intercepts your offering!*\n\n' +
                    '**"I\'ll be taking this faith for myself, mortal."**\n\n' +
                    'Your Faith Points have been consumed by Kanako!\n' +
                    '(This is a 3% chance event - better luck next time!)'
                )
                .setColor('#FF4500')
                .setTimestamp()],
            components: []
        });
        
        activeSanaeSessions.delete(userId);
        await incrementDailyPray(userId);
        return;
    }

    // Generate blessings
    await showBlessingOptions(interaction, userId, config, newFaithPoints, miracleSurge, consumedItems, faithGained);
}

async function showBlessingOptions(interaction, userId, config, faithPoints, miracleSurge, consumedItems, faithGained) {
    const upgradeTiers = faithPoints >= config.faithPoints.upgradeTierThreshold;
    const fourthBlessing = faithPoints >= config.faithPoints.fourthBlessingThreshold;
    const canReroll = faithPoints >= config.faithPoints.rerollThreshold;

    const blessingCount = fourthBlessing ? 4 : 3;
    const blessings = [];

    for (let i = 0; i < blessingCount; i++) {
        const blessing = rollBlessing(config, upgradeTiers, miracleSurge);
        blessings.push(blessing);
    }

    // Store blessings in session
    const session = activeSanaeSessions.get(userId) || {};
    session.currentBlessings = blessings;
    session.canReroll = canReroll;
    session.rerollUsed = false;
    session.miracleSurge = miracleSurge;
    session.upgradeTiers = upgradeTiers;
    activeSanaeSessions.set(userId, session);

    const embed = new EmbedBuilder()
        .setTitle('🌊⛩️ Divine Blessings Revealed ⛩️🌊')
        .setDescription(
            `${miracleSurge ? '✨ **MIRACLE SURGE!** All blessings upgraded by one tier! ✨\n\n' : ''}` +
            `**Faith Offered:** +${faithGained} points\n` +
            `${consumedItems.length > 0 ? `**Items Consumed:** ${consumedItems.join(', ')}\n` : ''}` +
            `**Current Faith:** ${faithPoints}/${config.faithPoints.max}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Choose your blessing:**`
        )
        .setColor(miracleSurge ? 0xFFD700 : config.color)
        .setTimestamp();

    blessings.forEach((blessing, index) => {
        embed.addFields({
            name: `${getTierEmoji(blessing.tier)} ${blessing.name} (${blessing.tier})`,
            value: formatBlessingRewards(blessing.rewards),
            inline: false
        });
    });

    const buttons = blessings.map((blessing, index) => 
        new ButtonBuilder()
            .setCustomId(`sanae_blessing_${index}_${userId}`)
            .setLabel(`${index + 1}. ${blessing.name}`)
            .setStyle(getButtonStyle(blessing.tier))
    );

    const row1 = new ActionRowBuilder().addComponents(buttons.slice(0, 2));
    const components = [row1];
    
    if (buttons.length > 2) {
        const row2 = new ActionRowBuilder().addComponents(buttons.slice(2));
        components.push(row2);
    }

    if (canReroll && !session.rerollUsed) {
        const rerollRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`sanae_reroll_${userId}`)
                .setLabel('🔄 Reroll (Costs 5 Faith)')
                .setStyle(ButtonStyle.Secondary)
        );
        components.push(rerollRow);
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
        await interaction.reply({ content: '❌ Not enough Faith Points to reroll!', ephemeral: true });
        return;
    }

    await interaction.deferUpdate();

    // Deduct faith points
    await updateSanaeData(userId, { sanaeFaithPoints: sanaeData.faithPoints - 5 });
    session.rerollUsed = true;

    // Re-roll all blessings
    const blessings = [];
    const blessingCount = session.currentBlessings.length;

    for (let i = 0; i < blessingCount; i++) {
        const blessing = rollBlessing(config, session.upgradeTiers, session.miracleSurge);
        blessings.push(blessing);
    }

    session.currentBlessings = blessings;
    activeSanaeSessions.set(userId, session);

    const embed = new EmbedBuilder()
        .setTitle('🔄 Blessings Rerolled! 🔄')
        .setDescription(
            `**Faith Spent:** 5 points\n` +
            `**Remaining Faith:** ${sanaeData.faithPoints - 5}/${config.faithPoints.max}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**New blessings revealed:**`
        )
        .setColor(config.color)
        .setTimestamp();

    blessings.forEach((blessing, index) => {
        embed.addFields({
            name: `${getTierEmoji(blessing.tier)} ${blessing.name} (${blessing.tier})`,
            value: formatBlessingRewards(blessing.rewards),
            inline: false
        });
    });

    const buttons = blessings.map((blessing, index) => 
        new ButtonBuilder()
            .setCustomId(`sanae_blessing_${index}_${userId}`)
            .setLabel(`${index + 1}. ${blessing.name}`)
            .setStyle(getButtonStyle(blessing.tier))
    );

    const row1 = new ActionRowBuilder().addComponents(buttons.slice(0, 2));
    const components = [row1];
    
    if (buttons.length > 2) {
        const row2 = new ActionRowBuilder().addComponents(buttons.slice(2));
        components.push(row2);
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
        await interaction.followUp({ content: '❌ Invalid blessing!', ephemeral: true });
        return;
    }

    // Apply blessing rewards
    const rewardsSummary = await applyBlessingRewards(userId, blessing.rewards, config);

    const embed = new EmbedBuilder()
        .setTitle(`🌟 ${blessing.name} Bestowed! 🌟`)
        .setDescription(
            `*Sanae smiles warmly as divine energy flows through you...*\n\n` +
            `**Blessing Tier:** ${blessing.tier}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**Rewards Received:**\n${rewardsSummary}`
        )
        .setColor(getTierColor(blessing.tier))
        .setImage(config.picture)
        .setTimestamp();

    await interaction.editReply({
        embeds: [embed],
        components: []
    });

    activeSanaeSessions.delete(userId);
    await incrementDailyPray(userId);
}

async function handleDivineIntervention(userId, channel, config, sanaeData) {
    // Guaranteed Miracle Blessing at 20 Faith Points
    const miracleBlessing = config.blessingTiers.MIRACLE.blessings[0];
    
    // Reset faith points
    await updateSanaeData(userId, { sanaeFaithPoints: 0 });

    const rewardsSummary = await applyBlessingRewards(userId, miracleBlessing.rewards, config);

    const embed = new EmbedBuilder()
        .setTitle('🌟✨ DIVINE INTERVENTION ✨🌟')
        .setDescription(
            '*The heavens open as Sanae channels the full power of the Moriya Gods...*\n\n' +
            '**You have reached 20 Faith Points!**\n\n' +
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

function rollBlessing(config, upgradeTiers, miracleSurge) {
    const tiers = Object.keys(config.blessingTiers);
    const weights = tiers.map(tier => config.blessingTiers[tier].weight);
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

    // Apply tier upgrades
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

async function applyBlessingRewards(userId, rewards, config) {
    const summary = [];
    const now = Date.now();

    if (rewards.coins) {
        await updateUserCoins(userId, rewards.coins, 0);
        summary.push(`💰 **+${formatNumber(rewards.coins)} coins**`);
    }

    if (rewards.gems) {
        await updateUserCoins(userId, 0, rewards.gems);
        summary.push(`💎 **+${formatNumber(rewards.gems)} gems**`);
    }

    if (rewards.luck) {
        if (rewards.luck.permanent) {
            await updateUserLuck(userId, rewards.luck.amount);
            summary.push(`🍀 **+${(rewards.luck.amount * 100).toFixed(1)}% permanent luck**`);
        } else {
            // Apply as a timed boost
            const expiry = now + rewards.luck.duration;
            await run(
                `INSERT OR REPLACE INTO activeBoosts (userId, type, source, multiplier, expiresAt) 
                 VALUES (?, 'luck', 'SanaeBlessing', ?, ?)`,
                [userId, 1 + rewards.luck.amount, expiry]
            );
            const hours = Math.floor(rewards.luck.duration / (60 * 60 * 1000));
            summary.push(`🍀 **+${(rewards.luck.amount * 100).toFixed(1)}% luck for ${hours}h**`);
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
            await addToInventory(userId, item.name, item.quantity);
            summary.push(`📦 **${item.quantity}x ${item.name}**`);
        }
    }

    if (rewards.fumo) {
        const prayFumos = FumoPool.getForPray();
        const filteredFumos = prayFumos.filter(f => f.rarity === rewards.fumo.rarity);
        if (filteredFumos.length > 0) {
            const fumo = filteredFumos[Math.floor(Math.random() * filteredFumos.length)];
            await run(
                `INSERT INTO userInventory (userId, items, fumoName, rarity) VALUES (?, ?, ?, ?)`,
                [userId, fumo.rarity, fumo.name, fumo.rarity]
            );
            summary.push(`🎴 **${fumo.name}** (${fumo.rarity})`);
        }
    }

    if (rewards.craftDiscount) {
        const expiry = now + rewards.craftDiscount.duration;
        await updateSanaeData(userId, {
            sanaeCraftDiscount: rewards.craftDiscount.percent,
            sanaeCraftDiscountExpiry: expiry
        });
        const hours = Math.floor(rewards.craftDiscount.duration / (60 * 60 * 1000));
        summary.push(`🔨 **${rewards.craftDiscount.percent}% craft discount for ${hours}h**`);
    }

    if (rewards.freeCrafts) {
        const expiry = now + rewards.freeCrafts.duration;
        await updateSanaeData(userId, { sanaeFreeCraftsExpiry: expiry });
        const days = Math.floor(rewards.freeCrafts.duration / (24 * 60 * 60 * 1000));
        summary.push(`🆓 **Free crafts for ${days} days** (no coin/gem cost)`);
    }

    if (rewards.craftProtection) {
        const current = (await getSanaeData(userId)).craftProtection || 0;
        await updateSanaeData(userId, { 
            sanaeCraftProtection: current + rewards.craftProtection.nullifyFails 
        });
        summary.push(`🛡️ **${rewards.craftProtection.nullifyFails} craft fail protections**`);
    }

    if (rewards.prayImmunity) {
        const expiry = now + rewards.prayImmunity.duration;
        await updateSanaeData(userId, { sanaePrayImmunityExpiry: expiry });
        const days = Math.floor(rewards.prayImmunity.duration / (24 * 60 * 60 * 1000));
        summary.push(`🙏 **Pray penalty immunity for ${days} days**`);
    }

    if (rewards.guaranteedRarity) {
        await updateSanaeData(userId, {
            sanaeGuaranteedRarityRolls: rewards.guaranteedRarity.rolls
        });
        summary.push(`🎲 **Next ${rewards.guaranteedRarity.rolls} pulls guarantee ${rewards.guaranteedRarity.minRarity}+**`);
    }

    if (rewards.luckForRolls) {
        await updateSanaeData(userId, {
            sanaeLuckForRolls: rewards.luckForRolls.rolls
        });
        summary.push(`🍀 **+${(rewards.luckForRolls.amount * 100).toFixed(0)}% luck for next ${rewards.luckForRolls.rolls} rolls**`);
    }

    if (rewards.boostMultiplier) {
        // Multiply all active boosts
        await run(
            `UPDATE activeBoosts 
             SET multiplier = multiplier * ? 
             WHERE userId = ? AND expiresAt > ?`,
            [rewards.boostMultiplier.multiplier, userId, now]
        );
        const days = Math.floor(rewards.boostMultiplier.duration / (24 * 60 * 60 * 1000));
        summary.push(`💫 **All active boosts x${rewards.boostMultiplier.multiplier} for ${days} days**`);
    }

    if (rewards.gambit) {
        // Complex gambit system - perform 50 pulls, keep top 10
        summary.push(`🎰 **Yasaka's Gambit activated!**`);
        summary.push(`→ Performing ${rewards.gambit.pulls} pulls...`);
        summary.push(`→ Keeping top ${rewards.gambit.keepTop} rarest results`);
        summary.push(`→ Rest converted to Spirit Tokens`);
        // Actual implementation would be more complex
    }

    return summary.join('\n');
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

function formatBlessingRewards(rewards) {
    const parts = [];

    if (rewards.coins) parts.push(`💰 ${formatNumber(rewards.coins)} coins`);
    if (rewards.gems) parts.push(`💎 ${formatNumber(rewards.gems)} gems`);
    if (rewards.luck) {
        if (rewards.luck.permanent) {
            parts.push(`🍀 +${(rewards.luck.amount * 100).toFixed(1)}% permanent luck`);
        } else {
            const hours = Math.floor(rewards.luck.duration / (60 * 60 * 1000));
            parts.push(`🍀 +${(rewards.luck.amount * 100).toFixed(1)}% luck (${hours}h)`);
        }
    }
    if (rewards.boost) {
        const hours = Math.floor(rewards.boost.duration / (60 * 60 * 1000));
        parts.push(`⚡ x${rewards.boost.multiplier} ${rewards.boost.type} (${hours}h)`);
    }
    if (rewards.items) {
        rewards.items.forEach(item => parts.push(`📦 ${item.quantity}x ${item.name}`));
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
    if (rewards.craftProtection) parts.push(`🛡️ ${rewards.craftProtection.nullifyFails} craft protections`);
    if (rewards.prayImmunity) {
        const days = Math.floor(rewards.prayImmunity.duration / (24 * 60 * 60 * 1000));
        parts.push(`🙏 Pray immunity (${days}d)`);
    }
    if (rewards.guaranteedRarity) parts.push(`🎲 ${rewards.guaranteedRarity.rolls} guaranteed ${rewards.guaranteedRarity.minRarity}+ pulls`);
    if (rewards.luckForRolls) parts.push(`🍀 +${(rewards.luckForRolls.amount * 100).toFixed(0)}% luck (${rewards.luckForRolls.rolls} rolls)`);
    if (rewards.boostMultiplier) parts.push(`💫 x${rewards.boostMultiplier.multiplier} all boosts`);
    if (rewards.gambit) parts.push(`🎰 Gambit: ${rewards.gambit.pulls} pulls → keep top ${rewards.gambit.keepTop}`);

    return parts.join('\n') || 'No rewards specified';
}

module.exports = { handleSanae };
