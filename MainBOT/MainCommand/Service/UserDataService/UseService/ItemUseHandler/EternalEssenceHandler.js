const { EmbedBuilder, Colors } = require('discord.js');
const { run, get } = require('../../../../Core/database');
const { formatNumber } = require('../../../../Ultility/formatting');

const ETERNAL_ESSENCE_CONFIG = {
    coinBoost: 50.0,       // +5000% = x51 total
    gemBoost: 75.0,        // +7500% = x76 total
    variantLuckMultiplier: 2.0, // x2 variant luck (24h duration)
    duration: 24 * 60 * 60 * 1000, // 24 hours for ALL boosts including variant luck
    maxStacks: 2,
    source: 'EternalEssence'
};

async function handleEternalEssence(message, itemName, quantity, userId) {
    try {
        // Check current stacks
        const existingBoost = await get(
            `SELECT stack FROM activeBoosts 
             WHERE userId = ? AND source = ? AND type = 'coin'`,
            [userId, ETERNAL_ESSENCE_CONFIG.source]
        );

        const currentStacks = existingBoost?.stack || 0;
        const stacksToAdd = Math.min(quantity, ETERNAL_ESSENCE_CONFIG.maxStacks - currentStacks);

        if (stacksToAdd <= 0) {
            // Return unused items
            if (quantity > 0) {
                await run(
                    `INSERT INTO userInventory (userId, itemName, quantity, type) 
                     VALUES (?, ?, ?, 'item')
                     ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
                    [userId, itemName, quantity, quantity]
                );
            }
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Maximum Stacks Reached')
                    .setDescription(`You already have ${ETERNAL_ESSENCE_CONFIG.maxStacks} EternalEssence stacks active!\n\nYour items have been returned.`)
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
        const expiresAt = now + ETERNAL_ESSENCE_CONFIG.duration;
        const totalStacks = currentStacks + stacksToAdd;
        
        const coinMultiplier = 1 + (ETERNAL_ESSENCE_CONFIG.coinBoost * totalStacks);
        const gemMultiplier = 1 + (ETERNAL_ESSENCE_CONFIG.gemBoost * totalStacks);
        const variantLuckMultiplier = Math.pow(ETERNAL_ESSENCE_CONFIG.variantLuckMultiplier, totalStacks);

        // ALL boosts now have 24h duration (including variant luck)
        const boosts = [
            { type: 'coin', multiplier: coinMultiplier },
            { type: 'gem', multiplier: gemMultiplier },
            { type: 'variantLuck', multiplier: variantLuckMultiplier } // Changed from traitLuck
        ];

        for (const boost of boosts) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                     multiplier = ?,
                     expiresAt = ?,
                     stack = ?`,
                [userId, boost.type, ETERNAL_ESSENCE_CONFIG.source, boost.multiplier, expiresAt, totalStacks,
                 boost.multiplier, expiresAt, totalStacks]
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('✨ Eternal Essence Activated!')
            .setColor(0xffd700)
            .setDescription(
                `You've activated **${stacksToAdd}x EternalEssence(?)**!\n\n` +
                `**Current Stacks:** ${totalStacks}/${ETERNAL_ESSENCE_CONFIG.maxStacks}\n\n` +
                `*Eternal power flows through your soul...*`
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
                    name: '🎲 Variant Luck',
                    value: `x${variantLuckMultiplier.toFixed(1)} (SHINY/alG)`,
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
            .setFooter({ text: 'All boosts (including variant luck) last 24 hours!' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('[EternalEssence] Error:', error);
        
        // Return item on error
        await run(
            `INSERT INTO userInventory (userId, itemName, quantity, type) 
             VALUES (?, ?, ?, 'item')
             ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + ?`,
            [userId, itemName, quantity, quantity]
        ).catch(() => {});
        
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to activate EternalEssence. Your items have been returned.')
                .setColor(Colors.Red)]
        });
    }
}

module.exports = { handleEternalEssence, ETERNAL_ESSENCE_CONFIG };