const { applyMultipleBoosts } = require('../UseBoostService');
const { EmbedBuilder } = require('discord.js');
const { get } = require('../../../../Core/database');

async function handleMysteriousCube(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **MysteriousCube(M)** is a one-time use item.");
    }

    const source = 'MysteriousCube';

    try {
        const row = await get(
            `SELECT * FROM activeBoosts WHERE userId = ? AND source = ? AND (type = 'luck' OR type = 'coin' OR type = 'gem') AND expiresAt > ?`,
            [userId, source, Date.now()]
        );

        if (row) {
            return message.reply("❌ You already have an active **MysteriousCube(M)** boost! Wait for it to expire before using another.");
        }

        const getRandomMultiplier = () => parseFloat((1 + Math.random() * 5.999).toFixed(4));

        const boosts = [
            { type: 'luck', source, multiplier: getRandomMultiplier() },
            { type: 'coin', source, multiplier: getRandomMultiplier() },
            { type: 'gem', source, multiplier: getRandomMultiplier() }
        ];

        const duration = 24 * 60 * 60 * 1000 * quantity;

        await applyMultipleBoosts(userId, boosts, duration);

        const [luck, coin, gem] = boosts;
        const embed = new EmbedBuilder()
            .setColor(0x9400D3)
            .setTitle("🧊 The Mysterious Cube Shifts...")
            .setDescription(
                `You used **MysteriousCube(M)**!\n\n` +
                `> 🤠**+${((luck.multiplier - 1) * 100).toFixed(2)}% Luck Boost**\n` +
                `> 💰 **+${((coin.multiplier - 1) * 100).toFixed(2)}% Coin Boost**\n` +
                `> 💎 **+${((gem.multiplier - 1) * 100).toFixed(2)}% Gem Boost**\n\n` +
                `⏳ Duration: **24 hour(s)**`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[MYSTERIOUS_CUBE] Error:', error);
        message.reply('❌ Failed to activate MysteriousCube boost.');
    }
}

module.exports = { handleMysteriousCube };