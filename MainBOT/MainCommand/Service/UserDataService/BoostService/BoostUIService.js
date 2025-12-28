const { EmbedBuilder } = require('discord.js');
const { BOOST_CATEGORIES, BOOST_COLORS } = require('../../../Configuration/boostConfig');
const { formatTime, formatBoostLabel, formatTotalBoost } = require('./BoostFormatterService');

function createBoostEmbed(boostData, detailsType = null) {
    const { boosts, totals } = boostData;
    const now = Date.now();

    if (detailsType) {
        return createDetailsEmbed(boosts, detailsType, now);
    }

    const embed = new EmbedBuilder()
        .setTitle("🚀 Active Boosts")
        .setColor(BOOST_COLORS.DEFAULT)
        .setFooter({ text: "Boosts apply automatically! Use `.boost details <type>` for more info." })
        .setTimestamp();

    const fields = buildBoostFields(boosts, now);
    
    if (fields.length > 0) {
        embed.addFields(fields);
    } else {
        embed.setDescription("You have no active boosts at the moment.");
    }

    return embed;
}

function createDetailsEmbed(boosts, detailsType, now) {
    const validTypes = {
        coin: "🪙 Coin Boosts",
        gem: "💎 Gem Boosts",
        luck: "🍀 Luck Boosts",
        cooldown: "⏱️ Cooldown Reductions",
        debuff: "⚠️ Debuffs",
        yuyuko: "🌸 Yuyuko Rolls",
        sanae: "⛩️ Sanae Blessings"
    };

    const categoryKey = detailsType === 'yuyuko' ? 'yuyukoRolls' : detailsType;

    if (!validTypes[detailsType]) {
        return new EmbedBuilder()
            .setTitle("❓ Unknown Boost Type")
            .setDescription(`Valid types: ${Object.keys(validTypes).join(', ')}`)
            .setColor(BOOST_COLORS.DEFAULT)
            .setTimestamp();
    }

    const categoryBoosts = boosts[categoryKey] || [];
    const embed = new EmbedBuilder()
        .setTitle(`${validTypes[detailsType]} Details`)
        .setColor(BOOST_COLORS[detailsType.toUpperCase()] || BOOST_COLORS.DEFAULT)
        .setFooter({ text: "Use `.boost` to see all boosts." })
        .setTimestamp();

    if (categoryBoosts.length === 0) {
        embed.setDescription("You have no active boosts of this type.");
    } else {
        const labels = categoryBoosts.map(boost => {
            const timeLeft = boost.expiresAt ? formatTime(boost.expiresAt - now) : "∞ - Permanent";
            return formatBoostLabel(boost, timeLeft);
        });
        embed.setDescription(labels.join('\n'));
    }

    return embed;
}

function buildBoostFields(boosts, now) {
    const fields = [];
    const categories = [
        { key: 'coin', name: '🪙 Coin Boosts' },
        { key: 'gem', name: '💎 Gem Boosts' },
        { key: 'luck', name: '🍀 Luck Boosts' },
        { key: 'cooldown', name: '⏱️ Cooldown Reductions' },
        { key: 'debuff', name: '⚠️ Debuffs' },
        { key: 'yuyukoRolls', name: '🌸 Yuyuko Rolls' },
        { key: 'sanae', name: '⛩️ Sanae Blessings' }
    ];

    for (const { key, name } of categories) {
        const categoryBoosts = boosts[key];
        if (!categoryBoosts || categoryBoosts.length === 0) continue;

        const labels = categoryBoosts.map(boost => {
            const timeLeft = boost.expiresAt ? formatTime(boost.expiresAt - now) : "∞ - Permanent";
            return formatBoostLabel(boost, timeLeft);
        });

        fields.push({
            name,
            value: labels.join('\n')
        });
    }

    return fields;
}

module.exports = {
    createBoostEmbed,
    createDetailsEmbed
};