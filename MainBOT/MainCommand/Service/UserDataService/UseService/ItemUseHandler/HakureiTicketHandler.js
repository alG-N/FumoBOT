const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleHakureiTicket(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **HakureiTicket(L)** is a one-time use item.");
    }

    try {
        const row = await get(
            `SELECT reimuUsageCount FROM userCoins WHERE userId = ?`,
            [userId]
        );

        if (!row || row.reimuUsageCount <= 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🌀 Ticket Not Needed')
                .setDescription("You're still within your prayer limit. No need to use a HakureiTicket(L) right now.")
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        await run(
            `UPDATE userCoins SET reimuUsageCount = 0, reimuLastReset = ? WHERE userId = ?`,
            [Date.now(), userId]
        );

        const embed = new EmbedBuilder()
            .setTitle("✨ Ticket Used")
            .setDescription("Your **Reimu prayer limit** has been reset using a HakureiTicket(L)!")
            .setColor(0x9b59b6)
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[HAKUREI_TICKET] Error:', error);
        message.reply('❌ Failed to reset your prayer cooldown.');
    }
}

module.exports = { handleHakureiTicket };