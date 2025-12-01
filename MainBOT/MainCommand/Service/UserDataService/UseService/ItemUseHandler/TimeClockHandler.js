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

    await run(`UPDATE userInventory SET quantity = quantity + 1 WHERE userId = ? AND itemName = ?`, [userId, itemName]);

    try {
        const userRow = await get(
            `SELECT timeclockLastUsed FROM userCoins WHERE userId = ?`,
            [userId]
        );

        const now = Date.now();
        const lastUsed = userRow?.timeclockLastUsed || 0;

        if (lastUsed && now - lastUsed < cooldown) {
            return message.reply(`⏳ **TimeClock(L)** is on cooldown!\nYou can use it again <t:${Math.floor((lastUsed + cooldown) / 1000)}:R>.`);
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
                `> ⏳ Cooldown: **1d and 12h**\n\n` +
                `*This item is not consumed. You can use it again after the cooldown.*`
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