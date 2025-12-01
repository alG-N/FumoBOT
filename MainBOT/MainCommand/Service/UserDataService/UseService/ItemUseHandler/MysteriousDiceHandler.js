const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleMysteriousDice(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **MysteriousDice(M)** is a one-time use item.");
    }

    const source = 'MysteriousDice';
    const type = 'luck';
    const duration = 12 * 60 * 60 * 1000;

    try {
        const row = await get(
            `SELECT * FROM activeBoosts WHERE userId = ? AND type = ? AND source = ? AND expiresAt > ?`,
            [userId, type, source, Date.now()]
        );

        if (row) {
            return message.reply("❌ You already have an active **MysteriousDice(M)** boost! Wait for it to expire before using another.");
        }

        const getRandomMultiplier = () => parseFloat((0.0001 + Math.random() * 10.9999).toFixed(4));

        const now = Date.now();
        const hourAligned = now - (now % (60 * 60 * 1000));
        const initialMultiplier = getRandomMultiplier();
        const expiresAt = now + duration;
        const perHour = JSON.stringify([{ at: hourAligned, multiplier: initialMultiplier }]);

        await run(
            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, extra)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(userId, type, source) DO UPDATE SET
                multiplier = excluded.multiplier,
                expiresAt = excluded.expiresAt,
                extra = excluded.extra`,
            [userId, type, source, initialMultiplier, expiresAt, perHour]
        );

        const embed = new EmbedBuilder()
            .setColor(0x1abc9c)
            .setTitle("🎲 The Mysterious Dice Rolls...")
            .setDescription(
                `You used **MysteriousDice(M)**!\n\n` +
                `> 🤠**Luck Boost:** **${(initialMultiplier * 100).toFixed(2)}%** *(this hour)*\n` +
                `> Every hour, the boost will randomly change between **0.01%** and **1000%**!\n` +
                `⏳ Duration: **12 hours**`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[MYSTERIOUS_DICE] Error:', error);
        message.reply('❌ Failed to activate MysteriousDice boost.');
    }
}

module.exports = { handleMysteriousDice };