const { EmbedBuilder, Colors } = require('discord.js');
const { run, get, all } = require('../../../../Core/database');
const { formatNumber } = require('../../../../Ultility/formatting');

const CRYSTAL_SIGIL_CONFIG = {
    coinBoost: 5.0,        // +500% = x6 total
    gemBoost: 7.5,         // +750% = x8.5 total
    rollSpeedMin: 1.1,
    rollSpeedMax: 1.5,
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxStacks: 5,
    source: 'CrystalSigil'
};

async function handleCrystalSigil(message, itemName, quantity, userId) {
    try {
        // Check current stacks
        const existingBoost = await get(
            `SELECT stack, multiplier FROM activeBoosts 
             WHERE userId = ? AND source = ? AND type = 'coin'`,
            [userId, CRYSTAL_SIGIL_CONFIG.source]
        );

        const currentStacks = existingBoost?.stack || 0;
        const stacksToAdd = Math.min(quantity, CRYSTAL_SIGIL_CONFIG.maxStacks - currentStacks);

        if (stacksToAdd <= 0) {
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setTitle('❌ Maximum Stacks Reached')
                    .setDescription(`You already have ${CRYSTAL_SIGIL_CONFIG.maxStacks} CrystalSigil stacks active!`)
                    .setColor(Colors.Red)]
            });
        }

        // Remove items from inventory
        await run(
            `UPDATE userInventory SET quantity = quantity - ? 
             WHERE userId = ? AND itemName = ?`,
            [stacksToAdd, userId, itemName]
        );

        // Clean up zero quantity
        await run(
            `DELETE FROM userInventory WHERE userId = ? AND itemName = ? AND quantity <= 0`,
            [userId, itemName]
        );

        const now = Date.now();
        const expiresAt = now + CRYSTAL_SIGIL_CONFIG.duration;
        
        // Calculate roll speed (random within range)
        const rollSpeedBoost = CRYSTAL_SIGIL_CONFIG.rollSpeedMin + 
            (Math.random() * (CRYSTAL_SIGIL_CONFIG.rollSpeedMax - CRYSTAL_SIGIL_CONFIG.rollSpeedMin));

        // Calculate stacked multipliers
        const totalStacks = currentStacks + stacksToAdd;
        const coinMultiplier = 1 + (CRYSTAL_SIGIL_CONFIG.coinBoost * totalStacks);
        const gemMultiplier = 1 + (CRYSTAL_SIGIL_CONFIG.gemBoost * totalStacks);

        // Upsert boosts
        const boostTypes = [
            { type: 'coin', multiplier: coinMultiplier },
            { type: 'gem', multiplier: gemMultiplier },
            { type: 'rollSpeed', multiplier: rollSpeedBoost }
        ];

        for (const boost of boostTypes) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET
                     multiplier = ?,
                     expiresAt = ?,
                     stack = ?`,
                [userId, boost.type, CRYSTAL_SIGIL_CONFIG.source, boost.multiplier, expiresAt, totalStacks,
                 boost.multiplier, expiresAt, totalStacks]
            );
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 Crystal Sigil Activated!')
            .setColor(Colors.Purple)
            .setDescription(
                `You've activated **${stacksToAdd}x CrystalSigil(?)**!\n\n` +
                `**Current Stacks:** ${totalStacks}/${CRYSTAL_SIGIL_CONFIG.maxStacks}`
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
                    name: '⚡ Roll Speed',
                    value: `x${rollSpeedBoost.toFixed(2)}`,
                    inline: true
                },
                {
                    name: '⏱️ Duration',
                    value: '24 hours',
                    inline: true
                }
            )
            .setFooter({ text: 'Stacks multiply the base bonus!' })
            .setTimestamp();

        return message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('[CrystalSigil] Error:', error);
        return message.reply({
            embeds: [new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to activate CrystalSigil. Please try again.')
                .setColor(Colors.Red)]
        });
    }
}

module.exports = { handleCrystalSigil, CRYSTAL_SIGIL_CONFIG };