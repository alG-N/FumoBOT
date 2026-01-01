const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { run, get, all } = require('../../../../Core/database');
const { formatNumber } = require('../../../../Ultility/formatting');
const { buildSecureCustomId } = require('../../../../Middleware/buttonOwnership');

const SIGIL_CONFIG = {
    // Base boosts (scaled by GoldenSigil count)
    baseCoinBoost: 150.0,      // x150 coins
    baseGemBoost: 300.0,       // x300 gems
    
    // Luck scaling (per GoldenSigil stack)
    luckPerGoldenSigil: { min: 1.25, max: 2.0 },
    
    // Roll speed scaling (per CrystalSigil stack)
    rollSpeedPerCrystal: { min: 1.1, max: 1.5 },
    
    // Trait luck scaling (variant luck for SHINY/alG)
    variantLuck: { min: 1.01, max: 1.5 },
    
    // GLITCHED trait
    glitchedTraitChance: 1 / 50000,
    glitchedTag: '[🔮GLITCHED]',
    
    // Sell value boost
    sellValueBoost: 3.5, // +350%
    
    // Reimu luck boost
    reimuLuckBoost: 5.0, // +500%
    
    // Duration
    duration: 12 * 60 * 60 * 1000, // 12 hours
    
    // Cost: 15 Transcendent fumos (including traits)
    transcendentCost: 15,
    
    // Nullified rolls (TOTAL, not daily reset)
    nullifiedRolls: 10,
    
    // Disables other boosts
    disablesOtherBoosts: true,
    
    // Blocks duplicate ASTRAL+
    blocksAstralDuplicates: true,
    
    source: 'S!gil'
};

/**
 * Get total count of Transcendent fumos for a user
 * Handles multiple name formats: (TRANSCENDENT), [TRANSCENDENT], etc.
 */
async function getTranscendentCount(userId) {
    // Query all fumos that contain TRANSCENDENT in any format
    const fumos = await all(
        `SELECT fumoName, SUM(quantity) as quantity 
         FROM userInventory 
         WHERE userId = ? 
         AND fumoName IS NOT NULL
         AND (
             UPPER(fumoName) LIKE '%TRANSCENDENT%'
             OR UPPER(fumoName) LIKE '%(TRANSCENDENT)%'
             OR UPPER(fumoName) LIKE '%[TRANSCENDENT]%'
         )
         AND quantity > 0
         GROUP BY fumoName`,
        [userId]
    );
    
    let total = 0;
    const validFumos = [];
    
    for (const fumo of fumos) {
        if (!fumo.fumoName) continue;
        
        const upperName = fumo.fumoName.toUpperCase();
        
        // Check if it's actually a TRANSCENDENT fumo (not just containing the word)
        if (upperName.includes('(TRANSCENDENT)') || 
            upperName.includes('[TRANSCENDENT]') ||
            upperName.includes(' TRANSCENDENT') ||
            upperName.endsWith('TRANSCENDENT')) {
            total += fumo.quantity;
            validFumos.push({
                name: fumo.fumoName,
                quantity: fumo.quantity
            });
        }
    }
    
    return { total, fumos: validFumos };
}

async function checkPrerequisites(userId) {
    // Check for GoldenSigil stacks
    const goldenSigils = await get(
        `SELECT stack FROM activeBoosts 
         WHERE userId = ? AND source = 'GoldenSigil' AND type = 'coin'`,
        [userId]
    );
    
    // Check for CrystalSigil stacks
    const crystalSigils = await get(
        `SELECT stack FROM activeBoosts 
         WHERE userId = ? AND source = 'CrystalSigil' AND type = 'coin'`,
        [userId]
    );
    
    // Get Transcendent fumos with improved detection
    const { total: totalTranscendent, fumos: transcendentFumos } = await getTranscendentCount(userId);
    
    return {
        goldenStacks: goldenSigils?.stack || 0,
        crystalStacks: crystalSigils?.stack || 0,
        transcendentFumos,
        totalTranscendent,
        hasEnoughTranscendent: totalTranscendent >= SIGIL_CONFIG.transcendentCost
    };
}

async function handleSigil(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **S!gil?(?)** can only be used one at a time.");
    }

    try {
        // Check if already active
        const existingSigil = await get(
            `SELECT * FROM activeBoosts 
             WHERE userId = ? AND source = ? AND type = 'coin'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, SIGIL_CONFIG.source, Date.now()]
        );

        if (existingSigil) {
            // Return the item
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId, itemName]
            );
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ S!gil Already Active')
                    .setDescription('You already have an active S!gil boost! Wait for it to expire before using another.\n\n**Your item has been returned.**')
                    .setColor(Colors.Red)]
            });
        }

        // Check prerequisites
        const prereqs = await checkPrerequisites(userId);
        
        if (!prereqs.hasEnoughTranscendent) {
            // Return the item since activation failed
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId, itemName]
            );
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Insufficient Transcendent Fumos')
                    .setDescription(
                        `Activating S!gil requires **${SIGIL_CONFIG.transcendentCost}** Transcendent fumos.\n\n` +
                        `You have: **${prereqs.totalTranscendent}** Transcendent fumos\n` +
                        `Need: **${SIGIL_CONFIG.transcendentCost - prereqs.totalTranscendent}** more\n\n` +
                        `**Your item has been returned.**`
                    )
                    .setColor(Colors.Red)
                    .setFooter({ text: 'Transcendent fumos include all variants: SHINY, alG, etc.' })]
            });
        }

        // Show confirmation
        const embed = createConfirmationEmbed(prereqs);
        const buttons = createConfirmationButtons(userId);

        // Store prereqs for confirmation
        message.client.sigilData = message.client.sigilData || {};
        message.client.sigilData[userId] = {
            prereqs,
            itemName,
            timestamp: Date.now()
        };

        await message.reply({ embeds: [embed], components: [buttons] });

    } catch (error) {
        console.error('[SIGIL] Error:', error);
        
        // Return item on error
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, ?, 1, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, itemName]
        ).catch(() => {});
        
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to activate S!gil. Your item has been returned.')
                .setColor(Colors.Red)]
        });
    }
}

function createConfirmationEmbed(prereqs) {
    const luckMultiplier = prereqs.goldenStacks > 0 
        ? SIGIL_CONFIG.luckPerGoldenSigil.min + 
          (prereqs.goldenStacks * (SIGIL_CONFIG.luckPerGoldenSigil.max - SIGIL_CONFIG.luckPerGoldenSigil.min) / 10)
        : 1;
    
    const rollSpeedMultiplier = prereqs.crystalStacks > 0
        ? SIGIL_CONFIG.rollSpeedPerCrystal.min +
          (prereqs.crystalStacks * (SIGIL_CONFIG.rollSpeedPerCrystal.max - SIGIL_CONFIG.rollSpeedPerCrystal.min) / 5)
        : 1;
    
    const variantLuckMultiplier = SIGIL_CONFIG.variantLuck.min + 
        (Math.random() * (SIGIL_CONFIG.variantLuck.max - SIGIL_CONFIG.variantLuck.min));

    const embed = new EmbedBuilder()
        .setTitle('🪄 S!gil?(?) - Confirm Activation')
        .setColor(0x9400D3)
        .setDescription(
            `**Are you sure you want to activate S!gil?**\n\n` +
            `⚠️ This will **consume ${SIGIL_CONFIG.transcendentCost} Transcendent fumos** and **disable all other boosts** for the duration.\n\n` +
            `**Your Transcendent Fumos:** ${prereqs.totalTranscendent}`
        )
        .addFields(
            {
                name: '💰 Coin Boost',
                value: `x${SIGIL_CONFIG.baseCoinBoost}`,
                inline: true
            },
            {
                name: '💎 Gem Boost',
                value: `x${SIGIL_CONFIG.baseGemBoost}`,
                inline: true
            },
            {
                name: '🍀 Luck Multiplier',
                value: `x${luckMultiplier.toFixed(2)} (from ${prereqs.goldenStacks} GoldenSigil)`,
                inline: true
            },
            {
                name: '⚡ Roll Speed',
                value: `x${rollSpeedMultiplier.toFixed(2)} (from ${prereqs.crystalStacks} CrystalSigil)`,
                inline: true
            },
            {
                name: '🎲 Variant Luck',
                value: `x${variantLuckMultiplier.toFixed(2)}`,
                inline: true
            },
            {
                name: '🎯 Nullified Rolls',
                value: `${SIGIL_CONFIG.nullifiedRolls} rolls (total)`,
                inline: true
            },
            {
                name: '🔮 GLITCHED Trait',
                value: `1 in ${Math.round(1 / SIGIL_CONFIG.glitchedTraitChance).toLocaleString()} chance`,
                inline: true
            },
            {
                name: '💵 Sell Value',
                value: `+${(SIGIL_CONFIG.sellValueBoost * 100).toFixed(0)}%`,
                inline: true
            },
            {
                name: '⏱️ Duration',
                value: '12 hours',
                inline: true
            }
        )
        .setFooter({ text: 'This will disable ALL other active boosts during S!gil duration!' });

    return embed;
}

function createConfirmationButtons(userId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('sigil_confirm', userId))
            .setLabel('✅ Activate S!gil')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(buildSecureCustomId('sigil_cancel', userId))
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
    );
}

async function confirmSigilActivation(interaction, client) {
    const userId = interaction.user.id;
    
    // Get stored data
    const sigilData = client.sigilData?.[userId];
    
    if (!sigilData || Date.now() - sigilData.timestamp > 60000) {
        return interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Session Expired')
                .setDescription('This S!gil activation session has expired. Please use the item again.')
                .setColor(Colors.Red)],
            components: []
        });
    }

    const { prereqs, itemName } = sigilData;

    try {
        // Re-verify prerequisites
        const currentPrereqs = await checkPrerequisites(userId);
        
        if (!currentPrereqs.hasEnoughTranscendent) {
            // Return item
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId, itemName]
            );
            
            return interaction.update({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Insufficient Transcendent Fumos')
                    .setDescription('You no longer have enough Transcendent fumos. Your item has been returned.')
                    .setColor(Colors.Red)],
                components: []
            });
        }

        // Consume Transcendent fumos
        let toConsume = SIGIL_CONFIG.transcendentCost;
        for (const fumo of currentPrereqs.transcendentFumos) {
            if (toConsume <= 0) break;
            
            const consumeFromThis = Math.min(fumo.quantity, toConsume);
            
            await run(
                `UPDATE userInventory SET quantity = quantity - ? 
                 WHERE userId = ? AND fumoName = ?`,
                [consumeFromThis, userId, fumo.name]
            );
            
            toConsume -= consumeFromThis;
        }

        // Clean up zero quantities
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND quantity <= 0`,
            [userId]
        );

        // Disable all other boosts by marking them
        await run(
            `UPDATE activeBoosts 
             SET extra = json_set(COALESCE(extra, '{}'), '$.sigilDisabled', true)
             WHERE userId = ? AND source != ?`,
            [userId, SIGIL_CONFIG.source]
        );

        // Calculate boost values
        const luckMultiplier = currentPrereqs.goldenStacks > 0 
            ? SIGIL_CONFIG.luckPerGoldenSigil.min + 
              (currentPrereqs.goldenStacks * (SIGIL_CONFIG.luckPerGoldenSigil.max - SIGIL_CONFIG.luckPerGoldenSigil.min) / 10)
            : 1;
        
        const rollSpeedMultiplier = currentPrereqs.crystalStacks > 0
            ? SIGIL_CONFIG.rollSpeedPerCrystal.min +
              (currentPrereqs.crystalStacks * (SIGIL_CONFIG.rollSpeedPerCrystal.max - SIGIL_CONFIG.rollSpeedPerCrystal.min) / 5)
            : 1;
        
        const variantLuckMultiplier = SIGIL_CONFIG.variantLuck.min + 
            (Math.random() * (SIGIL_CONFIG.variantLuck.max - SIGIL_CONFIG.variantLuck.min));

        const now = Date.now();
        const expiresAt = now + SIGIL_CONFIG.duration;

        // Apply all S!gil boosts
        const boosts = [
            { type: 'coin', multiplier: SIGIL_CONFIG.baseCoinBoost, extra: '{}' },
            { type: 'gem', multiplier: SIGIL_CONFIG.baseGemBoost, extra: '{}' },
            { type: 'luck', multiplier: luckMultiplier, extra: '{}' },
            { type: 'rollSpeed', multiplier: rollSpeedMultiplier, extra: '{}' },
            { type: 'variantLuck', multiplier: variantLuckMultiplier, extra: '{}' },
            { type: 'sellValue', multiplier: SIGIL_CONFIG.sellValueBoost, extra: '{}' },
            { type: 'reimuLuck', multiplier: SIGIL_CONFIG.reimuLuckBoost, extra: '{}' },
            { 
                type: 'nullifiedRolls', 
                multiplier: 1, 
                extra: JSON.stringify({ 
                    remaining: SIGIL_CONFIG.nullifiedRolls,
                    total: SIGIL_CONFIG.nullifiedRolls
                })
            },
            { 
                type: 'glitchedTrait', 
                multiplier: SIGIL_CONFIG.glitchedTraitChance, 
                extra: JSON.stringify({ 
                    enabled: true, 
                    chance: SIGIL_CONFIG.glitchedTraitChance,
                    tag: SIGIL_CONFIG.glitchedTag,
                    priority: 1
                })
            },
            {
                type: 'astralBlock',
                multiplier: 1,
                extra: JSON.stringify({ blocksAstralDuplicates: true })
            }
        ];

        for (const boost of boosts) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, extra)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                     multiplier = ?,
                     expiresAt = ?,
                     extra = ?`,
                [userId, boost.type, SIGIL_CONFIG.source, boost.multiplier, expiresAt, boost.extra,
                 boost.multiplier, expiresAt, boost.extra]
            );
        }

        // Clean up stored data
        delete client.sigilData[userId];

        const embed = new EmbedBuilder()
            .setTitle('🪄 S!gil?(?) Activated!')
            .setColor(0x9400D3)
            .setDescription(
                `**S!gil has been activated!**\n\n` +
                `Consumed **${SIGIL_CONFIG.transcendentCost}** Transcendent fumos.\n` +
                `All other boosts have been **disabled** for the duration.`
            )
            .addFields(
                { name: '💰 Coin Boost', value: `x${SIGIL_CONFIG.baseCoinBoost}`, inline: true },
                { name: '💎 Gem Boost', value: `x${SIGIL_CONFIG.baseGemBoost}`, inline: true },
                { name: '🍀 Luck', value: `x${luckMultiplier.toFixed(2)}`, inline: true },
                { name: '⚡ Roll Speed', value: `x${rollSpeedMultiplier.toFixed(2)}`, inline: true },
                { name: '🎲 Variant Luck', value: `x${variantLuckMultiplier.toFixed(2)}`, inline: true },
                { name: '🎯 Nullified Rolls', value: `${SIGIL_CONFIG.nullifiedRolls}`, inline: true },
                { name: '⏱️ Expires', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'May the ancient power guide your rolls!' })
            .setTimestamp();

        await interaction.update({ embeds: [embed], components: [] });

    } catch (error) {
        console.error('[SIGIL] Confirmation error:', error);
        
        // Return item on error
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, ?, 1, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, itemName]
        ).catch(() => {});
        
        await interaction.update({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to activate S!gil. Your item has been returned.')
                .setColor(Colors.Red)],
            components: []
        });
    }
}

async function cancelSigilActivation(interaction, client) {
    const userId = interaction.user.id;
    
    // Get stored data
    const sigilData = client.sigilData?.[userId];
    
    if (sigilData) {
        // Return the item
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, ?, 1, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
            [userId, sigilData.itemName]
        );
        
        delete client.sigilData[userId];
    }

    await interaction.update({
        embeds: [new EmbedBuilder()
            .setTitle('❌ Cancelled')
            .setDescription('S!gil activation was cancelled. Your item has been returned.')
            .setColor(Colors.Red)],
        components: []
    });
}

module.exports = { 
    handleSigil, 
    confirmSigilActivation, 
    cancelSigilActivation,
    SIGIL_CONFIG,
    getTranscendentCount
};