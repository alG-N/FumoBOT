const { applyBoost, applyMultipleBoosts } = require('../UseBoostService');
const { EmbedBuilder } = require('discord.js');

async function handleWeirdGrass(message, itemName, quantity, userId) {
    if (quantity > 1) {
        return message.reply("❌ **WeirdGrass(R)** is a one-time use item.");
    }

    const outcomes = [
        { type: 'coin', multiplier: 1.5, duration: 15 * 60 * 1000, desc: "+50% coins for 15 mins", color: 0xFFD700, emoji: "💰" },
        { type: 'gem', multiplier: 1.5, duration: 5 * 60 * 1000, desc: "+50% gems for 5 mins", color: 0x00FFFF, emoji: "💎" },
        { type: 'both', multiplier: { coin: 0.25, gem: 0.5 }, duration: 25 * 60 * 1000, desc: "-75% coins, -50% gems for 25 mins", color: 0xFF6347, emoji: "☠️" }
    ];

    const choice = outcomes[Math.floor(Math.random() * outcomes.length)];
    const now = Date.now();
    const expiresAt = now + choice.duration;

    try {
        if (choice.type === 'both') {
            const boosts = [
                { type: 'coin', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.coin },
                { type: 'gem', source: 'WeirdGrass-Negative', multiplier: choice.multiplier.gem }
            ];
            await applyMultipleBoosts(userId, boosts, choice.duration);
        } else {
            await applyBoost(userId, choice.type, 'WeirdGrass-Boost', choice.multiplier, expiresAt);
        }

        const embed = new EmbedBuilder()
            .setColor(choice.color)
            .setTitle("🌿 You used WeirdGrass(R)!")
            .setDescription(`${choice.emoji} **Effect:** ${choice.desc}`)
            .setFooter({ text: "Weird grass has unpredictable powers..." })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[WEIRD_GRASS] Error:', error);
        message.reply('❌ Failed to apply WeirdGrass effect.');
    }
}

module.exports = { handleWeirdGrass };