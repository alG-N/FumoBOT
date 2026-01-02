const { EmbedBuilder, Colors } = require('discord.js');
const { run, get } = require('../../../../Core/database');
const { formatNumber } = require('../../../../Ultility/formatting');

const VOID_CRYSTAL_CONFIG = {
    coinBoost: 15.0,       // +1500% = x16 total
    gemBoost: 20.0,        // +2000% = x21 total
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxStacks: 3,
    voidVariantChance: 0.001, // 0.1% chance for [🌀VOID] variant on rolls
    voidTag: '[🌀VOID]',
    source: 'VoidCrystal'
};

async function handleVoidCrystal(message, itemName, quantity, userId) {
    try {
        // Check current stacks
        const existingBoost = await get(
            `SELECT stack FROM activeBoosts 
             WHERE userId = ? AND source = ? AND type = 'coin'`,
            [userId, VOID_CRYSTAL_CONFIG.source]
        );

        const currentStacks = existingBoost?.stack || 0;
        const stacksToAdd = Math.min(quantity, VOID_CRYSTAL_CONFIG.maxStacks - currentStacks);

        if (stacksToAdd <= 0) {
            // Return all items since none can be used
            const updateResult = await run(
                `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                [quantity, userId, itemName]
            );
            if (!updateResult || updateResult.changes === 0) {
                await run(
                    `INSERT INTO userInventory (userId, itemName, quantity, type) VALUES (?, ?, ?, 'item')`,
                    [userId, itemName, quantity]
                );
            }
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Maximum Stacks Reached')
                    .setDescription(`You already have ${VOID_CRYSTAL_CONFIG.maxStacks} VoidCrystal stacks active!\n\n**Your items have been returned.**`)
                    .setColor(Colors.Red)]
            });
        }

        // Return excess items if any
        const excessItems = quantity - stacksToAdd;
        if (excessItems > 0) {
            const updateResult = await run(
                `UPDATE userInventory SET quantity = quantity + ? WHERE userId = ? AND itemName = ?`,
                [excessItems, userId, itemName]
            );
            if (!updateResult || updateResult.changes === 0) {
                await run(
                    `INSERT INTO userInventory (userId, itemName, quantity, type) VALUES (?, ?, ?, 'item')`,
                    [userId, itemName, excessItems]
                );
            }
            console.log(`[VoidCrystal] Returned ${excessItems} excess items to user ${userId}`);
        }

        const now = Date.now();
        const expiresAt = now + VOID_CRYSTAL_CONFIG.duration;
        const totalStacks = currentStacks + stacksToAdd;
        
        // Check if S!gil is active - if so, mark new boosts as frozen
        const sigilActive = await get(
            `SELECT * FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        const coinMultiplier = 1 + (VOID_CRYSTAL_CONFIG.coinBoost * totalStacks);
        const gemMultiplier = 1 + (VOID_CRYSTAL_CONFIG.gemBoost * totalStacks);
        const voidVariantChance = VOID_CRYSTAL_CONFIG.voidVariantChance * totalStacks;

        // Upsert boosts - mark as frozen if S!gil is active
        const boostTypes = [
            { type: 'coin', multiplier: coinMultiplier },
            { type: 'gem', multiplier: gemMultiplier },
            { 
                type: 'voidTrait', 
                multiplier: voidVariantChance, 
                extra: JSON.stringify({ 
                    enabled: true,
                    chance: voidVariantChance,
                    tag: VOID_CRYSTAL_CONFIG.voidTag,
                    // If S!gil is active, mark as frozen with remaining time
                    ...(sigilActive ? {
                        sigilDisabled: true,
                        frozenTimeRemaining: VOID_CRYSTAL_CONFIG.duration
                    } : {})
                }) 
            }
        ];

        // For coin/gem boosts, add frozen flag if S!gil is active
        if (sigilActive) {
            boostTypes[0].extra = JSON.stringify({ sigilDisabled: true, frozenTimeRemaining: VOID_CRYSTAL_CONFIG.duration });
            boostTypes[1].extra = JSON.stringify({ sigilDisabled: true, frozenTimeRemaining: VOID_CRYSTAL_CONFIG.duration });
        }

        for (const boost of boostTypes) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack, extra)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                     multiplier = ?,
                     expiresAt = ?,
                     stack = ?,
                     extra = ?`,
                [userId, boost.type, VOID_CRYSTAL_CONFIG.source, boost.multiplier, expiresAt, totalStacks, boost.extra || '{}',
                 boost.multiplier, expiresAt, totalStacks, boost.extra || '{}']
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('🌀 Void Crystal Activated!')
            .setColor(0x1a0033)
            .setDescription(
                `You've activated **${stacksToAdd}x VoidCrystal(?)**!\n\n` +
                `**Current Stacks:** ${totalStacks}/${VOID_CRYSTAL_CONFIG.maxStacks}\n\n` +
                `*The void energy courses through your collection...*`
            )
            .addFields(
                {
                    name: '💰 Coin Boost',
                    value: `+${((coinMultiplier - 1) * 100).toFixed(0)}%`,
                    inline: true
                },
                {
                    name: '💎 Gem Boost',
                    value: `+${((gemMultiplier - 1) * 100).toFixed(0)}%`,
                    inline: true
                },
                {
                    name: '🌀 VOID Variant Chance',
                    value: `${(voidVariantChance * 100).toFixed(2)}%`,
                    inline: true
                },
                {
                    name: '⏱️ Duration',
                    value: '24 hours',
                    inline: true
                },
                {
                    name: '⏰ Expires',
                    value: `<t:${Math.floor(expiresAt / 1000)}:R>`,
                    inline: true
                }
            )
            .setFooter({ text: '[🌀VOID] is a special variant that can appear on rolled fumos!' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('[VoidCrystal] Error:', error);
        
        // Return items on error
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, ?, ?, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            [userId, itemName, quantity, quantity]
        ).catch(() => {});
        
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to activate VoidCrystal. Your items have been returned.')
                .setColor(Colors.Red)]
        });
    }
}

module.exports = { handleVoidCrystal, VOID_CRYSTAL_CONFIG };