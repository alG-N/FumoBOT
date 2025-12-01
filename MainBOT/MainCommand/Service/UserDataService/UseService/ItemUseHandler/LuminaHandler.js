const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleLumina(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **Lumina(M)** is a one-time use item.");
    }

    const source = 'Lumina';
    const multiplier = 5.0;

    try {
        const row = await get(
            `SELECT * FROM activeBoosts WHERE userId = ? AND type = 'luckEvery10' AND source = ?`,
            [userId, source]
        );

        if (row) {
            const embed = new EmbedBuilder()
                .setColor(0x00FFFF)
                .setTitle("🔮 Lumina(M) Already Active!")
                .setDescription("You already have the **Lumina(M)** boost active.\n> Every 10th roll = **x5 luck** forever!")
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        await run(
            `INSERT INTO activeBoosts (userId, type, source, multiplier, expiresAt, stack) VALUES (?, ?, ?, ?, NULL, NULL)`,
            [userId, 'luckEvery10', source, multiplier]
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setTitle("✨ Lumina(M) Activated!")
            .setDescription("You used **Lumina(M)**!\n\n📹 **Effect:** Every 10th roll = **5x luck** (permanent)")
            .setFooter({ text: "Enjoy your new luck boost!" })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[LUMINA] Error:', error);
        message.reply('❌ Failed to activate Lumina.');
    }
}

module.exports = { handleLumina };