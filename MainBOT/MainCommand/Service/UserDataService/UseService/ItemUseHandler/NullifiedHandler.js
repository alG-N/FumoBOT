const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleNullified(message, itemName, quantity, userId) {
    const source = 'Nullified';
    const type = 'rarityOverride';

    try {
        const row = await get(
            `SELECT uses FROM activeBoosts WHERE userId = ? AND type = ? AND source = ?`,
            [userId, type, source]
        );

        const newUses = (row?.uses || 0) + quantity;

        await run(
            `INSERT INTO activeBoosts (userId, type, source, multiplier, uses)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(userId, type, source) DO UPDATE SET uses = excluded.uses`,
            [userId, type, source, 1, newUses]
        );

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle("🎲 Rarity Nullified!")
            .setDescription(
                `You used **Nullified(?)** ${quantity} time(s)!\n\n` +
                `> All rarity chances will be **equal** for **${newUses} roll(s)** (applies to Coins/Gems banners).\n` +
                `🎯 Every rarity has an equal chance!`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[NULLIFIED] Error:', error);
        message.reply('❌ Failed to apply Nullified boost.');
    }
}

module.exports = { handleNullified };