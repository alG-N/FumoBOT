const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { getRarityFromName } = require('./FarmingCalculationService');

function formatFarmingNumber(num) {
    const units = [
        { value: 1e33, symbol: 'Dc' },
        { value: 1e30, symbol: 'No' },
        { value: 1e27, symbol: 'Oc' },
        { value: 1e24, symbol: 'Sp' }, 
        { value: 1e21, symbol: 'Sx' }, 
        { value: 1e18, symbol: 'Qi' },
        { value: 1e15, symbol: 'Qa' }, 
        { value: 1e12, symbol: 'T'  },
        { value: 1e9,  symbol: 'B'  },
        { value: 1e6,  symbol: 'M'  },
        { value: 1e3,  symbol: 'K'  } 
    ];

    for (const u of units) {
        if (num >= u.value) {
            return (num / u.value).toFixed(2) + u.symbol;
        }
    }

    return num.toString();
}

function groupByRarityWithBoosts(farmingFumos, boosts) {
    const grouped = {};

    farmingFumos.forEach(fumo => {
        const rarity = getRarityFromName(fumo.fumoName);
        if (!grouped[rarity]) {
            grouped[rarity] = {
                fumos: [],
                totalCoins: 0,
                totalGems: 0
            };
        }

        const quantity = fumo.quantity || 1;
        const coinsWithBoost = Math.floor(fumo.coinsPerMin * quantity * boosts.coinMultiplier);
        const gemsWithBoost = Math.floor(fumo.gemsPerMin * quantity * boosts.gemMultiplier);

        grouped[rarity].fumos.push(fumo);
        grouped[rarity].totalCoins += coinsWithBoost;
        grouped[rarity].totalGems += gemsWithBoost;
    });

    return grouped;
}

function createFarmStatusEmbed(userData) {
    const { username, farmingFumos, farmLimit, fragmentUses, boosts, seasons } = userData;

    const grouped = groupByRarityWithBoosts(farmingFumos, {
        coinMultiplier: boosts?.coinMultiplier || 1,
        gemMultiplier: boosts?.gemMultiplier || 1
    });

    let totalCoins = 0;
    let totalGems = 0;
    Object.values(grouped).forEach(g => {
        totalCoins += g.totalCoins;
        totalGems += g.totalGems;
    });

    const embed = new EmbedBuilder()
        .setTitle('🌾 Fumo Farming Status')
        .setColor(Colors.Blurple)
        .setDescription(`🛠️ Your Fumos are working hard. Let's check how much loot they're bringing!`)
        .setImage('https://tse4.mm.bing.net/th/id/OIP.uPn1KR9q8AKKhhJVCr1C4QHaDz?rs=1&pid=ImgDetMain&o=7&rm=3');

    for (const rarity of RARITY_PRIORITY) {
        if (!grouped[rarity]) continue;

        const { fumos, totalCoins: rarityCoins, totalGems: rarityGems } = grouped[rarity];

        const nameList = fumos
            .map(f => {
                const cleanName = stripRarityFromName(f.fumoName);
                const traits = [];

                if (f.fumoName.includes('🌟alG')) traits.push('🌟alG');
                if (f.fumoName.includes('✨SHINY')) traits.push('✨SHINY');

                const traitStr = traits.length > 0 ? ` [${traits.join(' ')}]` : '';
                return f.quantity > 1 ? `${cleanName}${traitStr} (x${f.quantity})` : `${cleanName}${traitStr}`;
            })
            .join(', ');

        embed.addFields({
            name: `🔹 ${rarity}: ${formatFarmingNumber(rarityCoins)} coins/min, ${formatFarmingNumber(rarityGems)} gems/min`,
            value: nameList || 'None'
        });
    }

    embed.addFields(
        {
            name: '💰 Total Earnings (with all boosts)',
            value: `${formatFarmingNumber(totalCoins)} coins/min | ${formatFarmingNumber(totalGems)} gems/min`,
            inline: true
        },
        {
            name: '📦 Max Farming Slots',
            value: `${farmingFumos.length} / ${farmLimit}`,
            inline: true
        },
        {
            name: '🔮 Fragment of 1800s',
            value: `${fragmentUses} used`,
            inline: true
        }
    );

    if (seasons?.active && seasons.active !== 'No active seasonal events') {
        embed.addFields({
            name: '🌤️ Active Seasonal Events',
            value: seasons.active || 'None'
        });
    }

    if (boosts?.activeBoosts && boosts.activeBoosts.length > 0) {
        const relevantBoosts = boosts.activeBoosts.filter(b => {
            const type = (b.type || '').toLowerCase();
            return ['coin', 'coins', 'gem', 'gems', 'income'].includes(type);
        });

        if (relevantBoosts.length > 0) {
            embed.addFields({
                name: '⚡ Active Personal Boosts',
                value: relevantBoosts.map(b =>
                    `• **${b.type}** x${b.multiplier} from [${b.source}]${b.expiresAt ? ` (expires <t:${Math.floor(b.expiresAt / 1000)}:R>)` : ''}`
                ).join('\n')
            });
        }
    }

    embed.addFields({
        name: '📋 Notes:',
        value: 'Use `.endfarm` to stop farming specific Fumos.\nCheck `.farminfo` for rarity stats.'
    });

    return embed;
}

function createFarmInfoEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('🧠 Fumo Farming Info')
        .setColor('Purple')
        .setDescription(
            `💡 **Note**:\nEach Fumo has a different power rate based on its rarity.\n` +
            `You can stop farming anytime using \`.endfarm <fumo name>\`.`
        )
        .addFields([{
            name: '📢 Power by Rarity',
            value:
                `\`\`\`\n` +
                `🌿 Common          → 25 coins/min      | 5 gems/min\n` +
                `🍀 Uncommon        → 55 coins/min      | 15 gems/min\n` +
                `🔷 Rare            → 120 coins/min     | 35 gems/min\n` +
                `💎 Epic            → 250 coins/min     | 75 gems/min\n` +
                `🌌 Otherworldly    → 550 coins/min     | 165 gems/min\n` +
                `🏆 Legendary       → 1,200 coins/min   | 360 gems/min\n` +
                `🌠 Mythical        → 2,500 coins/min   | 750 gems/min\n` +
                `🎟️ Exclusive       → 5,500 coins/min   | 1,650 gems/min\n` +
                `❓ ???             → 12,000 coins/min  | 3,600 gems/min\n` +
                `🌟 Astral          → 25,000 coins/min  | 7,500 gems/min\n` +
                `🌙 Celestial       → 50,000 coins/min  | 15,000 gems/min\n` +
                `♾️ Infinite        → 85,000 coins/min  | 25,500 gems/min\n` +
                `🕊️ Eternal         → 125,000 coins/min | 37,500 gems/min\n` +
                `💫 Transcendent    → 375,000 coins/min | 57,500 gems/min\n` +
                `\n` +
                `Special Traits:\n` +
                `✨ SHINY  → 2x multiplier\n` +
                `🌟 alG    → 100x multiplier\n` +
                `(These multiply the base rarity rates)\n` +
                `\`\`\``
        }])
        .setFooter({ text: '✨SHINY = 2x boost | 🌟alG = 100x boost' })
        .setTimestamp();

    return embed;
}

function createSuccessEmbed(message) {
    return new EmbedBuilder()
        .setDescription(`🎉 ${message}`)
        .setColor(Colors.Green);
}

function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setDescription(`❌ ${message}`)
        .setColor(Colors.Red);
}

function createWarningEmbed(message) {
    return new EmbedBuilder()
        .setDescription(`⚠️ ${message}`)
        .setColor(Colors.Yellow);
}

function stripRarityFromName(fumoName) {
    return fumoName
        .replace(/\((.*?)\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/✨SHINY/g, '')
        .replace(/🌟alG/g, '')
        .trim();
}

module.exports = {
    createFarmStatusEmbed,
    createFarmInfoEmbed,
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    stripRarityFromName
};