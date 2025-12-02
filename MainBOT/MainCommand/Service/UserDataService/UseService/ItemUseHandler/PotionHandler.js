const { applyBoost, applyMultipleBoosts } = require('../UseBoostService');
const { EmbedBuilder } = require('discord.js');

function createBoostEmbed(color, title, itemName, quantity, boost, duration, source) {
    return new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(
            `You used **${itemName}** x${quantity}!\n\n` +
            `> 📹 **${boost}**\n` +
            `> ⏳ Duration: **${duration} hour${duration > 1 ? 's' : ''}**`
        )
        .setFooter({ text: `Boost Source: ${source}` })
        .setTimestamp();
}

const COIN_POTIONS = {
    "CoinPotionT1(R)": { source: "CoinPotionT1", multiplier: 1.25, boost: "+25%" },
    "CoinPotionT2(R)": { source: "CoinPotionT2", multiplier: 1.5, boost: "+50%" },
    "CoinPotionT3(R)": { source: "CoinPotionT3", multiplier: 1.75, boost: "+75%" },
    "CoinPotionT4(L)": { source: "CoinPotionT4", multiplier: 2, boost: "+100%" },
    "CoinPotionT5(M)": { source: "CoinPotionT5", multiplier: 2.5, boost: "+150%" }
};

const GEM_POTIONS = {
    "GemPotionT1(R)": { source: "GemPotionT1", multiplier: 1.1, boost: "+10%" },
    "GemPotionT2(R)": { source: "GemPotionT2", multiplier: 1.2, boost: "+20%" },
    "GemPotionT3(R)": { source: "GemPotionT3", multiplier: 1.45, boost: "+45%" },
    "GemPotionT4(L)": { source: "GemPotionT4", multiplier: 1.9, boost: "+90%" },
    "GemPotionT5(M)": { source: "GemPotionT5", multiplier: 2.25, boost: "+125%" }
};

const BOOST_POTIONS = {
    "BoostPotionT1(L)": { source: "BoostPotionT1", multiplier: 1.25, boost: "+25%", baseDuration: 30 },
    "BoostPotionT2(L)": { source: "BoostPotionT2", multiplier: 1.5, boost: "+50%", baseDuration: 30 },
    "BoostPotionT3(L)": { source: "BoostPotionT3", multiplier: 2, boost: "+100%", baseDuration: 30 },
    "BoostPotionT4(M)": { source: "BoostPotionT4", multiplier: 2.5, boost: "+150%", baseDuration: 30 },
    "BoostPotionT5(M)": { source: "BoostPotionT5", multiplier: 3, boost: "+300%", baseDuration: 60 }
};

async function handleCoinPotion(message, itemName, quantity) {
    const config = COIN_POTIONS[itemName];
    const { source, multiplier, boost } = config;
    const duration = 60 * 60 * 1000 * quantity;
    const userId = message.author.id;

    try {
        await applyBoost(userId, 'coin', source, multiplier, Date.now() + duration);
        const embed = createBoostEmbed(0xFFD700, '💰 Coin Boost Activated!', itemName, quantity, `${boost} Coin Boost`, quantity, source);
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[POTION] Coin boost error:', error);
        message.reply('❌ Failed to activate boost.');
    }
}

async function handleGemPotion(message, itemName, quantity) {
    const config = GEM_POTIONS[itemName];
    const { source, multiplier, boost } = config;
    const duration = 60 * 60 * 1000 * quantity;
    const userId = message.author.id;

    try {
        await applyBoost(userId, 'gem', source, multiplier, Date.now() + duration);
        const embed = createBoostEmbed(0x00FFFF, '💎 Gem Boost Activated!', itemName, quantity, `${boost} Gem Boost`, quantity, source);
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[POTION] Gem boost error:', error);
        message.reply('❌ Failed to activate boost.');
    }
}

async function handleBoostPotion(message, itemName, quantity) {
    const config = BOOST_POTIONS[itemName];
    const { source, multiplier, boost, baseDuration } = config;
    const duration = baseDuration * 60 * 1000 * quantity;
    const userId = message.author.id;

    const boosts = [
        { type: 'coin', source, multiplier },
        { type: 'gem', source, multiplier }
    ];

    try {
        await applyMultipleBoosts(userId, boosts, duration);
        const hours = Math.round(duration / (60 * 60 * 1000));
        const embed = createBoostEmbed(0x9932CC, '🧪 Magic Boost Activated!', itemName, quantity, `${boost} Coin & Gem Boost`, hours, source);
        message.reply({ embeds: [embed] });
    } catch (error) {
        console.error('[POTION] Boost potion error:', error);
        message.reply('❌ Failed to activate boost.');
    }
}

function isCoinPotion(itemName) {
    return !!COIN_POTIONS[itemName];
}

function isGemPotion(itemName) {
    return !!GEM_POTIONS[itemName];
}

function isBoostPotion(itemName) {
    return !!BOOST_POTIONS[itemName];
}

module.exports = {
    handleCoinPotion,
    handleGemPotion,
    handleBoostPotion,
    isCoinPotion,
    isGemPotion,
    isBoostPotion,
    COIN_POTIONS,
    GEM_POTIONS,
    BOOST_POTIONS
};