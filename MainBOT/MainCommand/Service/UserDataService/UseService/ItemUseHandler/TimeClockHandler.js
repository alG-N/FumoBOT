const { applyMultipleBoosts } = require('../UseBoostService');
const { EmbedBuilder } = require('discord.js');
const { run, get } = require('../../../../Core/database');

async function handleTimeClock(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **TimeClock(L)** is a one-time use item.");
    }

    const source = "TimeClock";
    const duration = 24 * 60 * 60 * 1000;
    const cooldown = 36 * 60 * 60 * 1000;

    // NOTE: DO NOT restore the item here!
    // The item was already consumed by use.js
    // We only restore on cooldown check failure

    try {
        const userRow = await get(
            `SELECT timeclockLastUsed FROM userCoins WHERE userId = ?`,
            [userId]
        );

        const now = Date.now();
        const lastUsed = userRow?.timeclockLastUsed || 0;

        if (lastUsed && now - lastUsed < cooldown) {
            // Restore item since they can't use it yet
            await run(
                `INSERT INTO userInventory (userId, itemName, quantity, type) 
                 VALUES (?, ?, 1, 'item')
                 ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + 1`,
                [userId, itemName]
            );
            
            return message.reply(`⏳ **TimeClock(L)** is on cooldown!\nYou can use it again <t:${Math.floor((lastUsed + cooldown) / 1000)}:R>.\n\nYour item has been returned.`);
        }

        const boosts = [
            { type: 'coin', source, multiplier: 2 },
            { type: 'gem', source, multiplier: 2 },
            { type: 'summonSpeed', source, multiplier: 2 }
        ];

        await applyMultipleBoosts(userId, boosts, duration);

        await run(`UPDATE userCoins SET timeclockLastUsed = ? WHERE userId = ?`, [now, userId]);

        const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("⏰ TimeClock(L) Activated!")
            .setDescription(
                `You activated **TimeClock(L)**!\n\n` +
                `> 💰 **x2 Coins**\n` +
                `> 💎 **x2 Gems**\n` +
                `> 🏃‍♂️ **x2 Summon Speed**\n` +
                `> ⏳ Duration: **24 hours**\n` +
                `> 🔄 Cooldown: **36 hours**\n\n` +
                `*This item is consumed but has a cooldown between uses.*`
            )
            .setFooter({ text: "Enjoy your time boost!" })
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[TIME_CLOCK] Error:', error);
        message.reply('❌ Failed to activate TimeClock(L).');
    }
}

module.exports = { handleTimeClock };