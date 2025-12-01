const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleSgil(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **S!gil?(?)** is a one-time use item.");
    }

    const source = "S!gil";

    try {
        const row = await get(
            `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND type = 'sgilPermanent'`,
            [userId, source]
        );

        if (row) {
            await run(
                `INSERT INTO activeBoosts (userId, type, source, multiplier, uses, expiresAt)
                 VALUES (?, 'rarityOverride', ?, 1, 10, ?)
                 ON CONFLICT(userId, type, source) DO UPDATE SET uses = 10, expiresAt = excluded.expiresAt`,
                [userId, source, Date.now() + 24 * 60 * 60 * 1000]
            );
            return;
        }

        await run(`DELETE FROM activeBoosts WHERE userId = ? AND source != ?`, [userId, source]);

        const goldenRow = await get(
            `SELECT stack FROM activeBoosts WHERE userId = ? AND type = 'coin' AND source = 'GoldenSigil'`,
            [userId]
        );

        const goldenStack = goldenRow?.stack || 0;
        const coinMultiplier = 10 * Math.max(goldenStack, 1);
        const luckMultiplier = 1.25 + (goldenStack > 0 ? goldenStack * 0.075 : 0);
        const sellMultiplier = 6.0;
        const reimuLuck = 16.0;
        const duration = 24 * 60 * 60 * 1000;

        const boostConfigs = [
            { type: 'sgilPermanent', multiplier: 1, expiresAt: null },
            { type: 'coin', multiplier: coinMultiplier, expiresAt: null },
            { type: 'luck', multiplier: luckMultiplier, expiresAt: null },
            { type: 'sell', multiplier: sellMultiplier, expiresAt: null },
            { type: 'rarityOverride', multiplier: 1, expiresAt: Date.now() + duration, uses: 10 },
            { type: 'reimuLuck', multiplier: reimuLuck, expiresAt: null },
            { type: 'astralLock', multiplier: 1, expiresAt: null, extra: '{"maxAstralPlus":1}' }
        ];

        for (const config of boostConfigs) {
            const baseQuery = `INSERT INTO activeBoosts (userId, type, source, multiplier${config.expiresAt !== undefined ? ', expiresAt' : ''}${config.uses ? ', uses' : ''}${config.extra ? ', extra' : ''})
                               VALUES (?, ?, ?, ?${config.expiresAt !== undefined ? ', ?' : ''}${config.uses ? ', ?' : ''}${config.extra ? ', ?' : ''})
                               ON CONFLICT(userId, type, source) DO UPDATE SET multiplier = excluded.multiplier${config.expiresAt !== undefined ? ', expiresAt = excluded.expiresAt' : ''}${config.uses ? ', uses = excluded.uses' : ''}${config.extra ? ', extra = excluded.extra' : ''}`;

            const params = [userId, config.type, source, config.multiplier];
            if (config.expiresAt !== undefined) params.push(config.expiresAt);
            if (config.uses) params.push(config.uses);
            if (config.extra) params.push(config.extra);

            await run(baseQuery, params);
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🪄 S!gil?(?) Activated!")
            .setDescription(
                `You used **S!gil?(?)**!\n\n` +
                `> 💰 **+${coinMultiplier * 100}% Coin Boost** (permanent)\n` +
                `> 🤠**x${luckMultiplier.toFixed(2)} Luck Boost** (permanent)\n` +
                `> 📉 **+500% Sell Value** (permanent)\n` +
                `> 🎲 **10 Nullified Rolls** (equal rarity chance, resets every day)\n` +
                `> 🛐 **+1500% Luck on Reimu's Praying** (permanent)\n` +
                `> 🚫 **All your other boosts are disabled**\n` +
                `> ✨ **You cannot get more than 1 of the same ASTRAL+ rarity**\n\n` +
                `GoldenSigil stacks: **${goldenStack}**\n\n` +
                `*S!gil is permanent. Nullified rolls reset every day!*`
            )
            .setFooter({ text: "The power of S!gil is unleashed. All other boosts are sealed, and ASTRAL+ is limited." })
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[SGIL] Error:', error);
        message.reply('❌ Failed to activate S!gil effect.');
    }
}

module.exports = { handleSgil }