const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleGoldenSigil(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **GoldenSigil(?)** is a one-time use item.");
    }

    const source = 'GoldenSigil';
    const baseMultiplier = 100;

    try {
        const row = await get(
            `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = ?`,
            [userId, source]
        );

        const currentStacks = row?.stack || 0;

        if (currentStacks >= 10) {
            // Return item since max stacks reached
            const updateResult = await run(
                `UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`,
                [userId, itemName]
            );
            if (!updateResult || updateResult.changes === 0) {
                await run(
                    `INSERT INTO userInventory (userId, itemName, quantity, type) VALUES (?, ?, 1, 'item')`,
                    [userId, itemName]
                );
            }

            const embed = new EmbedBuilder()
                .setColor(0xFF4500)
                .setTitle("⚠️ Max Stack Reached!")
                .setDescription("You already have **10/10** GoldenSigil boosts.\n> 💸 That's a **+1,000,000% coin boost**!\n\nYour item was **not** consumed.")
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        const newStack = currentStacks + 1;
        const newMultiplier = baseMultiplier * newStack;

        if (row) {
            await run(
                `UPDATE activeBoosts SET stack = ?, multiplier = ? WHERE userId = ? AND type = 'coin' AND source = ?`,
                [newStack, newMultiplier, userId, source]
            );
        } else {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) VALUES (?, ?, ?, ?, NULL, ?)`,
                [userId, 'coin', source, baseMultiplier, 1]
            );
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("✨ Golden Sigil " + (row ? "Stacked!" : "Activated!"))
            .setDescription(`You used **GoldenSigil(?)**!\n\n📹 **Stack:** ${newStack}/10\n💰 **Coin Boost:** +${(row ? newMultiplier : baseMultiplier) * 100}%`)
            .setFooter({ text: "Stacks reset when the effect is cleared." })
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[GOLDEN_SIGIL] Error:', error);
        message.reply('❌ Failed to stack GoldenSigil.');
    }
}

module.exports = { handleGoldenSigil };