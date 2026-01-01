const { EmbedBuilder, Colors } = require('discord.js');
const { run, get } = require('../../../../Core/database');
const { formatNumber } = require('../../../../Ultility/formatting');

const COSMIC_CORE_CONFIG = {
    coinBoost: 75.0,        // +7500% = x76 total
    gemBoost: 100.0,        // +10000% = x101 total
    glitchedVariantChance: 1 / 50000, // 1 in 50k chance for [🔮GLITCHED] variant
    glitchedTag: '[🔮GLITCHED]',
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxStacks: 2,
    source: 'CosmicCore'
};

async function handleCosmicCore(message, itemName, quantity, userId) {
    try {
        // Check current stacks
        const existingBoost = await get(
            `SELECT stack FROM activeBoosts 
             WHERE userId = ? AND source = ? AND type = 'coin'`,
            [userId, COSMIC_CORE_CONFIG.source]
        );

        const currentStacks = existingBoost?.stack || 0;
        const stacksToAdd = Math.min(quantity, COSMIC_CORE_CONFIG.maxStacks - currentStacks);

        if (stacksToAdd <= 0) {
            // Return all items since none can be used
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, ?, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                [userId, itemName, quantity, quantity]
            );
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Maximum Stacks Reached')
                    .setDescription(`You already have ${COSMIC_CORE_CONFIG.maxStacks} CosmicCore stacks active!\n\n**Your items have been returned.**`)
                    .setColor(Colors.Red)]
            });
        }

        // Return excess items if any
        const excessItems = quantity - stacksToAdd;
        if (excessItems > 0) {
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, ?, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                [userId, itemName, excessItems, excessItems]
            );
        }

        const now = Date.now();
        const expiresAt = now + COSMIC_CORE_CONFIG.duration;
        const totalStacks = currentStacks + stacksToAdd;
        
        // Check if S!gil is active - if so, mark new boosts as frozen
        const sigilActive = await get(
            `SELECT * FROM activeBoosts 
             WHERE userId = ? AND source = 'S!gil' AND type = 'coin'
             AND (expiresAt IS NULL OR expiresAt > ?)`,
            [userId, now]
        );
        
        const coinMultiplier = 1 + (COSMIC_CORE_CONFIG.coinBoost * totalStacks);
        const gemMultiplier = 1 + (COSMIC_CORE_CONFIG.gemBoost * totalStacks);
        const glitchedChance = COSMIC_CORE_CONFIG.glitchedVariantChance * totalStacks;

        // Upsert boosts - mark as frozen if S!gil is active
        const boostTypes = [
            { type: 'coin', multiplier: coinMultiplier, extra: sigilActive ? JSON.stringify({ sigilDisabled: true, frozenTimeRemaining: COSMIC_CORE_CONFIG.duration }) : '{}' },
            { type: 'gem', multiplier: gemMultiplier, extra: sigilActive ? JSON.stringify({ sigilDisabled: true, frozenTimeRemaining: COSMIC_CORE_CONFIG.duration }) : '{}' },
            { 
                type: 'glitchedTrait', 
                multiplier: glitchedChance,
                extra: JSON.stringify({ 
                    enabled: true, 
                    chance: glitchedChance,
                    tag: COSMIC_CORE_CONFIG.glitchedTag,
                    // If S!gil is active, mark as frozen
                    ...(sigilActive ? {
                        sigilDisabled: true,
                        frozenTimeRemaining: COSMIC_CORE_CONFIG.duration
                    } : {})
                })
            }
        ];

        for (const boost of boostTypes) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack, extra)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                     multiplier = ?,
                     expiresAt = ?,
                     stack = ?,
                     extra = ?`,
                [userId, boost.type, COSMIC_CORE_CONFIG.source, boost.multiplier, expiresAt, totalStacks, boost.extra || '{}',
                 boost.multiplier, expiresAt, totalStacks, boost.extra || '{}']
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('🌌 Cosmic Core Activated!')
            .setColor(0x0a0a2e)
            .setDescription(
                `You've activated **${stacksToAdd}x CosmicCore(?)**!\n\n` +
                `**Current Stacks:** ${totalStacks}/${COSMIC_CORE_CONFIG.maxStacks}\n\n` +
                `*The cosmic energy warps reality around you...*`
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
                    name: '🔮 GLITCHED Variant',
                    value: `1 in ${Math.round(1 / glitchedChance).toLocaleString()} chance`,
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
            .setFooter({ text: '[🔮GLITCHED] is an ultra-rare variant that can appear on rolled fumos!' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('[CosmicCore] Error:', error);
        
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
                .setDescription('Failed to activate CosmicCore. Your items have been returned.')
                .setColor(Colors.Red)]
        });
    }
}

module.exports = { handleCosmicCore, COSMIC_CORE_CONFIG };