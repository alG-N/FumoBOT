const { EmbedBuilder } = require('discord.js');
const { applyMultipleBoosts } = require('../UseBoostService');

async function handleAncientRelic(message, itemName, quantity, userId) {
    const source = 'AncientRelic';
    const boosts = [
        { type: 'luck', source, multiplier: 3.5 },
        { type: 'coin', source, multiplier: 4.5 },
        { type: 'gem', source, multiplier: 6.0 },
        { type: 'sellPenalty', source, multiplier: 0.4 }
    ];
    const duration = 24 * 60 * 60 * 1000 * quantity;

    try {        
        await applyMultipleBoosts(userId, boosts, duration);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle("🔮 Ancient Power Unleashed!")
            .setDescription(
                `You used **AncientRelic(E)** x${quantity}!\n\n` +
                `> 🍀 **+250% Luck Boost**\n` +
                `> 💰 **+350% Coin Boost**\n` +
                `> 💎 **+500% Gem Boost**\n\n` +
                `**Boost Details**\n` +
                `⏳ Duration: ${24 * quantity} hour(s)\n\n` +
                `📉 **-60% Sell Value Penalty is now active!**`
            )
            .setFooter({ text: `Boost Source: ${source}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
        
    } catch (error) {
        console.error('[ANCIENT_RELIC] Error:', error);
        await message.reply('❌ Failed to activate AncientRelic boost. Error: ' + error.message);
    }
}

module.exports = { handleAncientRelic };