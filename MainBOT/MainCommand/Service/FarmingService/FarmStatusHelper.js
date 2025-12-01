const { getFarmLimit, getUserFarmingFumos } = require('./FarmingDatabaseService');
const { calculateFarmLimit } = require('./FarmingCalculationService');
const { getCurrentMultipliers, getActiveSeasonsList } = require('./SeasonService/SeasonManagerService');
const { getBuildingLevels } = require('./BuildingService/BuildingDatabaseService');
const { calculateBuildingMultiplier } = require('../../Configuration/buildingConfig');
const { all, get } = require('../../Core/database');
const { EmbedBuilder, Colors } = require('discord.js');
const { formatNumber } = require('../../Ultility/formatting');
const { RARITY_PRIORITY } = require('../../Configuration/rarity');
const { getRarityFromName } = require('./FarmingCalculationService');

async function getFarmStatusData(userId, username) {
    const now = Date.now();
    
    // Parallel fetch for performance
    const [fragmentUses, farmingFumos, boosts, seasonalMults, activeSeasons, buildingLevels, upgradesRow] = 
        await Promise.all([
            getFarmLimit(userId),
            getUserFarmingFumos(userId),
            getActiveBoosts(userId, now),
            getCurrentMultipliers(),
            getActiveSeasonsList(),
            getBuildingLevels(userId),
            get(`SELECT limitBreaks FROM userUpgrades WHERE userId = ?`, [userId])
        ]);

    const { coinMultiplier, gemMultiplier } = calculateMultipliers(boosts, seasonalMults, buildingLevels);
    const limitBreaks = upgradesRow?.limitBreaks || 0;
    const farmLimit = calculateFarmLimit(fragmentUses) + limitBreaks;
    
    // Calculate total farming count (sum of all quantities)
    const totalFarmingCount = farmingFumos.reduce((sum, f) => sum + (f.quantity || 1), 0);

    return {
        username,
        farmingFumos,
        farmLimit,
        totalFarmingCount,
        fragmentUses,
        limitBreaks,
        hasFumos: farmingFumos.length > 0,
        boosts: {
            coinMultiplier,
            gemMultiplier,
            activeBoosts: boosts
        },
        seasons: {
            active: activeSeasons,
            multipliers: seasonalMults
        }
    };
}

async function getActiveBoosts(userId, now) {
    return await all(
        `SELECT type, multiplier, source, expiresAt FROM activeBoosts 
         WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > ?)`,
        [userId, now]
    );
}

function calculateMultipliers(boosts, seasonalMults, buildingLevels) {
    let coinMultiplier = 1;
    let gemMultiplier = 1;

    // User boosts
    boosts.forEach(b => {
        const type = (b.type || '').toLowerCase();
        const mult = b.multiplier || 1;
        if (['coin', 'income'].includes(type)) coinMultiplier *= mult;
        if (['gem', 'gems', 'income'].includes(type)) gemMultiplier *= mult;
    });

    // Building boosts
    const coinBuildingBoost = calculateBuildingMultiplier('COIN_BOOST', buildingLevels.COIN_BOOST);
    const gemBuildingBoost = calculateBuildingMultiplier('GEM_BOOST', buildingLevels.GEM_BOOST);

    // Final multipliers
    return {
        coinMultiplier: coinMultiplier * coinBuildingBoost * seasonalMults.coinMultiplier,
        gemMultiplier: gemMultiplier * gemBuildingBoost * seasonalMults.gemMultiplier
    };
}

function createFarmStatusEmbed(farmData) {
    const { username, farmingFumos, farmLimit, totalFarmingCount, fragmentUses, limitBreaks, boosts, seasons } = farmData;

    const grouped = groupByRarity(farmingFumos, boosts);
    const { totalCoins, totalGems } = calculateTotals(grouped);

    const embed = new EmbedBuilder()
        .setTitle('🌾 Fumo Farming Status')
        .setColor(Colors.Blurple)
        .setDescription(`🛠️ Your Fumos are working hard. Let's check how much loot they're bringing!`)
        .setImage('https://tse4.mm.bing.net/th/id/OIP.uPn1KR9q8AKKhhJVCr1C4QHaDz?rs=1&pid=ImgDetMain&o=7&rm=3');

    // Add rarity fields
    for (const rarity of RARITY_PRIORITY) {
        if (!grouped[rarity]) continue;
        const { fumos, totalCoins: rarityCoins, totalGems: rarityGems } = grouped[rarity];
        
        embed.addFields({
            name: `🔹 ${rarity}: ${formatFarmingNumber(rarityCoins)} coins/min, ${formatFarmingNumber(rarityGems)} gems/min`,
            value: formatFumoList(fumos) || 'None'
        });
    }

    // Summary fields
    embed.addFields(
        {
            name: '💰 Total Earnings (with all boosts)',
            value: `${formatFarmingNumber(totalCoins)} coins/min | ${formatFarmingNumber(totalGems)} gems/min`,
            inline: true
        },
        {
            name: '📦 Max Farming Slots',
            value: `${totalFarmingCount} / ${farmLimit}`,
            inline: true
        },
        {
            name: '🔮 Fragment of 1800s',
            value: `${fragmentUses} used`,
            inline: true
        }
    );

    // Limit breaks
    if (limitBreaks > 0) {
        embed.addFields({
            name: '⚡ Limit Breaks',
            value: `Active: **${limitBreaks}** (+${limitBreaks} slots)`,
            inline: true
        });
    }

    // Seasons
    if (seasons?.active && seasons.active !== 'No active seasonal events') {
        embed.addFields({
            name: '🌤️ Active Seasonal Events',
            value: seasons.active
        });
    }

    // Active boosts
    const relevantBoosts = boosts?.activeBoosts?.filter(b => 
        ['coin', 'coins', 'gem', 'gems', 'income'].includes((b.type || '').toLowerCase())
    );

    if (relevantBoosts?.length > 0) {
        embed.addFields({
            name: '⚡ Active Personal Boosts',
            value: relevantBoosts.map(b =>
                `• **${b.type}** x${b.multiplier} from [${b.source}]${b.expiresAt ? ` (expires <t:${Math.floor(b.expiresAt / 1000)}:R>)` : ''}`
            ).join('\n')
        });
    }

    embed.addFields({
        name: '📋 Notes:',
        value: 'Use `.endfarm` to stop farming specific Fumos.\nCheck `.farminfo` for rarity stats.'
    });

    return embed;
}

function groupByRarity(farmingFumos, boosts) {
    const grouped = {};
    farmingFumos.forEach(fumo => {
        const rarity = getRarityFromName(fumo.fumoName);
        if (!grouped[rarity]) {
            grouped[rarity] = { fumos: [], totalCoins: 0, totalGems: 0 };
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

function calculateTotals(grouped) {
    let totalCoins = 0, totalGems = 0;
    Object.values(grouped).forEach(g => {
        totalCoins += g.totalCoins;
        totalGems += g.totalGems;
    });
    return { totalCoins, totalGems };
}

function formatFumoList(fumos) {
    return fumos.map(f => {
        const cleanName = stripRarityFromName(f.fumoName);
        const traits = [];
        if (f.fumoName.includes('🌟alG')) traits.push('🌟alG');
        if (f.fumoName.includes('✨SHINY')) traits.push('✨SHINY');
        const traitStr = traits.length > 0 ? ` [${traits.join(' ')}]` : '';
        return f.quantity > 1 ? `${cleanName}${traitStr} (x${f.quantity})` : `${cleanName}${traitStr}`;
    }).join(', ');
}

function stripRarityFromName(fumoName) {
    return fumoName
        .replace(/\((.*?)\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/✨SHINY/g, '')
        .replace(/🌟alG/g, '')
        .trim();
}

function formatFarmingNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toString();
}

module.exports = {
    getFarmStatusData,
    createFarmStatusEmbed
};