const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { groupByRarity, calculateTotalIncome, getRarityFromName } = require('./FarmingCalculationService');

// Format numbers with K, M, B, T suffixes
function formatFarmingNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
}

function createFarmStatusEmbed(userData) {
    const { username, farmingFumos, farmLimit, fragmentUses, boosts } = userData;
    
    const grouped = groupByRarity(farmingFumos);
    const { totalCoins, totalGems } = calculateTotalIncome(farmingFumos, {
        coinMultiplier: boosts?.coinMultiplier || 1,
        gemMultiplier: boosts?.gemMultiplier || 1
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
                if (f.fumoName.includes('🌟alG')) traits.push('[🌟alG]');
                if (f.fumoName.includes('🌟SHINY')) traits.push('[🌟Shiny]');
                
                const traitStr = traits.length > 0 ? ` ${traits.join(' ')}` : '';
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
            name: '💰 Total Earnings (with boosts)', 
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

    // Filter boosts to only show coin/gem related ones
    if (boosts?.activeBoosts && boosts.activeBoosts.length > 0) {
        const relevantBoosts = boosts.activeBoosts.filter(b => {
            const type = (b.type || '').toLowerCase();
            return ['coin', 'coins', 'gem', 'gems', 'income'].includes(type);
        });

        if (relevantBoosts.length > 0) {
            embed.addFields({
                name: '⚡ Active Boosts',
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
                `🌿 Common          → 25 coins/min    | 5 gems/min\n` +
                `🍀 Uncommon        → 45 coins/min    | 10 gems/min\n` +
                `🔷 Rare            → 70 coins/min    | 20 gems/min\n` +
                `💎 Epic            → 100 coins/min   | 35 gems/min\n` +
                `🌌 Otherworldly    → 150 coins/min   | 50 gems/min\n` +
                `🏆 Legendary       → 200 coins/min   | 75 gems/min\n` +
                `🌠 Mythical        → 350 coins/min   | 115 gems/min\n` +
                `🎟️ Exclusive       → 500 coins/min   | 150 gems/min\n` +
                `❓ ???             → 750 coins/min   | 220 gems/min\n` +
                `🌟 Astral          → 1,000 coins/min | 450 gems/min\n` +
                `🌙 Celestial       → 2,000 coins/min | 700 gems/min\n` +
                `♾️ Infinite        → 3,500 coins/min | 915 gems/min\n` +
                `🕊️ Eternal         → 5,000 coins/min | 1,150 gems/min\n` +
                `💫 Transcendent    → 175,000 coins/min| 17,500 gems/min\n` +
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
    // Remove rarity and tag, but keep alG and SHINY
    return fumoName
        .replace(/\((.*?)\)/g, '') // Remove rarity in parentheses
        .replace(/\[.*?\]/g, '')    // Remove tags in brackets
        .replace(/✨SHINY/g, '')     // Remove SHINY (we'll add it back separately)
        .replace(/🌟alG/g, '')       // Remove alG (we'll add it back separately)
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